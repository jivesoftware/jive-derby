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
var util = require('util');
var config = jive.service.options["ext"];
var desConfig = config["jive"]["des"];
var derbies = require('../DerbyHelper');

var TileHelper = {};

const _TILE = config["jive"]["tiles"]["popularRaces"];

function getAccessToken() {
    jive.logger.debug('getAccessToken');
    var deferred = q.defer();
    var loginURL = util.format(desConfig["loginURL"],desConfig["service"],desConfig["clientID"],desConfig["clientSecret"]);

    jive.util.buildRequest(loginURL,'POST').then(
      //*** SUCCESS ***
      function(response) {
        deferred.resolve(response['entity']['body'].toString('utf8'));   },
      //*** ERROR ***
      function(response) {  deferred.reject(response['entity']['error']);   }
    );
    return deferred.promise;
};

function getExportFilterDate() {
  /*** SUBTRACT 5 DAYS THEN WRAP IN A NEW DATE ***/
  return new Date(new Date().getTime()-(_TILE["lastNumberOfDays"]*1000*60*60*24)).toISOString();
} // end function

function processResults(derbyID,rawResults,processed) {
  jive.logger.debug('processResults',derbyID,(rawResults) ? rawResults.length : 0);
  processed ["derbyID"] = derbyID;
  processed["timestamp"] = new Date().getTime();
  processed["races"] = processed["races"] || {};
  rawResults.forEach(
    function(result) {
      var action = result["activity"]["action"];
      var objectURL = result["activity"]["actionObject"]["url"];
      var incrementor = _TILE["actionPoints"][action] || _TILE["actionPoints"]["Default"];

      /*** STRIP OUT COMMENT ANCHORS IF COMMENT/STRUCTURED OUTCOME ***/
      if (objectURL.indexOf('#') > -1) {
        objectURL = objectURL.substring(0,objectURL.indexOf('#'));
      } // end if

      processed["minTimestamp"] = (!processed["minTimestamp"]) ? result["timestamp"] : Math.min(processed["minTimestamp"],result["timestamp"]);
      processed["maxTimestamp"] = (!processed["maxTimestamp"]) ? result["timestamp"] : Math.max(processed["maxTimestamp"],result["timestamp"]);

      if (!processed["races"][objectURL]) {
        processed["races"][objectURL] = {
          url : objectURL,
          subject : result["activity"]["actionObject"]["subject"],
          totalScore : 0
        };
      } // end if

      processed["races"][objectURL]["totalScore"] += incrementor;

      /*** INCREMENT THE COUNT ***/
      processed["races"][objectURL][action] = ((processed["races"][objectURL][action] || 0) + 1);
    } // end function
  );
  return q.fcall(function() { return processed; });
} // end function

function getProcessedResults(derbyID,apiURL,accessToken,results) {
  jive.logger.debug('getProcessedResults',derbyID,apiURL);
  var deferred = q.defer();
  if (apiURL) {
    var headers = { Authorization : accessToken };
    jive.util.buildRequest(apiURL,'GET',null,headers,null).then(
      function(response) {
        processResults(derbyID,response['entity']['list'],results).then(
          function(processed) {
            if (response["entity"]["paging"]["next"]) {
              getProcessedResults(derbyID,response["entity"]["paging"]["next"],accessToken,processed).then(
                function(processed) {
                  deferred.resolve(processed);
                } // end function
              );
            } else {
              deferred.resolve(processed);
            } // end if
          } // end function
        );
      }
    );
  } // end if
  return deferred.promise;
} // end function

function getResults(derbyID) {
    return getAccessToken().then(
      function(accessToken) {
        return derbies.getJiveTenantDetails(derbyID).then(
          function(details) {
            jive.logger.debug('Received Derby Details',derbyID,details);
            var afterDate = getExportFilterDate();
            var exportFilter = util.format(_TILE["desExportFilter"],details["placeURL"],afterDate);
            var apiURL = util.format(desConfig["exportURL"],desConfig["service"],exportFilter);
            return getProcessedResults(derbyID,apiURL,accessToken,{});
          } // end function
        );
      } // end function
    );
} // end function

