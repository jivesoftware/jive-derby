/*************************************************
Copyright 2017 Jive Software

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*************************************************/
'use strict';

var jive = require('jive-sdk');
var q = require('q');
var config = jive.service.options["ext"];
var dbPool = require('./DbHelper')['pool'];
var dbQuery = require('./DbHelper')['query'];
var util = require('util');
var derbies = require('./DerbyHelper');

var DerbyRaceHelper = {};

const SQL_RACE_TO_JSON_PFX = 'SELECT row_to_json(t) as json \
           FROM ( \
           SELECT id, name, split1, split2, split3, split4, photoURL as "photoURL", timestamp, \
           ( \
              SELECT row_to_json(d) \
              FROM (\
                SELECT id, name \
                FROM jderby_derbies \
                WHERE id=r.derbyID \
              ) d \
            ) as derby, \
            ( \
              SELECT array_to_json(array_agg(row_to_json(rr))) \
              FROM (\
                SELECT lane, rank, racerid as "racerID", speed, totaltimesec as "totalTimeSec", isprimary as "isPrimary", isactive as "isActive" \
                FROM jderby_results \
                WHERE raceID=r.id \
                ORDER BY rank, totalTimeSec asc \
              ) rr \
            ) as results, \
            ( \
               SELECT array_to_json(array_agg(row_to_json(m))) \
               FROM (\
                 SELECT timestamp, type, value, unit \
                 FROM jderby_measurements \
                 WHERE raceID=r.id \
               ) m \
             ) as measurements \
           FROM jderby_races r WHERE';

const SQL_RACE_TO_JSON_SFX = " ) t";

DerbyRaceHelper.getRace = function(derbyID,raceID,options) {
  jive.logger.debug("Getting Race Details",derbyID,raceID,options["params"]);
  var deferred = q.defer();

  var sql = SQL_RACE_TO_JSON_PFX;
  var params = [];

  params.push(derbyID);
  sql += " r.derbyID=$"+(params.length)+"::text";

  params.push(raceID);
  sql += " AND r.id=$"+(params.length);

  sql += SQL_RACE_TO_JSON_SFX;

  dbQuery(sql,params).then(
    function(rs) {
      if (rs.rows.length === 1){
        deferred.resolve(rs.rows[0]["json"]);
      } else {
        deferred.reject({ status: 404, message: "Race ["+raceID+"] Does Not Exist"});
      } // end if
    }, // end function
    function(err) {
      deferred.reject({ message : err["detail"], details : err });
    } // end function
  );

  return deferred.promise;
} // end function

DerbyRaceHelper.getRaces = function(derbyID,options) {
  jive.logger.debug("Getting Races",derbyID,options["params"]);

  var sql = SQL_RACE_TO_JSON_PFX;
  var params = [];

  var deferred = q.defer();

  params.push(derbyID);
  sql += " r.derbyID=$"+(params.length)+"::text";

  if (options["params"]["racer"]) {
    params.push(options["params"]["racer"]);
    sql += " AND r.id IN (SELECT raceID FROM jderby_results WHERE racerID=$"+(params.length)+"::int)";
  } // end if

  if (options["params"]["min"]) {
    params.push(options["params"]["min"]);
    sql += " AND r.id >= $"+(params.length);
  } // end if

  if (options["params"]["max"]) {
    params.push(options["params"]["max"]);
    sql += " AND r.id <= $"+(params.length);
  } // end if

  sql += " ORDER BY r.id "+options["params"]["sort"];
  sql += " LIMIT "+options["params"]["count"];

  /*** NEEDED FOR TYPE QUERY ***/
  sql += SQL_RACE_TO_JSON_SFX;

  dbQuery(sql,params).then(
    function(rs) {
      var data = [];
      rs.rows.forEach(
        function(row) {
          data.push(row["json"]);
        } // end function
      );
      deferred.resolve(data);
    }, // end function
    function(err) {
      deferred.reject({ message : err["detail"], details : err });
    } // end function
  );

  return deferred.promise;
} // end function

function saveResults(client, raceID, isDiagnosticMode, options) {
  var deferred = q.defer();

  /*** LOOP THROUGH RESULTS AND INSERT ***/
  options["data"]["results"].forEach(
    function(result, idx, results) {
      jive.logger.debug('','result',result["lane"],result["rank"],result["racer"]["id"],result["totalTimeSec"],'for race',raceID);
      client.query("INSERT INTO jderby_results(raceID,lane,rank,racerID,totalTimeSec,speed,isPrimary,isActive) VALUES($1,$2::int,$3::int,$4::int,$5,$6,true,$7)",
        [raceID,result["lane"],result["rank"],result["racer"]["id"],result["totalTimeSec"],result["speed"],!isDiagnosticMode],
        function(err, rs) {
          if (err) {
            deferred.reject({ message: "Unexpected error(s) saving Race["+raceID+"] Results", details: err});
            return;
          } // end if
        } // end function
      );
    } // end for
  );
  deferred.resolve(options);

  return deferred.promise;
} // end function

