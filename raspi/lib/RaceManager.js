'use strict';

var jive = require('jive-sdk');
var config = jive.service.options["ext"];
var db = jive.service.persistence();
var DerbyTimer = require('./DerbyTimer');
var SocketIo = require('./SocketIoHelper');
var gpio = require("rpi-gpio");
var extend = require('util')._extend;
var lightTree = require('./LightTreeHelper');
var RaceCamera = require('./RaceCameraHelper');

const RACE_STATUS_PENDING = "pending";
const RACE_STATUS_STARTED = "started";
const RACE_STATUS_FINISHED = "finished";

var RaceManager = function Constructor(config) {

  jive.logger.info("*****************************************");
  jive.logger.info("**** Jive Derby RaceManager Startup ****");
  jive.logger.info("*****************************************");

  var self = this;
  config = config || {};
  this.instanceID = new Date().getTime();
  this.lastRaceResults = null;
  this.lastRacePhoto = null;
  this.onResultsCallback = null;
  this.derby = null;
  this.maxLanes = config["defaults"]["maxLanes"] || 8;
  this.diagnosticMode = config["defaults"]["diagnosticMode"];

  function getProfileField(label,user) {
      if (user && user["jive"] && user["jive"]["profile"]) {
        var profileField = user["jive"]["profile"].filter(
          function(field) {
            return (field["jive_label"] === label);
          } // end function
        );
        if (profileField && profileField.length > 0) {
           return profileField[0]["value"];
        } // end if
      } // end if
      return null;
  } // end function

  function sendToResultHandler() {
    jive.logger.debug('Waiting for Result Handler to Finish...',self.lastRaceResults,self.lastRacePhoto);

    if (self.lastRaceResults && self.lastRacePhoto &&
        self.lastRaceResults["raceID"] === self.lastRacePhoto["raceID"]) {

        jive.logger.debug('Pushing Results & Image to Result Processor...');

        /**** ECHO RESULTS TO THE MANAGER WEB APP ****/
        SocketIo.sendRaceResults(self.lastRaceResults);

        if (self.onResultsCallback) {
          jive.logger.debug('Pushing Race Results Upstream for Processing ...');
          self.onResultsCallback({
            raceResults : self.lastRaceResults,
            photo : self.lastRacePhoto
          });
        } else {
          jive.logger.warn('No Results Callback Defined ... ignoring...');
        } // end if

        /*** CLEAR OUT THE LAST RACE RESULTS ***/
        self.lastRaceResults = null;
        self.lastRacePhoto = null;
    } // end if

  } // end function

  function timerResultListener(timerResults) {
    jive.logger.debug("Timer Results Received",timerResults);

    if (!self.isRaceActive()) {
      jive.logger.info("Received Results, but race not started, ignoring ...",timerResults);
      return;
    } // end if

    /*** MARK THAT WE RECEIVED FINAL RACE RESULTS, SO WE AREN'T ACTIVE WHILE PROCESSING ***/
    self.stopRace();

    var raceResults = {
      raceID : self.currentRaceID,
      timestamp : self.startTime.toISOString(),
      derby : self.getDerby(),
      splits : self.splits,
      results : [],
      diagnostic : self.diagnosticMode,
      measurements :  [
        {
          "type" : "distance",
          "value" : config["derby-timer"]["trackDistanceFt"],
          "unit" : "ft"
        }
      ]
    };

    /*** ADD TIMER DATA TO PAYLOAD ***/
    Object.keys(timerResults["results"]).forEach(
      function(key) {
        var laneResults = {
          lane : key.match(/\d+/)[0],
          totalTimeSec : timerResults["results"][key]["duration"],
          rank : timerResults["results"][key]["rank"],
          timestamp : timerResults["results"][key]["timestamp"],
          speed : (Math.round((config["derby-timer"]["trackDistanceFt"] / timerResults["results"][key]["duration"])*100)/100),

          /*** ADD RACER DATA TO PAYLOAD - EXPECTS JIVE API PERSON STRUCTURE ***/
          racer : {
            id : self.racerLanes[key]["id"],
            uri : self.racerLanes[key]["resources"]["self"]["ref"],
            profileURL : self.racerLanes[key]["resources"]["html"]["ref"],
            avatarURL : self.racerLanes[key]["resources"]["avatar"]["ref"],
            username : self.racerLanes[key]["jive"]["username"],
            name : self.racerLanes[key]["displayName"]
          }
        };
        if (config["jive"]["extendedProfileFields"]) {
          Object.keys(config["jive"]["extendedProfileFields"]).forEach(
            function(field) {
              laneResults["racer"][field] = getProfileField(config["jive"]["extendedProfileFields"][field],self.racerLanes[key]);
            } // end funtion
          );
        } // end if
        raceResults["results"].push(laneResults);
      } // end function
    );

    /**** SAVE FOR PICKUP BY sendToResultHandler *****/
    self.lastRaceResults = raceResults;
    sendToResultHandler();
  } // end function

  //*** OPTIONAL DEBUGGING TO DISABLE HARDWARE ***/
  if (config["derby-timer"]["enabled"]) {
    jive.logger.debug("Initializing Derby Timer...");
    this.derbyTimer = new DerbyTimer(config["derby-timer"],timerResultListener);
  } // end if

  // //*** OPTIONAL DEBUGGING TO DISABLE HARDWARE ***/
  jive.logger.debug("Initializing Race Camera ...");
  this.camera = new RaceCamera(config);
  this.camera.setPhotoReadyHandler(
    function(photo) {
      jive.logger.debug('Received Race Photo Data ...',photo["raceID"],photo);
      /**** SAVE FOR PICKUP BY sendToResultHandler *****/
      self.lastRacePhoto = photo;

      sendToResultHandler();
    } // end function
  );

  /*** INTIAILIZE GPIO IR BREAK BEAM SENSOR ***/
  //NOTE:  USE RPI PINS 1(3v3 Power), 3(Data), 5(Data, 2nd Beam) 6 (Ground)

  var irEnabled = false;
  var irSensorNames = {};

  config["ir-break-sensors"].forEach(
    function(irSensor) {
      irEnabled = irEnabled || irSensor["enabled"];
      if (irSensor["enabled"]) {
        jive.logger.info("Initializing IR Break Sensor ...",irSensor["label"]);
        gpio.setup(irSensor["gpio-sensor-pin"],gpio.DIR_IN,gpio.EDGE_BOTH);
        irSensorNames[irSensor["gpio-sensor-pin"]] = irSensor;
      } // end if
    } // end function
  );
  if (irEnabled) {
    gpio.on('change',
      function(channel,value) {
        var splitTimestamp = (new Date().getTime() - self.startTime.getTime())/1000;
        if (!value) {
          if (self.isRaceActive() && self.isFirstBeamBreak(channel)) {
            self.splits.push(splitTimestamp);
          } else {
            jive.logger.debug("","Race is not currently active, ignoring ...");
          } // end if
        } // end if
      } // end function
    );
  } // end if

  /*** INITIALIZE THE TREE LIGHT ***/
  //NOTE:  USE RPI PINS 36, 38 and 40 (GPIO) and 34 (Ground)
  lightTree.init(gpio);
} // end function

