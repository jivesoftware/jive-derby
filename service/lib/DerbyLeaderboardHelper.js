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
var config = jive.service.options["ext"];
var derbies = require('./DerbyHelper');
var dbPool = require('./DbHelper')['pool'];
var dbQuery = require('./DbHelper')['query'];
var util = require('util');

var q = require('q');
var fs = require('fs');
var mustache = require('mustache');

const NodeCache = require( "node-cache" );
const MAIN_LEADERBOARD_CACHE = new NodeCache({
  stdTTL : 0,
  checkperiod :0,
  useClones : true,
  errorOnMissing : false
});

const LEADERBOARD_TEMPLATE_PATH = process.cwd()+'/templates/leaderboard-jive-document.html';

var DerbyLeaderboardHelper = {};

jive.events.addLocalEventListener(config.events.JIVE_EXTOBJECT_CREATED,
  function(data) {
    jive.logger.debug('****','LeaderboardExtObjectListener',data);
    var raceID = data["raceID"];
    derbies.getDerby(data["derbyID"],{}).then(
      function(derby) {
        DerbyLeaderboardHelper.updateCaches(derby,raceID,false)
         .then(
           function() {
             DerbyLeaderboardHelper.pushToJiveDocument(derby,raceID);
           } // end function
         );
      } // end function
    );
  } // end function
);

/******************************
* CHECKS TO SEE IF THE REQUEST CAN BE SERVICED BY THE LEADERBOARD CACHE, IF SO ... RETURNS IT
******************************/
function getLeaderBoardCache(derbyID,params) {
  var readLeaderboardCache = q.nfbind(MAIN_LEADERBOARD_CACHE.get);

  params = params || {
    "onlyActive" : true,
    "onlyPrimary" : true
  };

  return readLeaderboardCache(derbyID).then(
    function(cache) {
      //console.log('****','Cache',cache);
      if (cache && cache["data"] &&
          cache["data"]["options"]["onlyActive"] === params["onlyActive"] &&
          cache["data"]["options"]["onlyActive"] === params["onlyPrimary"]) {
        jive.logger.debug("Using Leaderboard Cache to Service Request!",derbyID);
        return cache;
      } // end if
      return null;
    }, // end function
    function (err) {
      return null;
    } // end function
  );
} // end function

/******************************
* TODO: DOCUMENTATION
******************************/
DerbyLeaderboardHelper.updateCachesFromRace = function(options) {
  return DerbyLeaderboardHelper.updateCaches(
    {
      id : options["data"]["derby"]["id"],
      name : derbies.getCachedName(options["data"]["derby"]["id"])
    },
    options["data"]["raceID"],
    (options["data"]["diagnostic"] === true),
    options["params"] || {
      "onlyActive" : true,
      "onlyPrimary" : true
    }
  ).then(
    function() {
      return q.fcall(function() { return options; });
    },
    function(error) {
      return q.fcall(function() { return error; });
    }
  );
} // end function

DerbyLeaderboardHelper.updateCaches = function(derby,raceID,isDiagnosticMode,params) {
  /*** ASSIGN DEFAULTS FOR UNDECLARED ***/
  raceID = raceID || -1;
  isDiagnosticMode = (isDiagnosticMode === true);
  params = params || {
    "onlyActive" : true,
    "onlyPrimary" : true
  };

  if (isDiagnosticMode) {
    jive.logger.debug("Skipping updateCaches, diagnosticMode",isDiagnosticMode);
    /*** THIS STEP NOT REQUIRED FOR DIAGNOSTIC MODE ***/
    return q.fcall(function() { return null; });
  } // end if

  var deferred = q.defer();

  jive.logger.debug("Updating Leaderboard Caches",derby,raceID);
  DerbyLeaderboardHelper.getLeaderboardData(derby,params,false)
  .then(
    function(leaderboardData) {
      DerbyLeaderboardHelper.generateJiveContentMarkup(leaderboardData,params,false)
      .then(
        function(markup) {
          MAIN_LEADERBOARD_CACHE.set(derby["id"],{
            timestamp : new Date(),
            derbyID : derby["id"],
            data : leaderboardData,
            markup : markup,
            onlyActive : true,
            onlyPrimary : true,
            lastRaceID : raceID
          });
          jive.logger.debug("","Successfully Updated Leaderboard Caches",derby,raceID,leaderboardData);
          deferred.resolve();
        }, // end function
        function(error) {
          jive.logger.error("Failed to Generate Leaderboard Markup",raceID);
          deferred.reject(error);
        } // end function
      );
    }, // end function
    function(error) {
      jive.logger.error("Failed to Generate Leaderboard Data",raceID);
      deferred.reject(error);
    } // end function
  );

  return deferred.promise;
}; // end function