//TODO: MOVE TO AWS IOT HELPER AND REFERENCE HERE
function saveMeasurementValue(client, raceID, type, value, unit) {
  jive.logger.debug('','measurement',type,value,unit,'for race',raceID);
  var deferred = q.defer();

  client.query("INSERT INTO jderby_measurements(raceID,type,value,unit) VALUES($1,$2::text,$3,$4::text)",
        [raceID,type,value,unit],
        function(err, rs) {
          if (err) {
            deferred.reject({ message: "Unexpected error(s) saving Race["+raceID+"] Measurement ["+type+"]", details: err});
            return;
          } // end if
          deferred.resolve();
        } // end function
      );

  return deferred.promise;
} // end function

/**********
*
***********/
function saveMeasurementValues(client,raceID,options) {
    var deferred = q.defer();

    var measurements = options["data"]["measurements"];
    if (measurements && measurements.length > 0) {
      var promises = [];
      measurements.forEach(
        function(measurement) {
          promises.push(saveMeasurementValue(client,raceID,measurement["type"],measurement["value"],measurement["unit"]));
        } // end function
      );
      /**** SAVE ALL IOT PROPERTIES ***/
      q.all(promises).done(
        function(success) {
          deferred.resolve(options);
        }, // end function
        function(error) {
          jive.logger.error("Unable to save 1 or more Measurement Values for Race",raceID);
          deferred.reject(error);
        } // end function
      );
    } else {
      jive.logger.debug("No Measurements found to save...");
      deferred.resolve(options);
    } // end if

    return deferred.promise;
} // end function

DerbyRaceHelper.createRace = function(options) {
  var deferred = q.defer();

  var data = options["data"];
  var raceID = data["raceID"];

  //TODO:  UNDO HARD CODED SPLITS
  var splits = [null,null,null,null];
  //TODO:  FIND ANOTHER FUNCTION FOR THIS...SIMILAR TO .slice
  if (data["splits"]) {
    data["splits"].forEach(
      function(split,idx) {
        splits[idx] = split;
      } // end function
    );
  } // end if

  //TODO: IMPLEMENT CAPTURE OF RACE NAME HIGHER UPSTREAM IN RACE MANAGER
  var raceName = data["raceName"] || util.format("Race %s",raceID);
  var derbyID = data["derby"]["id"];
  var photoURL = data["photoURL"];
  var isDiagnosticMode = data['diagnostic'];

  jive.logger.debug('createRace',derbyID,raceID);

  dbPool.connect(
    function(clientError,client,releaseConnection) {
      if (clientError) {
        deferred.reject({ message : err["detail"], details : err });
        return;
      } // end if

      client.query('BEGIN');
      client.query(
        "INSERT INTO jderby_races(id,name,derbyid,split1,split2,split3,split4,photourl) VALUES($1,$2::text,$3::text,$4,$5,$6,$7,$8::text)",
        [raceID, raceName, derbyID, splits[0], splits[1], splits[2], splits[3], photoURL],
        function(err, rs) {
            if (!err) {
              saveMeasurementValues(client,raceID,options)
              .then(
                function(options) {
                  return saveResults(client,raceID,isDiagnosticMode,options)
                }, // end function
                function(err) {
                  jive.logger.warn("Unable to saveMeasurementValues",err);
                  // EXITING CHAIN
                  releaseConnection();
                  deferred.reject(err);
                } // end funciton
              ).then(
                  function(options) {
                    jive.logger.debug('Committing Race Results',raceID);
                    client.query('COMMIT',
                      function() {
                        releaseConnection();
                        deferred.resolve(options);
                      } // end function
                    );
                  }, // end function
                  function(err) {
                    jive.logger.warn("Unable to saveResults",err);
                    deferred.reject(err);
                  } // end function
                );
            } else {
              jive.logger.warn("unable to insert race",err);
              deferred.reject({ message : err["detail"], details : err });
            }// end if
          } // end function
      );
    } // end function
  );

  return deferred.promise;
} // end function

