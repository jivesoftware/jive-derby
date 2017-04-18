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
var _ = require("underscore");
var dbQuery = require('../DbHelper')['query'];
var derbies = require('../DerbyHelper');

var TileHelper = {};

const _TILE = config["jive"]["tiles"]["topRacers"];

var LAST_TOP_10_THRESHOLD = null;

function buildData(data,topRacers,details) {
  //console.log('****',data,topRacers,details);
  /*** DO NOT UPDATE IF THERE ARE NO RACE STATS ***/
  if (!topRacers || topRacers.length < 1) {
    return null;
  } // end if

  var tileData = {
    data: {
      "title": util.format(_TILE["title"],data["derby"]["name"]),
      "contents": topRacers,
      "config" : {
        "listStyle" : "peopleList"
      }
    }
  };
  if (details && details["uri"]) {
    tileData["data"]["action"] = {
        "text" : _TILE["viewFullLeaderboardLbl"],
        //*** NOTE:  UNCOMMENT TO GO BACK TO TILE ACTION (LIMITED WIDTH, WILL NEED TO RETHINK THE LEADERBOARD TEMPLATE)
        //"context" : { leaderboardURI : details["uri"] }
        "url" : details["url"]
    };
  } // end if
  return tileData;
} // end function

function getTopRacers(data) {
  var derbyID = data["derby"]["id"];

  jive.logger.debug('getTopRacers',derbyID);

  if (LAST_TOP_10_THRESHOLD) {
    var results = data["results"].filter(
        function(result) {
          return (result["totalTimeSec"] <= LAST_TOP_10_THRESHOLD);
        } // end function
    );
    if (results.length < 1) {
      jive.logger.debug('No results in current race are less than last known threshold, not pushing new instance');
      return q.fcall(function() { return null; });
    } // end if
  } // end if

  return dbQuery(_TILE["topRacersSQL"],[ derbyID , _TILE["maxRacers"] ]).then(
    function(rs) {
      if (rs.rows.length > 0) {
        return rs.rows.map(
          function(data) {
            LAST_TOP_10_THRESHOLD = Math.min(data["fastestTimeSec"],LAST_TOP_10_THRESHOLD);
            return {
              icon : data["avatarURL"],
              text : data["racerName"],
              userID : data["racerID"],
              linkDescription : util.format(_TILE["fastestTimeLbl"],data["fastestTimeSec"]),
        		  linkMoreDescription : util.format(_TILE["numRacesLbl"],data["numRaces"]),
        		  action : { url : data["profileURL"] }
        		};
          } // end function
        );
      } // end if
    }
  );
} // end function

TileHelper.pushData = function(data) {
  var derbyID = data["derby"]["id"];

  var deferred = q.defer();

  /**** IGNORE DIAGNOSTIC DATA ***/
  var isDiagnosticMode = data["diagnostic"];
  if (isDiagnosticMode) {
    deferred.resolve();
    return deferred.promise;
  } // end if

  /*** RACERS TO LIST FOR DERBY ***/
  getTopRacers(data).then(
    function(topRacers) {
      if (topRacers) {
        /*** RACERS TO LIST FOR DERBY ***/
        jive.tiles.findByDefinitionName(_TILE["name"]).then(
            function(instances) {
              if (instances && instances.length > 0) {
                q.all(instances.map(
                  function(tileInstance) {
                    var tileConfig = tileInstance['config'];
                    if (tileConfig["derbyID"] && tileConfig["derbyID"] === derbyID) {
                      derbies.getJiveTenantDetails(derbyID).then(
                        function(details) {
                          var tileData = buildData(data,topRacers,details);
                          if (tileData) {
                            return jive.tiles.pushData(tileInstance,tileData);
                          } else {
                            jive.logger.debug("IGNORE - No TileInstance Data Provided for this Configured TopRacers Tile!",tileInstance["id"],derbyID);
                          } // end if
                        } // end function
                      );
                    } else {
                      jive.logger.debug("IGNORE - TopRacers TileInstance Not Configured for This Derby!",tileInstance["id"],derbyID);
                    } // end if
                    return q.fcall(function() { });
                  })
                ).then(
                  function() {
                    jive.logger.debug("SUCCESS - Completed TopRacers ALL Tile Pushes!");
                    deferred.resolve();
                  }, // end function
                  function() {
                    jive.logger.debug("ERROR - Pushing TopRacers to Tile Instances!  See logs!");
                    deferred.reject();
                  } // end function
                );
              } else {
                jive.logger.debug("No jive tile instances found to push TopRacers data");
                deferred.resolve();
              } // end if
            } // end function
          );
      } else {
        jive.logger.debug("No Top Racers Found",derbyID);
        deferred.resolve();
      } // end if
    } // end function
  );

  return deferred.promise;
} // end pushData

module.exports = TileHelper;