RaceManager.prototype.reset = function() {
  jive.logger.debug("Resetting for New Race...");
  this.racerLanes = {};
  var previousRaceID = this.currentRaceID;

  this.currentStatus = RACE_STATUS_PENDING;
  this.photoTaken = {};
  this.derbyTimer.reset();
  this.splits = [];
  this.beamBreaks = [];

  SocketIo.sendMessage("INFO","RaceManager Reset");

  lightTree.setYellowState(true);

} // end function

function startSequence(raceManager) {
  var firstInterval = 3000;
  var secondInterval = 2000;

  SocketIo.sendMessage("INFO","RaceManager Ready ... Starting Countdown!");
  setTimeout(
    function() {
      SocketIo.sendMessage("INFO","On your mark ... ");
      lightTree.setRedState(true,true);
      setTimeout(
        function() {
          SocketIo.sendMessage("INFO","Get set ... ");
          lightTree.setYellowState(true,true);
          /*** START THE CAMERA JUST A LITTLE EARLY TO CAPTURE THE RELEASE ***/
          setTimeout(
            function() {
              raceManager.camera.start(raceManager.derby,raceManager.currentRaceID);
            },
            (secondInterval - config["camera"]["tl"])
          );
          setTimeout(
            function() {
              SocketIo.sendMessage("INFO","Go!!!!!!!");
              lightTree.setGreenState(true);
              raceManager.derbyTimer.start(function() {
                raceManager.startTime = new Date();
                jive.logger.debug('*** Race Started @',raceManager.startTime);
              });
            },
            secondInterval
          );
        },
        firstInterval
      );
    },
    100
  );
} // end function