function addRacePropsToExtObject(tenantID,derbyID,raceID,contentURI) {
  //console.log('***',tenantID,derbyID,raceID,contentURI);
  return DerbyRaceHelper.getRace(derbyID,raceID,{}).then(
    function(raceResults) {

      var extProps = {
        derbyID : derbyID,
        derbyName : raceResults["derby"]["name"],
        raceID : raceID,
        raceName : raceResults["name"],
        photoURL : raceResults["photoURL"],
        timestamp : raceResults["timestamp"],
        split1 : raceResults["split1"],
      };

      raceResults["measurements"].forEach(
        function(measurement) {
          extProps["env-"+measurement["type"]] = measurement["value"];
        } // end function
      );

      raceResults["results"].forEach(
        function(result) {
          extProps["racer-"+result["racerID"]] = result["racerID"];
          extProps["lane"+result["lane"]] = result["racerID"];
          extProps["rank"+result["lane"]] = result["rank"];
          extProps["speed"+result["lane"]] = result["speed"];
          extProps["totalTimeSec"+result["lane"]] = result["totalTimeSec"];
        } // end function
      );

      return jive.community.findByTenantID(tenantID).then(
        function(community) {

            return jive.community.doRequest(community,{
               url : contentURI+"/extprops",
               method : "POST",
               headers :  { "content-type" : "application/json" },
               postBody : extProps
             }).then(
               function(success) {
                 jive.logger.debug("Added Race ExtProps to Jive Object...");
                 return q.fcall( function () { return null; });
               }, // end function
               function(error) {
                 jive.logger.warn("Unable to Add ExtProps to Jive Ext Object...",contentURI,extProps);
                 return q.fcall( function () { return null; });
               } // end function
           );
        } // end function
      );
    } // end function
  );
} // end function

DerbyRaceHelper.linkRaceToExtObject = function(tenantID,externalID,contentURI,contentURL,activity) {

  var deferred = q.defer();

  //TODO: VALIDATE TOKEN SIZE AND STRUCTURE
  //*** jderby-debug-1485878018494
  var tokens = externalID.split("-");
  var derbyID = tokens[1];
  var raceID = Number(tokens[2]);

  var sql = 'UPDATE jderby_races SET jiveURL=$1::text, jiveURI=$2::text WHERE derbyID=$3::text AND id=$4';
  var params = [contentURL,contentURI,derbyID,raceID];

  dbQuery(sql,params).then(
    function(rs) {
      if (rs["rowCount"] > 0) {
        addRacePropsToExtObject(tenantID,derbyID,raceID,contentURI).then(
          function() {
            deferred.resolve({
              externalID : externalID,
              derbyID : derbyID,
              raceID : raceID,
              contentURI : contentURI,
              contentURL : contentURL,
              activity : activity
            });
          } // end function
        );
      } else {
        deferred.reject({ status: 404, message : "Race ["+raceID+"] does not exist" });
      } // end if
    }, // end function
    function(err) {
      deferred.reject({ message : err["detail"], details : err });
    } // end function
  );

  return deferred.promise;
} // end function

DerbyRaceHelper.toggleResult = function(derbyID,raceID,racerID,options) {

  var sql = "UPDATE jderby_results rr SET lane=lane";
  var params = [];

  var deferred = q.defer();

  //*** ONLY ALLOW THIS FOR A SINGLE RACER RECORD ***
  if (racerID) {

    if (options["active"]) {
      params.push(options["active"]);
      sql += ", isActive=$"+(params.length);
    } // end if

    if (options["primary"]) {
      params.push(options["primary"]);
      sql += ", isPrimary=$"+(params.length);
    } // end if

    params.push(derbyID);
    sql += " FROM jderby_races r WHERE r.raceID=rr.raceID AND r.derbyID=$"+(params.length)+"::text";
    params.push(raceID);
    sql += " AND r.raceID=$"+(params.length);
    params.push(racerID);
    sql += " AND rr.racerID=$"+(params.length)+"::int";

    dbQuery(sql,params).then(
      function(rs) {
        if (rs["rowCount"] === 1) {
          deferred.resolve();
        } // end if

        if (options["refresh"]) {
          //TODO: UPDATE THE REMAINING rank VALUES TO SHIFT ACCORDINGLY
          //TODO: MOVE THIS PART TO THE DERBY MANAGER
          //TODO: KICK OFF ASYNC RECALC OF LEADERBOARDS AND RACE REDIS CACHES
          //TODO: RECALC PRIMARY FOR RacerID
          //TODO: RECALC LEADERBOARDS
          //TODO: UPDATE REDIS LEADERBOARD
          //TODO: UPDATE REDIS RACE
        } // end if
      }, // end function
      function(err) {
        deferred.reject({ message : err["detail"], details : err });
      } // end function
    );

  } else {
    deferred.reject({status: 400, message : "RacerID not specified"});
  } // end if

  return deferred.promise;
}

module.exports = DerbyRaceHelper;
