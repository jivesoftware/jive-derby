'use strict';

var jive = require('jive-sdk');

var RESET_LIGHTS = {
  "red" : false,
  "yellow" : false,
  "green" : false
};

var LightTreeHelper = function Constructor() {
  this.currentInterval = null;
  this.currentTimeout = null;
  this.currentState = null;

  this.setLightStates = function(lightStates,blink) {
    var self = this;

    if (blink && self.currentState) {
      self.currentState = null;
    } else {
      self.currentState = lightStates;
    }// end if

    Object.keys(RESET_LIGHTS).forEach(
      function(color) {
        var pin = self.config["ryg-light-tree"]["light-pins"][color];
        var state = RESET_LIGHTS[color];
        if (self.currentState && lightStates.hasOwnProperty(color)) {
          state = lightStates[color]
        } // end if
        //jive.logger.debug("Setting",color,"on pin",pin,"to",state);
        self.gpio.write(pin,state);
      } // end function
    );
  } // end function

  this.scheduleLightReset = function(timeout) {
    var self = this;

    if (timeout > 0) {
      this.currentTimeout = setTimeout(
        function() {
          if (self.currentInterval) {
            clearInterval(self.currentInveral);
          } // end if
          self.setLightStates(RESET_LIGHTS);
        },
        self.config["ryg-light-tree"]["defaultTimeout"]
      );
    } // end if
  } // end function

} // end function - Constructor

LightTreeHelper.prototype.init = function(gpio,config) {
  var self = this;
  self.config = config || jive.service.options["ext"];

  if (self.config["ryg-light-tree"]["enabled"]) {
    self.gpio = gpio;

    Object.keys(self.config["ryg-light-tree"]["light-pins"]).forEach(
      function(key) {
        var pin = self.config["ryg-light-tree"]["light-pins"][key];

        //jive.logger.debug("Setting",key,"light to pin",pin);
        self.gpio.setup(self.config["ryg-light-tree"]["light-pins"][key],self.gpio.DIR_OUT,
          function() {
            self.gpio.write(self.config["ryg-light-tree"]["light-pins"][key],false);
          }
        );
      } // end function
    );
  } else {
    jive.logger.debug("LightTreeHelper is disabled, ignoring init ...");
  } // end if
} // end function

LightTreeHelper.prototype.setRedState = function(state,blink,timeout) {
  this.setTreeState({"red" : true, "yellow" : false, "green" : false }, blink, timeout);
} // end function

LightTreeHelper.prototype.setYellowState = function(state,blink,timeout) {
  this.setTreeState({"red" : false, "yellow" : true, "green" : false }, blink, timeout);
} // end function

LightTreeHelper.prototype.setGreenState = function(state,blink,timeout) {
  this.setTreeState({"red" : false, "yellow" : false, "green" : true }, blink, timeout);
} // end function

LightTreeHelper.prototype.setTreeState = function(lightStates,blink,timeout) {
  var self = this;
  timeout = timeout || this.config["ryg-light-tree"]["defaultTimeout"];

  /*** AT THE BASE OF EVERY OPERATION CLEAR THINGS OUT ***/
  if (this.currentInterval) {
    clearInterval(this.currentInterval);
    self.currentInterval = null;
    clearTimeout(this.currentTimeout);
    self.currentTimeout = null;
  } // end if

  if (blink) {
    jive.logger.debug("Setting Lights to BLINK",lightStates);
    self.setLightStates(lightStates);
    self.currentInterval = setInterval(
      function() {
        self.setLightStates(lightStates,blink);
      },
      self.config["ryg-light-tree"]["blinkInterval"]
    );
    self.scheduleLightReset(timeout);
  } else {
    jive.logger.debug("Setting Lights to ON",lightStates);
    self.setLightStates(lightStates);
    self.scheduleLightReset(timeout);
  } // end if

} // end function

var instance = new LightTreeHelper();

module.exports = instance;