function updatePrimaryRacerRecord(client,racerID) {
  const SQL_CLEAR_RACER_PRIMARY_RECS = "UPDATE jderby_results SET isprimary=false WHERE isprimary=true AND racerID=$1::int";
  const SQL_UPDATE_RACER_PRIMARY_REC = "UPDATE jderby_results SET isprimary=true WHERE racerID=$1::int AND resultID in (\
                                            SELECT resultID FROM jderby_results WHERE racerID=$1::int AND isactive=true \
                                            ORDER BY totaltimesec ASC, raceid ASC, lane ASC LIMIT 1)";

  var deferred = q.defer();

  client.query("BEGIN",
    function(err) {
      if (!err) {
        client.query(SQL_CLEAR_RACER_PRIMARY_RECS,[racerID],
          function(err,rs) {
            if (!err) {
              client.query(SQL_UPDATE_RACER_PRIMARY_REC,[racerID],
                function(err,rs) {
                  if (rs["rowCount"] === 1) {
                    jive.logger.info("Successfully Updated Primary Record for Racer",racerID);
                    client.query("COMMIT",
                      function(err) {
                        deferred.resolve();
                      } // end function
                    );
                  } else {
                    jive.logger.error("Failed to Updated Primary Record for Racer, Rolling Back Transaction",racerID);
                    client.query("ROLLBACK",
                      function(err) {
                        jive.logger.debug("Rollback Completed");
                        deferred.reject(err);
                      } // end function
                    );
                  } // end if
                } // end function
              );
            } else {
              jive.logger.error("Error clearing existing primary records ...",racerID, rs["rowCount"],err);
              deferred.reject(err);
            } // end if
          } // end function
        );
      } else {
        jive.logger.error("Unable to start transaction to update primary records  ...",racerID,err);
        deferred.reject(err);
      } // end if

    });

    return deferred.promise;
} // end function

/******************************
* TODO: DOCUMENTATION
******************************/
DerbyLeaderboardHelper.updatePrimaryRecords = function(options) {
  var results = options["data"]["results"];
  var raceID = options["data"]["raceID"];

  var isDiagnosticMode = options["data"]["diagnostic"];
  if (isDiagnosticMode) {
    jive.logger.debug("Skipping updateCaches, diagnosticMode",isDiagnosticMode);
    /*** THIS STEP NOT REQUIRED FOR DIAGNOSTIC MODE ***/
    return q.fcall(function() { return options; });
  } // end if

  jive.logger.debug("Updating Primary Records",options["data"]["raceID"]);

  var deferred = q.defer();

  dbPool.connect(
    function(clientError,client,releaseConnection) {

      var promises = [];
      results.forEach(
        function(result) {
          promises.push(updatePrimaryRacerRecord(client,result["racer"]["id"]));
        } // end function
      );
      q.all(promises).done(
        function(values) {
          jive.logger.debug("Successfully Updated ALL Primary Records for Race",raceID);
          deferred.resolve(options);
        }, // end function
        function(error) {
          jive.logger.error("Failed to Update Primary Records",error);
          deferred.reject(error);
        } // end function
      );
    } // end function
  );

  return deferred.promise;
} // end function

DerbyLeaderboardHelper.generateJiveContentMarkup = function(leaderboardData,params,useCache) {
  //TODO: RENDERING OPTIONS FOR VARIOUS PLATFORMS NEEDED?
  //TODO: INCLUDE HEADSHOTS. DEFAULT GUEST IMAGES, ETC... COLORS OF TEXT?
  useCache = (useCache === true);

  jive.logger.debug("Generating Jive Content Markup...",useCache);

  /*** SHORT-CIRCUIT IN THE EVENT THIS IS THE MAIN LEADERBOARD QUERY ***/
  if (useCache) {
    getLeaderBoardCache(leaderboardData["derby"]["id"],params).then(
      function(cache) {
        if (cache["markup"]) {
          return q.fcall(function () { return cache["markup"]; });
        } // end if
      } // end function
    );
  } // end if

  var deferred = q.defer();

  fs.readFile(LEADERBOARD_TEMPLATE_PATH,
    function (err, data) {
      if (err) {
        return deferred.reject({ message : err["detail"], details : err });
      } // end if
      deferred.resolve(mustache.render(data.toString(),leaderboardData));
    } // end function
  );

  return deferred.promise;
} // end function

