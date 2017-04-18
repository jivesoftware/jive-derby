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

var jive = require('jive-sdk'),
    q = require('q');
var path = require('path');
var lightTree = require('./lib/LightTreeHelper');
var gpio = require("rpi-gpio");
var fs = require('fs');

///////////////////////////////////////////////////////////////////////////////////////////////////
// Setup jive
var readFile = q.nfcall(fs.readFile,'jiveclientconfiguration.json','utf8');

readFile.then(
  function(data) {
    console.log('Loaded Config...');
    var config = JSON.parse(data);
    config = config["ext"];

    console.log('***',config);

    var irEnabled = false;
    var irSensorNames = {};
    var lightFunctions = ["red","yellow","green"];
    var lightChannelMap = {};

    //NOTE:  USE RPI PINS 36, 38 and 40 (GPIO) and 34 (Ground)
    console.log('Initializing Light Tree...');
    lightTree.init(gpio,config);

    config["ir-break-sensors"].forEach(
      function(irSensor,idx) {
        irEnabled = irEnabled || irSensor["enabled"];
        if (irSensor["enabled"]) {
          jive.logger.info("Initializing IR Break Sensor ...",irSensor["label"]);
          gpio.setup(irSensor["gpio-sensor-pin"],gpio.DIR_IN,gpio.EDGE_BOTH);
          irSensorNames[irSensor["gpio-sensor-pin"]] = irSensor;
          lightChannelMap[irSensor["gpio-sensor-pin"]] = lightFunctions[idx];
        } // end if
      } // end function
    );

    if (irEnabled) {
      gpio.on('change',
        function(channel,value) {
            jive.logger.info('IR Beam Broken',irSensorNames[channel]["label"],value);
            var lightColor = lightChannelMap[channel];
            if ("red" === lightColor) {
              lightTree.setRedState(value);
            } else if ("yellow" === lightColor) {
              lightTree.setYellowState(value);
            } else if ("green" === lightColor) {
              lightTree.setGreenState(value);
            } else {
              console.log('****','Unknown State, ignoring!!!!');
            } // end if
            if (irSensorNames[channel]["triggerCamera"]) {
                jive.logger.info('\t Photo Would Have Been Taken!');
            } // end if
        } // end function
      );
    } // end if


});
