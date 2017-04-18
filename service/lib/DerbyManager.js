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
var q = require('q');
var s3 = require('./AwsS3Helper');
var iot = require('./AwsIotHelper');
var echo = require('./EchoHelper');
var tile = require('./JiveTileHelper');
var leaderboard = require('./DerbyLeaderboardHelper');
var race = require('./DerbyRaceHelper');
var racer = require('./DerbyRacerHelper');
var derbies = require('./DerbyHelper');
var gamification = require('./JiveGamificationHelper');

var DerbyManager = {};

/**********
* TODO: DOCUMENTATION
***********/
DerbyManager.createDerby = function(options) {
  return derbies.createDerby(options);
} // end function

/**********
* TODO: DOCUMENTATION
***********/
DerbyManager.getDerbies = function(options) {
  return derbies.getDerbies(options);
} // end function

/**********
* TODO: DOCUMENTATION
***********/
DerbyManager.getDerby = function(derbyID,options) {
  return derbies.getDerby(derbyID,options);
} // end function

//TODO:  MOVE ALL THIS AWS LAMBDA AT SOME POINT
function postRaceCreateAsync(options) {
  var isDiagnosticMode = options["data"]["diagnostic"];
  if (!isDiagnosticMode) {
    jive.logger.debug("Starting Post Race Create ASYNC",options["data"]["raceID"]);
    iot.getLatestEnvMeasurements(options)
      .then(leaderboard.updatePrimaryRecords)
      .then(
        function(options) {
          jive.events.emit(config.events.DERBY_RACE_CREATED,options["data"]);
          jive.logger.debug("Releasing Connection",options["data"]["raceID"]);
          options.db.releaseConnection();
          jive.logger.info("Completed Race Creation",options["data"]["raceID"],isDiagnosticMode);
        } // end function
      );
  } // end if
} // end function

DerbyManager.getDerbySnapshot = function(derbyID,options) {
  return derbies.getDerbySnapshot(derbyID,options);
} // end function

/******************************
* TODO: DOCUMENTATION
******************************/
DerbyManager.createRace = function(data,photo) {
  var options = {
    "data" : data,
    "photo" : photo
  };

  var deferred = q.defer();

  //*** SAVE RACE PHOTO FIRST SO WE CAN GET AN S3 URL ***
  s3.saveRacePhoto(options)
    //TODO: CONFIRM PERFORMANCE OF AWS IOT ... PERHAPS INCLUDE HER INLINE
    .then(racer.updateRacers)
    //TODO: CONFIRM PERFORMANCE OF AWS IOT ... PERHAPS INCLUDE HER INLINE
    .then(race.createRace)
    .then(
      function(options) {
        postRaceCreateAsync(options);
        deferred.resolve(options);
      }, // end function - success
      function(error) {
        deferred.reject(error);
      } // end function
    );

  return deferred.promise;
} // end function

/**********
* TODO: DOCUMENTATION
***********/
DerbyManager.getRaces = function(derbyID,options) {
  return race.getRaces(derbyID,options);
}; // end function

/**********
* TODO: DOCUMENTATION
***********/
DerbyManager.getRace = function(derbyID,raceID,options) {
  return race.getRace(derbyID,raceID,options);
}; // end function

/**********
* TODO: DOCUMENTATION
***********/
DerbyManager.toggleRaceResult = function(derbyID,raceID,racerID,options) {
  return race.toggleResult(derbyID,raceID,racerID,options);
}; // end function

/**********
* TODO: DOCUMENTATION
***********/
DerbyManager.getRacer = function(derbyID,racerID,options) {
  return racer.getRacer(derbyID,racerID,options);
}; // end function

/**********
* TODO: DOCUMENTATION
***********/
DerbyManager.updateRacer = function(derbyID,racerID,options) {
  return racer.updateRacer(derbyID,racerID,options);
}; // end function

/**********
* TODO: DOCUMENTATION
***********/
DerbyManager.getLeaderboard = function(derbyID,params,useCache) {
  return leaderboard.getLeaderboardData({
    id : derbyID,
    name : derbies.getCachedName(derbyID)
  },params,useCache);
} // end function

/**********
* TODO: DOCUMENTATION
***********/
DerbyManager.getLeaderboardMarkup = function(data,params) {
  return leaderboard.generateJiveContentMarkup(data,params);
} // end function

/**********
* TODO: DOCUMENTATION
***********/
DerbyManager.updateLeaderboardCache = function(derby) {
  return leaderboard.updateCaches(derby);
} // end function

/******************************
* TODO: DOCUMENTATION
******************************/
DerbyManager.setResultsCallbackEcho = function(derbyID,echoURL,httpVerb,securityHeader,securityToken,onlyLive,options) {
  return echo.saveClientDetails(derbyID,echoURL,httpVerb,securityHeader,securityToken,onlyLive,options);
}; // end function

module.exports = DerbyManager;
