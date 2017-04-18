'use strict';

var jive = require('jive-sdk');
var config = jive.service.options["ext"];
var Thunderboard = require('thunderboard-ble');
var RaceManager = require('./RaceManager');
var lightTree = require('./LightTreeHelper');
var AwsIot = require('./AwsIotHelper');
var fs = require('fs');
var request = require('request');

function resetRace(delayMs) {
  if (delayMs) {
    setTimeout(
      function() {
        RaceManager.reset();
      }, // end function
      delayMs
    );
  } else {
    RaceManager.reset();
  } // end if
} // end function

function raceResultListener(data) {
  jive.logger.debug("***","Results Received",data);


  var results = data["raceResults"];
  var photoPath = data["photo"]["file"];

  lightTree.setYellowState(true,true);

  var formData = {
    raceData: JSON.stringify(results),
    racePhoto: fs.createReadStream(photoPath)
  };

  var requestData = {
    url: config["defaults"]["cloudServiceURL"] + "/api/races",
    formData: formData
  };

  /*** ADD SECURITY HEADER ***/
  var securityHeader = config["security"]["remote"]["header"];
  requestData["headers"] = {};
  requestData["headers"][securityHeader] = config["security"]["remote"]["value"];

  /*** SENDING TO SERVICE ***/
  request.post(requestData, function (err, httpResponse, body) {
    if (err) {
      jive.logger.error("Error submitting race results",results["raceID"],httpResponse,err);
      lightTree.setRedState(true,true);
    } else {
      lightTree.setGreenState(true,true);
      jive.logger.info("Successfully sent Race Results to Cloud",results["raceID"]);
      /**** REMOVE FILE FROM FILE-SYSTEM SINCE IT WAS SUCCESSFULLY STORED IN THE CLOUD ****/
      fs.unlink(photoPath);
    } // end if

    /*** DELAYING THE RESET ***/
    resetRace(5000);

  });

} // end function

exports.onBootstrap = function(app) {
  lightTree.setYellowState(true,true);

  jive.logger.info('Initializing Services ....');
  jive.logger.info('Setting Race Results Listener...');

  RaceManager.setResultsCallback(raceResultListener);

  /*** PUTTING IN A DELAY TO INSURE WE CAN SEE OTHER START UP STATS FIRST ***/
  resetRace(15000);

  jive.logger.info('Creating Derby Record...');

  if (config["derby"]["createOnStartup"]) {
    var requestData = {
      url: config["defaults"]["cloudServiceURL"] + "/api/derby",
      json : config["derby"]
    };
    /*** ADD SECURITY HEADER ***/
    var securityHeader = config["security"]["remote"]["header"];
    requestData["headers"] = {};
    requestData["headers"][securityHeader] = config["security"]["remote"]["value"];

    /*** SENDING TO SERVICE ***/
    request.post(requestData, function (err, httpResponse, body) {
      if (err) {
        lightTree.setRedState(true,true);
        jive.logger.error("Failed to POST Derby Details",err);
        return;
      } // end if
      lightTree.setGreenState(true,true);
      jive.logger.info("Successfully created Derby",config["derby"]["id"],config["derby"]["name"]);
    });
  } // end if

  var awsIot = new AwsIot(config["aws"]["iot"]["thing"]);

  var iotValues = {};
  var awsPushTimer = null;
  var thunderboard = new Thunderboard(config["iot-devices"],
    function(event) {
      jive.logger.debug("***",event["service"]["name"],event["characteristic"]["name"],event["value"]);

      var serv = event["service"]["name"];
      var char = event["characteristic"]["name"];

      iotValues[serv] = iotValues[serv] || {};
      iotValues[serv][char] = iotValues[serv][char] || {};

      iotValues[serv][char]["value"] = event["value"];
      iotValues[serv][char]["ts"] = new Date().getTime();

      if (awsPushTimer) {
        jive.logger.debug('***','Clearing existing timer, as there is more data to send');
        clearTimeout(awsPushTimer);
        awsPushTimer = null;
      } // end if

      if (!awsPushTimer) {
        awsPushTimer = setTimeout(
          function() {
            jive.logger.debug('***','Sending Data to AWS IoT',iotValues);
            awsIot.updateShadow(iotValues);
            awsPushTimer = null;
          }, // end function
          config["aws"]["iot"]["thing"]["options"]["pushDelayMs"]
        );
      } // end if
    }, // end function
    true
  );

};
