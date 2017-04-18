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

var TileHelper = {};

const _TILE = config["jive"]["tiles"]["raceStats"];

function buildData(data,raceStats) {
  var derbyID = data["derby"]["id"];
  var derbyName = data["derby"]["name"];

  /*** DO NOT UPDATE IF THERE ARE NO RACE STATS ***/
  if (!raceStats) {
    return null;
  } // end if

  var tileData = {
    data: {
      "title": util.format(_TILE["title"],derbyName),
      "contents": [
        {
          "name" : _TILE["labels"]["derby"],
          "value" : derbyName
        },
        {
          "name" : _TILE["labels"]["numRaces"],
          "value" : raceStats["numRaces"]
        },
        {
          "name" : _TILE["labels"]["numRacers"],
          "value" : raceStats["numRacers"]
        },
        {
          "name" : _TILE["labels"]["fastestTimeSec"],
          "value" : util.format(_TILE["timeStatValue"],raceStats["fastestTimeSec"])
        },
        {
          "name" : _TILE["labels"]["averageTimeSec"],
          "value" : util.format(_TILE["timeStatValue"],raceStats["averageTimeSec"])
        },
        {
          "name" : _TILE["labels"]["lastRace"],
          "value" : _TILE["labels"]["lastRaceLink"],
          "url" : raceStats["lastRace"]
        }
      ],
      "action" : {
        "text" : _TILE["labels"]["actionLink"],
        "context" : {
          derby : data["derby"]
        }
      }
    }
  };
  if (raceStats["leaderboardURL"]) {
    tileData["data"]["contents"].push({
      "name" : _TILE["labels"]["leaderboard"],
      "value" : _TILE["labels"]["leaderboardLink"],
      "url" : raceStats["leaderboardURL"]
    });
  } // end if
  return tileData;
} // end function

function getRaceStats(derbyID) {
  jive.logger.debug('getRaceStats',derbyID);

  return dbQuery(_TILE["sql"]["getRaceStats"],[derbyID]).then(
    function(rs) {
      if (rs.rowCount === 1) {
        //TODO: CONSIDER MOVING THIS TO THE WEBHOOK RESPONSE, SO WE HAVE THE PROPER lastRaceURL FOR THIS ITERATION, AS IT STANDS WE WILL BE 1 BACK
        return {
          "numRaces" : rs.rows[0]["numRaces"],
          "numRacers" : rs.rows[0]["numRacers"],
          "fastestTimeSec" : rs.rows[0]["fastestTimeSec"],
          "averageTimeSec" : rs.rows[0]["averageTimeSec"],
          "lastRace" : rs.rows[0]["lastRaceURL"],
          "leaderboardURL" : rs.rows[0]["leaderboardURL"]
        };
      } // end if
    }, // end function
    function(err) {
      jive.logger.warn("Error Processing Derby Stats",err);
      return null;
    } // end function
  );
} // end function

TileHelper.pushData = function(data) {
  var derbyID = data["derby"]["id"];

  var deferred = q.defer();

  /*** RACE STATS TO LIST FOR DERBY ***/
  getRaceStats(derbyID).then(
    function(raceStats) {
      /*** RACE STATS TO LIST FOR DERBY ***/
      jive.tiles.findByDefinitionName(_TILE["name"]).then(
          function(instances) {
            if (instances && instances.length > 0) {
              q.all(instances.map(
                function(tileInstance) {
                  //TODO: ADD IN TILE CONFIG FILTERS
                  var tileConfig = tileInstance['config'];
                  if (tileConfig["derbyID"] && tileConfig["derbyID"] === derbyID) {
                    var tileData = buildData(data,raceStats);
                    if (tileData) {
                      return jive.tiles.pushData(tileInstance,tileData);
                    } else {
                      jive.logger.debug("IGNORE - No TileInstance Data Provided for this Configured RaceStats Tile!",tileInstance["id"],derbyID);
                    } // end if
                  } else {
                    jive.logger.debug("IGNORE - RaceStats TileInstance Not Configured for This Derby!",tileInstance["id"],derbyID);
                  } // end if
                  return q.fcall(function() { });
                })
              ).then(
                function() {
                  jive.logger.debug("SUCCESS - Completed RaceStats ALL Tile Pushes!");
                  deferred.resolve();
                }, // end function
                function() {
                  jive.logger.debug("ERROR - Pushing RaceStats to Tile Instances!  See logs!");
                  deferred.reject();
                } // end function
              );
            } else {
              jive.logger.debug("No jive tile instances found to push RaceStats data");
              deferred.resolve();
            } // end if
          } // end function
        );
    } // end function
  );

  return deferred.promise;
} // end pushData

module.exports = TileHelper;
