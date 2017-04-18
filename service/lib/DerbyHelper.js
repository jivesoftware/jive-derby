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
var raceTimeHistory = require('./DerbyRaceTimeHistoryCache');

var DerbyHelper = {};

var nameCache = {};

DerbyHelper.createDerby = function(options) {
  var sql = "INSERT INTO jderby_derbies AS d (id,name,ispublic,isactive) \
                   VALUES($1::text, $2::text, $3, $4) \
                   ON CONFLICT (id) \
                   DO UPDATE SET name=$2::text, ispublic=$3, isactive=$4 \
                   WHERE d.id=$1::text";

  var params = [ options["data"]["id"],options["data"]["name"],options["data"]["public"],options["data"]["active"] ];

  var deferred = q.defer();

  dbQuery(sql,params).then(
    function(rs) {
      nameCache[options["data"]["id"]] = options["data"]["name"];
      deferred.resolve();
    }, // end function
    function(err) {
      deferred.reject({ message : err["detail"], details : err });
    } // end function
  );

  return deferred.promise;
} // end function

DerbyHelper.getDerbies = function(options) {
  jive.logger.debug("Getting Derbies",options["params"]);
  var deferred = q.defer();

  var sql = "SELECT id, name FROM jderby_derbies WHERE id=id";
  var params = [];

  if (options["params"]["onlyActive"]) {
    sql += " AND isActive=true";
  } // end if

  if (options["params"]["onlyPublic"]) {
    sql += " AND isPublic=true";
  } // end if

  if (options["params"]["onlyUnassigned"]) {
    sql += " AND jiveTenantID IS NULL";
  } // end if

  if (options["params"]["sort"]){
    sql += " ORDER BY name "+options["params"]["sort"];
  } // end if
  if (options["params"]["count"]) {
    sql += " LIMIT "+options["params"]["count"];
  } // end if

  dbQuery(sql,params).then(
    function(rs) {
      var data = [];
      if (rs.rows.length > 0) {
        rs["rows"].forEach(
          function(row) {
            nameCache[row["id"]] = row["name"];
            data.push({
              id : row["id"],
              name : row["name"]
            });
          } // end function
        );
      } // end if
      deferred.resolve(data);
    },
    function(err) {
      deferred.reject({ message : err["detail"], details : err });
    }
  );

  return deferred.promise;
};

DerbyHelper.getCachedName = function(derbyID) {
  return nameCache[derbyID];
};

//TODO: TRY TO INCORPORATE BACK INTO getDerby, BUT BE MINDFUL THAT WE DO NOT WANT ALL THIS EXTRA DETAIL FOR EXTERNAL CONSUMPTION, OR DO WE?
DerbyHelper.setJiveTenantDetails = function(derbyID,tenantId,contentURI,contentURL,placeURI,placeURL) {
  jive.logger.debug("Setting Jive Tenant Details...",derbyID,tenantId,contentURI,contentURL,placeURI,placeURL);
  var deferred = q.defer();

  //TODO: DATA VALIDATION

  var sql = "UPDATE jderby_derbies SET jiveTenantID=$2::text, jiveDocumentURI=$3::text, jiveDocumentURL=$4::text, jivePlaceURI=$5::text, jivePlaceURL=$6::text WHERE id=$1::text";
  var params = [derbyID,tenantId,contentURI,contentURL,placeURI,placeURL];

  dbQuery(sql,params).then(
    function(rs) {
      if (rs.rowCount === 1) {
        deferred.resolve();
      } else {
        deferred.reject({ status: 404, message : "Derby ["+derbyID+"] does not exist, unable to set Jive Tenant Details" });
      } // end if
    }, // end function
    function(err) {
      deferred.reject({ message : err["detail"], details : err });
    } // end function
  );

  return deferred.promise;
};

//TODO: TRY TO INCORPORATE BACK INTO getDerby, BUT BE MINDFUL THAT WE DO NOT WANT ALL THIS EXTRA DETAIL FOR EXTERNAL CONSUMPTION, OR DO WE?
DerbyHelper.getJiveTenantDetails = function(derbyID) {
  jive.logger.debug("Getting Jive Tenant Details...",derbyID);
  var deferred = q.defer();

  var sql = "SELECT row_to_json(d) as \"json\" FROM (SELECT jiveTenantID as \"tenantId\", jiveDocumentURL as \"url\", jiveDocumentURI as \"uri\", jivePlaceURI as \"placeURI\", jivePlaceURL as \"placeURL\" FROM jderby_derbies WHERE id=$1::text) as d";
  var params = [derbyID];

  dbQuery(sql,params).then(
    function(rs) {
      if (rs.rows.length === 1) {
        deferred.resolve(rs.rows[0]["json"]);
      } else {
        deferred.reject({ status: 404, message : "Derby ["+derbyID+"] does not exist, unable to get Jive Tenant Details" });
      } // end if
    }, // end function
    function(err) {
      deferred.reject({ message : err["detail"], details : err });
    } // end function
  );

  return deferred.promise;
} // end function

DerbyHelper.getDerby = function(derbyID,options) {
  jive.logger.debug("Getting Derby",derbyID,options["params"]);
  var deferred = q.defer();

  var sql = "SELECT id, name FROM jderby_derbies WHERE id=$1::text";
  var params = [derbyID];

  dbQuery(sql,params).then(
    function(rs) {
      if (rs.rows.length === 1) {
        nameCache[rs.rows[0]["id"]] = rs.rows[0]["name"];
        deferred.resolve({
          id : rs.rows[0]["id"],
          name : rs.rows[0]["name"]
        });
      } else {
        deferred.reject({ status: 404, message : "Derby ["+derbyID+"] does not exist" });
      } // end if
    }, // end function
    function(err) {
      deferred.reject({ message : err["detail"], details : err });
    } // end function
  );

  return deferred.promise;
};

DerbyHelper.getDerbySnapshot = function(derbyID,options) {
  //NOTE: WE DO NOT CURRENTLY SUPPORT DERBY OPTIONS
  jive.logger.debug("Getting Derby Snapshot",derbyID,options);
  return raceTimeHistory.getHistory(derbyID);
}

DerbyHelper.getDerbyStats = function(derbyID,options) {
  jive.logger.debug("Getting Derby Stats",derbyID,options);
  var deferred = q.defer();

  var date = options["params"]["date"];

  var sql = 'SELECT COUNT(DISTINCT r.id) as "numRaces", COUNT(DISTINCT rr.racerid) as "numRacers", MIN(rr.totalTimeSec) as "bestTimeSec" \
             FROM jderby_races r, jderby_results rr \
             WHERE r.id=rr.raceID \
             AND r.derbyid=$1::text \
             AND date_trunc(\'day\',r.timestamp) = $2 \
             AND rr.isActive=true';

  var params = [derbyID,date];

  dbQuery(sql,params).then(
    function(rs) {
      if (rs.rows.length == 1) {
        deferred.resolve(rs.rows[0]);
      } else {
        deferred.resolve({});
      } // end if
    }, // end function
    function(err) {
      deferred.reject({ message : err["detail"], details : err });
    } // end function
  );

  return deferred.promise;
};

module.exports = DerbyHelper;