function buildData(derbyID) {
  return getResults(derbyID).then(
    function(results) {
      var raceURLs = Object.keys(results["races"]);
      if (raceURLs.length > 0) {
        /*** SORT THE DATA BY THE totalScore ***/
        raceURLs.sort(
          function(race1,race2) {
            return (results["races"][race1]["totalScore"] === results["races"][race2]["totalScore"]) ?  0 :
              (results["races"][race1]["totalScore"] < results["races"][race2]["totalScore"]) ? 1 : -1;
          } // end function
        );
        /*** SORT THE DATA BY THE totalScore ***/
        return q.fcall(
          function() {
            return {
              derbyID : derbyID,
              minTimestamp : results["minTimestamp"],
              maxTimestamp : results["maxTimestamp"],
              processedAt : results["timestamp"],
              status : "complete",
              races : raceURLs.map(
                        function(raceURL) {  return results["races"][raceURL];  }
                      ).slice(0,_TILE["maxRaceCount"])
            }
          });
      } else {
        return false;
      } // end if
    } // end function
  );
} // end function

TileHelper.pushData = function(derbyID) {
  var deferred = q.defer();

  buildData(derbyID).then(
    function(popularRaceData) {
      if (popularRaceData) {
        jive.tiles.findByDefinitionName(_TILE["name"]).then(
            function(instances) {
              if (instances && instances.length > 0) {
                q.all(instances.map(
                  function(tileInstance) {
                    var tileConfig = tileInstance['config'];
                    if (tileConfig["derbyID"] && tileConfig["derbyID"] === derbyID) {
                      return jive.tiles.pushData(tileInstance,{ data : popularRaceData });
                    } else {
                      jive.logger.debug("IGNORE - TileInstance Not Configured for This Derby!",tileInstance["id"],derbyID);
                    } // end if
                    return q.fcall(function() { });
                  })
                ).then(
                  function() {
                    jive.logger.debug("SUCCESS - Completed PopularRaces ALL Tile Pushes!");
                    deferred.resolve();
                  }, // end function
                  function() {
                    jive.logger.debug("ERROR - Pushing PopularRaces to Tile Instances!  See logs!");
                    deferred.reject();
                  } // end function
                );
              } else {
                jive.logger.debug("No jive tile instances found to push PopularRaces data");
                deferred.resolve();
              } // end if
            } // end function
          );
      } else {
        deferred.resolve();
      } // end if
    } // end function
  );

  return deferred.promise;
} // end function


TileHelper.calculatePopularRaces = function() {
  jive.logger.debug('Running Popular Races Calculation ...');

  var derbyIDs = [];

  jive.tiles.findByDefinitionName(_TILE["name"]).then(
    function(instances) {
      if (instances && instances.length > 0) {
        q.all(instances.map(
          function(tileInstance) {
            var derbyID = tileInstance["config"]["derbyID"];
            if (derbyID && derbyIDs.indexOf(derbyID) < 0) {
              derbyIDs.push(derbyID);
            } // end if
          })
        ).then(
          function(results) {
            if (derbyIDs.length > 0) {
              jive.logger.debug('Found Derbies to Calculate!',derbyIDs);
              derbyIDs.forEach(
                function(derbyID) {
                  TileHelper.pushData(derbyID);
                } // end function
              );
            } else {
              jive.logger.debug('No Derbies to Calculate, ignoring for now.');
            } // end if
          } // end function
        );
      } // end if
    } // end function
  );
} // end function

/*** SCHEDULE FUTURE RUNS ***/
setTimeout(
  function() {
    var task = new jive.tasks.build(
      TileHelper.calculatePopularRaces,
      _TILE["updateInterval"] || 600000,
      config.events.DERBY_POPULAR_RACE_CALCULATE
    );
    jive.tasks.schedule(task, jive.service.scheduler());
  },
  _TILE["startupDelay"] || 10000
);

module.exports = TileHelper;
