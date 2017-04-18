'use strict';

var jive = require('jive-sdk');
var config = jive.service.options["ext"];
var RaceManager = require('./RaceManager');
var request = require('request');
//var os = require('os');
//var interfaces = os.networkInterfaces();
var ip = require('ip');

var RaceAdmin = {};

RaceAdmin.startRaceUI = function(req,res,next) {
    var lanes = [];
    var maxLanes = config["defaults"]["maxLanes"];
    for (var x=1; x<=maxLanes; x++) {
      lanes.push(x);
    } // end for x

    // var addresses = [];
    // Object.keys(interfaces).forEach(
    //   function (ifname) {
    //     ifaces[ifname].forEach(
    //       function (iface) {
    //         if ('IPv4' !== iface.family || iface.internal !== false) {
    //           addresses.push(iface);
    //         } // end if
    //       } // end function
    //     );
    //   } // end function
    // );

    res.render('../../templates/race-manager.html',{
      lanes : lanes,
      maxLanes : maxLanes,
      derby : config["derby"],
      diagnosticMode : config["defaults"]["diagnosticMode"],
      proxyURL : config["defaults"]["cloudServiceURL"],
      jiveTenantID : config["jive"]["tenantID"],
      ipAddress : ip.address(),
      host : jive.service.options.clientUrl
    });
  } // end function

RaceAdmin.startRace = function(req,res,next) {
    //TODO: VALIDATION AND ERROR CHECKING

    var racers = req.body["racers"];
    var derby = req.body["derby"];
    var diagnosticMode = (req.body.hasOwnProperty('diagnosticMode')) ? ('true' === req.body.diagnosticMode) : true;
    RaceManager.reset();
    RaceManager.setDerby(derby);
    RaceManager.setRacers(racers);
    RaceManager.setDiagnosticMode(diagnosticMode);
    var raceID = RaceManager.startRace();
    jive.logger.info('adminUI','startRace',raceID,racers);
    res.json({
      id: raceID,
      diagnosticMode: diagnosticMode,
      derby : derby,
      racers: racers
    });
  } // end function

RaceAdmin.resetRace = function(req,res,next) {
    //TODO: VALIDATION AND ERROR CHECKING
    RaceManager.reset();
    res.json({});
  } // end function

RaceAdmin.saveDerby = function(req,res,next) {
  var derby = req.body;
  var requestData = {
    url: config["defaults"]["cloudServiceURL"] + "/api/derby",
    json: derby
  };

  /*** ADD SECURITY HEADER ***/
  var securityHeader = config["security"]["remote"]["header"];
  requestData["headers"] = {};
  requestData["headers"][securityHeader] = config["security"]["remote"]["value"];

  /*** SENDING TO SERVICE ***/
  request.post(requestData, function (err, httpResponse, body) {
    if (err) {
      jive.logger.error("Error updating derby details",derby,httpResponse,err);
      res.status(500).end();
      next();
    } else {
      jive.logger.info("Successfully updated derby details",derby);
      res.status(200).end();
    }// end if
  });
} // end function

module.exports = RaceAdmin;