DerbyLeaderboardHelper.getLeaderboardData = function(derby,params,useCache) {
  jive.logger.debug("Getting Leaderboard Details",derby,params,useCache);

  useCache = (useCache === true);

  /*** SHORT-CIRCUIT IN THE EVENT THIS IS THE MAIN LEADERBOARD QUERY ***/
  if (useCache) {
    jive.logger.debug("***","Trying Cache to Service Request",derby["id"]);
    getLeaderBoardCache(derby["id"],params).then(
      function(cache) {
        if (cache["data"]) {
          jive.logger.debug("***","Using Cache to Service Request",derby["id"]);
          return q.fcall(function () { return cache["data"]; });
        } // end if
      } // end function
    );
  } // end if

  const SQL_PFX = 'SELECT row_to_json(lb) as json \
                   FROM ( \
                     SELECT r.timestamp, r.jiveURL as "jiveURL", r.jiveURI as "jiveURI", rr.raceID as "raceID", rr.lane, rr.speed, rr.totaltimesec as "totalTimeSec", row_number() over(order by rr.totaltimesec, rr.raceID) as rank,  \
                     ( \
                      SELECT row_to_json(d) as racer \
                      FROM ( \
                        SELECT id, name, username, title, company, avatarURL as "avatarURL", profileURL as "profileURL", uri \
                        FROM jderby_racers \
                        WHERE id=rr.racerID \
                      ) as d \
                     ) \
                     FROM jderby_races r, jderby_results rr \
                     WHERE r.id=rr.raceID';

  const SQL_SFX = " ORDER BY rr.totaltimesec, rr.raceID ASC ) lb";

  var deferred = q.defer();

  var sql = SQL_PFX;
  var sqlParams = [];

  sqlParams.push(derby["id"]);
  sql += " AND r.derbyID=$"+(sqlParams.length);

  if (params["onlyActive"]) {
    sqlParams.push(params["onlyActive"]);
    sql += " AND rr.isActive=$"+(sqlParams.length);
  } // end if

  if (params["onlyPrimary"]) {
    sqlParams.push(params["onlyPrimary"]);
    sql += " AND rr.isPrimary=$"+(sqlParams.length);
  } // end if

  if (params["min"]) {
    sqlParams.push(params["min"]);
    sql += " AND r.id >= $"+(sqlParams.length)+"::int";
  } // end if

  if (params["max"]) {
    sqlParams.push(params["max"]);
    sql += " AND r.id <= $"+(sqlParams.length)+"::int";
  } // end if

  sql += SQL_SFX;

  dbQuery(sql,sqlParams).then(
    function(rs) {
      if (rs.rows.length < 1) {
        jive.logger.warn('No Races Found in Derby',derby);
        deferred.reject({ message : "Derby ["+derby["id"]+"] Not Found", status: 404 });
        return;
      } // end if

      var data = {
        timestamp : new Date(),
        derby : derby,
        results : []
      };

      rs.rows.forEach(
        function(row) {
          data["results"].push(row["json"]);
        } // end function
      );

      data["options"] = {
          onlyActive : params["onlyActive"],
          onlyPrimary : params["onlyPrimary"],
          min : params["min"],
          max : params["max"]
      };

      deferred.resolve(data);
    }, // end function
    function(err) {
      deferred.reject({ message : err["detail"], details : err });
    } // end function
  );

  return deferred.promise;

} // end function

