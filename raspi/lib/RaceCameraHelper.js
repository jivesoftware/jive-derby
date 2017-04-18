'use strict';

var jive = require('jive-sdk');
var RaspiCam = require("raspicam");
var GraphicsMagick = require('gm');
var fs = require('fs');
var q = require('q');
var util = require('util');

var RaceCamera = function Constructor(config) {
  var self = this;
  this.config = config;
  /*** ASSUMES 1-LEVEL OF DIRECTORY FOR NOW ***/
  this.imageDir = config["gifencoder"]["files"].substring(0,config["gifencoder"]["files"].indexOf('/',1));

  function getRaceImages(raceID) {
    var getImages = q.nfbind(fs.readdir);

    return getImages(self.imageDir).then(
      function(files) {
        var matcher = new RegExp(raceID+".+\."+self.config["camera"]["encoding"]+".*",'gi');
        var raceImages = [];
        files.forEach(
          function(file) {
            if (file.match(matcher)) {
              raceImages.push(self.imageDir+'/'+file);
            } // end if
          } // end funciton
        );
        return raceImages;
      }, // end function
      function (err) {
        jive.logger.debug('Unable to get Race Images',raceID,err);
        return [];
      } // end function
    );
  } // end function

  function cleanupFiles(files) {
    jive.logger.debug('Cleaning Up Camera Files...',self.imageDir);
    files.forEach(
      function(file) {
        jive.logger.debug('Removing Camera Still',file,'...');
        fs.unlink(file);
      } // end function
    );
  } // end function

  function onCameraComplete(cameraFinishedTimestamp) {
    jive.logger.debug("Starting GIF Generation...");
    var raceID = self.currentRaceID;
    var derby = self.currentDerby;
    var outputFileName = util.format(self.config["gifencoder"]["output"],raceID);

    var gif = GraphicsMagick();

    /*** ADD IMAGES TO ENCODER ***/
    getRaceImages(raceID).then(
      function(raceImages) {
        jive.logger.debug('****','Found',raceImages.length,'Race Images.');
        raceImages.forEach(
          function(raceImage) {
            gif.in(raceImage);
          } // end function
        );

        var imageLabel = self.config["gifencoder"]["label"];

        //TODO: LOOK INTO WHY LABEL IN THIS BLOCK ISN'T BEING PRINTED TO IMAGE
        if (imageLabel && imageLabel["enabled"]) {

          gif.coalesce();

          /*** ADD IN LABEL ***/
          var label = util.format(imageLabel["text"],
                      self.currentDerby["name"],
                      self.currentRaceID,
                      /*** QUICK HACK TO JUST FORMATTED TIME WITH MINUTES ****/
                      new Date().toISOString().replace('T',' ').substring(0,16)
                    );
          //gif.out('label:'+label);
          gif.label(label);

          if (imageLabel["gravity"]) {
            gif.gravity(imageLabel["gravity"]);
          } // end if

          if (imageLabel["font"]) {
            gif.font(imageLabel["font"]);
          } // end if

          if (imageLabel["fontColor"]) {
            gif.fill(imageLabel["fontColor"])
          } // end if

          if (imageLabel["fontSize"]) {
            gif.pointSize(imageLabel["fontSize"])
          } // end if

        } // end if

        if (self.config["gifencoder"]["repeat"] > 0) {
          /*** NUMBER OF ITERATIONS - 0 IS INFINITE ***/
          gif.loop(self.config["gifencoder"]["repeat"]);
        } // end if

        /*** SET GIF DELAY 100ths of SECOND INSTEAD OF MS ***/
        gif.delay(self.config["gifencoder"]["delay"]/10)

        /*** FINALLY OUTPUT THE FILE ***/
        .write(outputFileName,
          function(err) {
            if (err) {
              //TODO: CONSIDERING DOING A FAIL SAFE DEFAULT IMAGE
              throw err;
            } // end if

            var timeToCompleteSec = (new Date().getTime()-cameraFinishedTimestamp)/1000;
            jive.logger.debug('\t','GIF Finished',raceID,timeToCompleteSec,'seconds');

            /*** CLEAN UP RACE ID ***/
            self.currentRaceID = null;

            /*** NOTIFY LISTENERS ***/
            if (self.photoHandler && outputFileName) {
              var data = {
                file : outputFileName,
                raceID : raceID,
                derby : derby,
                ttcs : timeToCompleteSec
              };
              self.photoHandler(data);
            } // end if

            /**** CLEAN UP FILE SYSTEM ****/
            cleanupFiles(raceImages);

          } // end function
        ); // end write
      } // end function
    );
  } // end function

  this.raspicam = new RaspiCam(self.config["camera"]);
  this.raspicam.on('exit',onCameraComplete);
}; // end function

RaceCamera.prototype.setPhotoReadyHandler = function(photoHandler) {
  this.photoHandler = photoHandler;
} // end function

RaceCamera.prototype.start = function(derby,raceID) {
  this.currentDerby = derby;
  this.currentRaceID = raceID;
  /*** TRYING TO SINGLE SOURCE THE REAL VALUE ACROSS 2 DIFFERENT LIBRARIES ***/
  this.raspicam.set('output',util.format(this.config["gifencoder"]["files"],raceID).replace('??','%02d'));
  this.raspicam.start();
} // end function

module.exports = RaceCamera;