RaceManager.prototype.startRace = function() {
  this.currentRaceID = new Date().getTime();
  this.currentStatus = RACE_STATUS_STARTED;
  jive.logger.debug("Starting Race",this.currentRaceID,"...");

  startSequence(this);

  return this.currentRaceID;
} // end function

RaceManager.prototype.stopRace = function(errorDetected) {
  this.currentStatus = RACE_STATUS_FINISHED;

  /*** SET COLOR STATE ***/
  if (errorDetected) {
    SocketIo.sendMessage("INFO","RaceManager Stopped (w/Error!)");
    lightTree.setRedState(true);
  } else {
    SocketIo.sendMessage("INFO","RaceManager Stopped");
    lightTree.setYellowState(true);
  } // end if

  jive.logger.debug("Stopped Race",this.currentRaceID);
} // end function

RaceManager.prototype.isRaceActive = function() {
  return (this.currentStatus === RACE_STATUS_STARTED);
} // end function

RaceManager.prototype.isFirstBeamBreak = function(channel) {
    this.beamBreaks = this.beamBreaks || [];
    var isFirst = (this.beamBreaks.indexOf(channel) < 0);
    this.beamBreaks.push(channel);
    return isFirst;
} // end function

RaceManager.prototype.isPhotoTaken = function(channel) {
  return (this.photoTaken[channel]);
} // end function

RaceManager.prototype.isDiagnosticMode = function() {
  var self = this;
  return self.diagnosticMode;
} // end function

RaceManager.prototype.setDiagnosticMode = function(diagnosticMode) {
  jive.logger.debug("Setting Diagnostic Mode",diagnosticMode);
  var self = this;
  self.diagnosticMode = diagnosticMode;
  SocketIo.sendMessage("INFO","Set Diagnostic Mode ["+diagnosticMode+"]");
} // end function

RaceManager.prototype.getDerby = function() {
  return this.derby;
} // end function

RaceManager.prototype.setDerby = function(derby) {
  jive.logger.debug("Setting Derby",derby);
  this.derby = derby;
} // end function

RaceManager.prototype.getRacerByLane = function(laneNumber) {
  var self = this;
  if (self.racerLanes && laneNumber > 0 && laneNumber < self.maxLanes) {
    return self.racerLanes["L"+laneNumber];
  } else {
    jive.logger.debug("Invalid GetRacerByLane",laneNumber,self.maxLanes,self.racerLanes);
  } // end if
  return null;
} // end function

RaceManager.prototype.setRacerByLane = function(laneNumber,racer) {
  var self = this;
  if (laneNumber > 0 && laneNumber < self.maxLanes && racer) {
    this.racerLanes["L"+laneNumber] = racer;
  } else {
    jive.logger.debug("Invalid setRacerByLane Assignment",laneNumber,self.maxLanes,racer);
  } // end if
} // end function

RaceManager.prototype.getRacers = function() {
  var self = this;
  return self.racerLanes;
} // end function

RaceManager.prototype.setRacers = function(racers) {
  var self = this;

  if (racers && racers.length <= self.maxLanes) {
    self.racerLanes = {};
    racers.forEach(
      function(racer,idx,array) {
        self.racerLanes["L"+(idx+1)] = racer;
      } // end function
    );
    //console.log('****',self.racerLanes);
  } else {
    jive.logger.debug("Invalid Racers Object",racers,self.maxLanes,racers);
  } // end if
} // end function

RaceManager.prototype.setResultsCallback = function(callback) {
  this.onResultsCallback = callback;
} // end function

RaceManager.prototype.getInstanceID = function() {
  return this.instanceID;
} // end function

var instance = new RaceManager(config);

module.exports = instance;