function upsertLeaderboardJiveDocument(details) {
  jive.logger.debug("Upserting Jive Leaderboard Document",details);

  var deferred = q.defer();

  jive.community.findByTenantID(details["tenantId"]).then(
    function(community) {
      if (community) {
        var request = {
           url : (details["httpMethod"] === "POST") ? community["jiveUrl"]+details["uri"] : details["uri"],
           method : details["httpMethod"],
           headers :  { "content-type" : "application/json" },
           postBody : {
             authorship : "author",
             content : { "type": "text/html",  "text": details["markup"] },
             parent : details["placeURI"],
             subject : util.format(config["jive"]["leaderboard"]["subject"],details["derby"]["name"]),
             tags : config["jive"]["leaderboard"]["tags"].concat(details["derby"]["id"]),
             type : "document",
             via : { "displayName" : "Jive Derby", "url" : "https://developer.jivesoftware.com/jive-derby/how-to-race.html" },
             visibility : "place"
           }
         };
        jive.community.doRequest(community,request).then(
           function(response) {
             jive.logger.debug("SUCCESS","Created/Updated Leaderboard Document");
             details["uri"] = response["entity"]["resources"]["self"]["ref"];
             details["url"] = response["entity"]["resources"]["html"]["ref"];
             details["placeURL"] = response["entity"]["parentPlace"]["html"];
             deferred.resolve(details);
           }, // end function
           function(error) {
             jive.logger.error("ERROR","Creating/Updating Leaderboard Document",error);
             deferred.reject(error);
           } // end function
        );
      } else {
        deferred.reject("Unable to Find TenantId",details["tenantId"]);
      } // end if
    } // end function
  );

  return deferred.promise;
} // end function

DerbyLeaderboardHelper.pushToJiveDocument = function(derby,raceID) {
  var derbyID = derby["id"];
  var derbyName = derby["name"];

  /*** USING THIS AS A UNIVERSAL WAY OF FIND PLACES WHERE LEADERBOARDS ARE CREATED ***/
  jive.extstreams.findByDefinitionName(config["jive"]["tiles"]["raceActivity"]["name"])
  .then(
    function(targetInstances) {
      if (targetInstances && targetInstances.length > 0) {
        targetInstances.forEach(
          function(instance) {
            //TODO:  PREVENT LEADERBOARD FROM BEING CREATED ON NON-PRIMARY JIVE INSTANCES
            //TODO:  UPDATE MODEL TO SUPPORT MULTIPLE jiveURLs for RACE RESULTS (P3/P4 issue)
            if (instance["tenantId"] !== config["jive"]["options"]["tenantID"]) {
              jive.logger.debug("Skipping Leaderboard for non-primary Jive instance",instance["tenantId"]);
              return;
            } // end if

            var tileConfig = instance['config'];
            if (tileConfig["derbyID"] === derbyID) {
                 /*** GET JIVE DOCUMENT LEADERBOARD DETAILS ***/
                 derbies.getJiveTenantDetails(derbyID).then(
                   function(details) {
                     return getLeaderBoardCache(derbyID).then(
                       function(cache) {
                         return q.fcall( function () {
                             return {
                               derby : derby,
                               raceID : raceID,
                               markup : cache["markup"],
                               tenantId : details["tenantId"] || instance["tenantId"],
                               placeURI : details["placeURI"] || instance["config"]["parent"],
                               placeURL : details["placeURL"],
                               uri : details["uri"] || "/api/core/v3/contents",
                               url : details["url"],
                               httpMethod : (details["uri"]) ? "PUT" : "POST",
                               isNew : (!details["url"])
                             };
                         });
                       } // end function;
                     );
                   } // end function
                 )
                 .then(upsertLeaderboardJiveDocument)
                 .then(
                   function(details) {
                     /*** ONLY UPDATE IF THIS IS THE FIRST CREATION OF THE DOCUMENT ***/
                     if (details["isNew"]) {
                        derbies.setJiveTenantDetails(details["derby"]["id"],details["tenantId"],details["uri"],details["url"],details["placeURI"],details["placeURL"]).then(
                          function(details) {
                            jive.logger.debug("Successfully Updated Jive Derby Details...");
                          } // end function
                        );
                     } // end if
                   }, // end function
                   function(error) {
                     jive.logger.warning("Unable to update leaderboard content in Jive",error);
                   } // end function
                 );
               } // end if
             } // end function
           ); // end for-each
        } else {
          jive.logger.debug("No target instances found to match this derby, so skipping Leaderboard Jive Document Push ...",derbyID);
        } // end if
      } // end function
  ); // end then
} // end function

module.exports = DerbyLeaderboardHelper;
