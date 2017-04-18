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
var util = require('util');
var dbPool = require('./DbHelper')['pool'];
var dbQuery = require('./DbHelper')['query'];

var EchoHelper = {};

jive.events.addLocalEventListener(config.events.DERBY_RACE_CREATED,
  function(raceData) {
    jive.logger.debug("Pushing Results to Data Clients....");
    EchoHelper.pushResultsToClients(raceData)
    .then(
      function() {
        jive.logger.debug("Completed Post Race Creation Echo Process(es)!");
      },
      function(err) {
        jive.logger.warn('Unable to deactivate failing endpoints',err);
      }
    );
  } // end function
);

/******************************
* TODO: DOCUMENTATION
******************************/
function markBuggyEndPoint(derbyID,echoURL) {
  jive.logger.debug("Incrementing Fail Counts for Buggy End-Points...",derbyID,echoURL);

  var deferred = q.defer();

  var maxFailCount = config["defaults"]["echoClients"]["maxFailCount"] || 3;

  var sql_increment = "UPDATE jderby_result_echo SET active=(failCount <= $3::int), lastFailTimestamp=now(), failCount=(failCount+1) WHERE derbyID=$1::text AND echoURL=$2::text";

  dbQuery(sql_increment,[ derbyID, echoURL, maxFailCount ]).then(
    function(rs) {
      deferred.resolve();
    },  // end function
    function(err) {
      deferred.reject({ message : err["detail"], details : err });
    } // end function
  );

  return deferred.promise;
} // end function

EchoHelper.saveClientDetails = function(derbyID,echoURL,httpVerb,securityHeader,securityToken,onlyLive,active,options) {
  var deferred = q.defer();

  var sql = "INSERT INTO jderby_result_echo AS de (derbyID,echourl,httpVerb,securityHeader,securityToken,onlyLive,active) \
                     VALUES($1::text, lower($2::text), upper($3::text), $4::text, $5::text, $6, $7) \
                     ON CONFLICT (derbyID,echourl) \
                     DO UPDATE SET failCount=0, active=$7, httpVerb=upper($3::text), securityheader=$4::text, securitytoken=$5::text, onlyLive=$6 \
                     WHERE de.derbyID=$1::text AND de.echourl=lower($2::text)";

  var params = [derbyID,echoURL.trim(),httpVerb.trim(),securityHeader.trim(),securityToken.trim(),onlyLive,active];

  dbQuery(sql,params).then(
    function(rs) {
      if (rs["rowCount"] === 1) {
        //TODO: CLEANUP
        deferred.resolve("OK");
      } else {
        deferred.resolve();
      } // end if
    }, // end function
    function(err) {
      deferred.reject({ message : err["detail"], details : err });
    } // end function
  );

  return deferred.promise;
} // end function

var RANDOM_RACERS_ARR = config["defaults"]["randomRacers"];

function getRandomRacers(arrLength) {

  var shuffle = function(array) {
    var i = 0, j = 0, temp = null;

    for (i = array.length - 1; i > 0; i -= 1) {
      j = Math.floor(Math.random() * (i + 1))
      temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    } // end for i

    /**** NEED TO INSURE THAT YOU HAVE AT-LEAST 2x # of Lanes ***/
    return array;
  } // end function

  return shuffle(RANDOM_RACERS_ARR).slice(0,arrLength);
} // end function

function scrubEchoPayload(raceData) {
  /*** CHECKING FOR CONFIGURED RANDOM RACERS, IF SO RANDOMIZING RACER PROFILES FOR ECHO CLIENTS ***/
  if (RANDOM_RACERS_ARR && RANDOM_RACERS_ARR.length > 0) {
    var randomRacers = getRandomRacers(raceData["results"].length);
    raceData["results"] = raceData["results"].map(
      function(result,idx) {
        return {
          lane : result["lane"],
          totalTimeSec : result["totalTimeSec"],
          speed : result["speed"],
          rank : result["rank"],
          racer : randomRacers[idx]
        };
      }
    ); // end function
  } // end if
  return raceData;
} // end function

/******************************
* TODO: DOCUMENTATION
******************************/
EchoHelper.pushResultsToClients = function(data) {
  //TODO: MOVE THIS TO LAMBDA AND PROCESS RESULTS WHEN DONE TO THE DATABASE

  var derbyID = data["derby"]["id"];
  var diagnosticMode = data["diagnostic"];
  var raceID = data["raceID"];

  var sql = "SELECT * FROM jderby_result_echo WHERE ACTIVE=true AND derbyID=$1::text";
  if (diagnosticMode) {
    sql += " AND onlyLive=false";
  } // end if
  sql += " ORDER BY failcount DESC";

  var deferred = q.defer();

  var endPointErrors = [];

  dbQuery(sql,[ derbyID ]).then(
    function(rs) {

      jive.logger.debug("Echoing Race Data to Echo Clients",data["raceID"],rs["rowCount"]);

      var raceResultCopy = scrubEchoPayload(JSON.parse(JSON.stringify(data)));

      rs.rows.forEach(
         function(row,idx) {
           //TODO: WRAP INSIDE A TIMEOUT???
           var headers = {
             'Content-Type' : 'application/json'
           };

           //** ONLY ADD A SECURITY TOKEN IF SPECIFIED **
           if (row["securityheader"] && row["securitytoken"]) {
             headers[row["securityheader"]] = row["securitytoken"];
           } // end if

           jive.util.buildRequest(row["echourl"],row["httpverb"],raceResultCopy,headers).then(
             function(response) {
               jive.logger.debug("Successfully Posted Race Results",data["raceID"],"to",row["echourl"],"Response: ",response["statusCode"]);
             }, // end function
             function(error) {
               jive.logger.warn("Error Encountered Pushing to",row["echourl"]," ... will mark as buggy");
               markBuggyEndPoint(derbyID,row["echourl"]).then(
                 function() {
                   /*** ONLY RESOLVE ON THE LAST ONE ***/
                   if (idx === (rs.rows.length -1)) {
                     deferred.resolve();
                   } // end if
                 },
                 function(err) {
                  jive.logger.error('Unable to Mark as buggy',row["echourl"],err);
                  if (idx === (rs.rows.length -1)) {
                    deferred.resolve();
                  } // end if
                 }
               );
             } // end function
           );
         } // end function
      );
    }, // end function
    function(err) {
      jive.logger.warn('No Echo Clients Found',err);
      deferred.reject({ message : err["detail"], details : err });
    } // end function
  );

  return deferred.promise;
} // end function


module.exports = EchoHelper;
