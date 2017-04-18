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
var raceMgr = require('./DerbyRaceHelper');

/*** NEED TO LOAD MODULE AND INIT ***/
var popularRaces = require('./tiles/PopularRaces');

var onCreateRaceTiles = [
  require('./tiles/RaceActivity'),
  require('./tiles/RacePhotos'),
  require('./tiles/TopRacers')
];

/**** NEEDS TO RUN AFTER THE WEBHOOK FIRES BACK TO US WITH THE CREATED CONTENT URL ****/
var onWebhookRaceTiles = [
  require('./tiles/RaceStats')
];

var JiveTileHelper = {};

jive.events.addLocalEventListener(config.events.DERBY_RACE_CREATED,
  function(raceResultData) {
    jive.logger.debug("***","Updating Remote Tile Data...");
    q.all(onCreateRaceTiles.map(function(tile) { tile.pushData(raceResultData) })).then(
      function() {
        jive.logger.debug("SUCCESS - Completed Post Race Tile Pushes Process(es)!");
      }, // end function
      function() {
        jive.logger.debug("ERROR - Pushing to Tiles!  See logs!");
      } // end function
    );
  } // end function
);

jive.events.addLocalEventListener(config.events.JIVE_EXTOBJECT_CREATED,
  function(data) {
    jive.logger.debug('****','TileListener','webhook-raceResultsCreated',data);
    var derbyID = data["derbyID"];
    var raceID = data["raceID"];
    raceMgr.getRace(derbyID,raceID,{}).then(
      function(raceResultData) {
        jive.logger.debug("***","Updating Remote Tiles Data from Webhook...");
        q.all(onWebhookRaceTiles.map(function(tile) { tile.pushData(raceResultData) })).then(
          function() {
            jive.logger.debug("SUCCESS - Completed Post Race Tile Pushes Process(es)!");
          }, // end function
          function() {
            jive.logger.debug("ERROR - Pushing to Tiles!  See logs!");
          } // end function
        );
      } // end function
    );
  } // end function
);

module.exports = JiveTileHelper;
