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

const _TILE = config["jive"]["tiles"]["racePhotos"];

//TODO: MOVE TO A MOVE STRUCTURED NODE-CACHE
const LATEST_PHOTOS = {};
const MAX_PHOTOS = _TILE["maxPhotos"] || 10;

function buildData(tileInstance,details,data) {
  var derbyID = data["derby"]["id"];
  var derbyName = data["derby"]["name"];

  /*** DO NOT UPDATE IF THERE ARE NO PHOTOS FOR THE DERBY ***/
  if (!LATEST_PHOTOS[derbyID] || LATEST_PHOTOS[derbyID].length < 1) {
    return null;
  } // end if

  var tileData = {
    data: {
      "title": util.format(_TILE["title"],derbyName),
      "contents": [],
      "config" : {
          "disableFullScreenView" : _TILE["disableFullScreenView"] || false,
          "hideCaptions" : _TILE["hideCaptions"] || false,
          //TODO:  DOUBLE CHECK IF THIS CAN BE REMOVED ONCE displayWidth IS ADDED TO THE TILE DEFINITION
          "size" : _TILE["size"] || "narrow",
          "showAdditionalLink" : _TILE["showAdditionalLink"] || false
      }
    }
  };

  /*** ONLY ADD THE ACTION LINK IF THE TILE INSTANCE PLACE ISN'T THE SAME AS THE DERBY ***/
  if (tileInstance["config"]["parent"] !== details["placeURI"]) {
    tileData["data"]["action"] = {
      url : details["placeURL"]
    };
  } // end if

  LATEST_PHOTOS[derbyID].forEach(
    function(photoData) {
      tileData["data"]["contents"].push(photoData);
    } // end function
  );

  return tileData;
} // end function

function addRaceImage(data) {
  var derbyID = data["derby"]["id"];
  var derbyName = data["derby"]["name"];
  var photoURL = data["photoURL"];
  var raceID = data["raceID"];
  var winner = data["results"].filter(
      function(result) {
        return result["rank"] === 1;
      } // end function
  )[0];

  if (!LATEST_PHOTOS[derbyID]) {
    LATEST_PHOTOS[derbyID] = [];
  } // end if

  /*** PUSH TO THE BEGINNING OF THE ARRAY ***/
  var imageData = {
    "image": photoURL,
    "title": util.format(_TILE["imageTitle"],derbyName,raceID,winner["racer"]["name"],winner["totalTimeSec"])
  };
  /*** INSURE GALLERY CAPTION ISN'T TOO LONG ***/
  imageData["title"] = imageData["title"].substring(0,Math.min(_TILE["maxTitleLength"],imageData["title"].length));

  LATEST_PHOTOS[derbyID].unshift(imageData);

  /*** TRIM ARRAY TO MAX_PHOTOS LENGTH ***/
  if (LATEST_PHOTOS[derbyID].length > MAX_PHOTOS) {
    LATEST_PHOTOS[derbyID] = LATEST_PHOTOS[derbyID].slice(0,MAX_PHOTOS);
  } // end if

  jive.logger.debug("Added Derby Photo",derbyID,photoURL);
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

  /*** RACE IMAGE TO LIST FOR DERBY ***/
  addRaceImage(data);

  derbies.getJiveTenantDetails(derbyID)
  .then(
    function(details) {
      /*** RACE IMAGE TO LIST FOR DERBY ***/
      jive.tiles.findByDefinitionName(_TILE["name"]).then(
          function(instances) {
            if (instances && instances.length > 0) {
              q.all(instances.map(
                function(tileInstance) {
                  //TODO: ADD IN TILE CONFIG FILTERS
                  var tileConfig = tileInstance['config'];
                  if (tileConfig["derbyID"] && tileConfig["derbyID"] === derbyID) {
                    var tileData = buildData(tileInstance,details,data);
                    if (tileData) {
                      return jive.tiles.pushData(tileInstance,tileData);
                    } else {
                      jive.logger.debug("IGNORE - No Tile Instance Data Provided for this Configured Tile!",tileInstance["id"],derbyID);
                    } // end if
                  } else {
                    jive.logger.debug("IGNORE - TileInstance Not Configured for This Derby!",tileInstance["id"],derbyID);
                  } // end if
                  return q.fcall(function() { });
                })
              ).then(
                function() {
                  jive.logger.debug("SUCCESS - Completed RacePhotos ALL Tile Pushes!");
                  deferred.resolve();
                }, // end function
                function() {
                  jive.logger.debug("ERROR - Pushing RacePhotos to Tile Instances!  See logs!");
                  deferred.reject();
                } // end function
              );
            } else {
              jive.logger.debug("No jive tile instances found to push RacePhotos data");
              deferred.resolve();
            } // end if
          } // end function
        );
    } // end function
  );

  return deferred.promise;
} // end pushData

TileHelper.init = function() {
  jive.logger.debug('Initialzing Recent RacePhotos Tile Cache ...');
  dbQuery(config["sql"]["getActiveDerbies"],[]).then(
    function(derbies) {
      if (derbies.rows.length > 0) {
        derbies.rows.forEach(
          function(derby) {
            LATEST_PHOTOS[derby["id"]] = [];
            dbQuery(_TILE["init"]["sql"]["derbyPhotos"],[ derby["id"],_TILE["maxPhotos"]]).then(
              function(photos) {
                if (photos && photos.rows.length > 0) {
                  photos.rows.forEach(
                    function(data) {
                      /** MINIMAL RECREATION OF DATA FEED ***/
                      addRaceImage({
                        "derby" : {
                          "id" : derby["id"],
                          "name" : derby["name"]
                        },
                        "photoURL" : data["photoURL"],
                        "raceID" : data["raceID"],
                        "results" : [{
                          "racer" : { "name" : data["racerName"] },
                          "speed" : data["speed"],
                          "totalTimeSec" : data["totalTimeSec"],
                          "rank" : 1
                        }]
                      });
                    } // end function
                  ); // end forEach
                } // end if
              } // end function
            );
          } // end function
        ); // end forEach
      } // end if
    }
  );
} // end function

TileHelper.init();

module.exports = TileHelper;
