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

var GIFEncoder = require('gifencoder');
var fs = require('fs');
var q = require('q');
var util = require('util');
var RaceCamera = require("./lib/RaceCameraHelper");

var readFile = q.nfcall(fs.readFile,'jiveclientconfiguration.json','utf8');

readFile.then(
  function(data) {
    console.log('Loaded Config...');
    var config = JSON.parse(data);
    config = config["ext"];

    var camera = new RaceCamera(config);

    camera.setPhotoReadyHandler(
      function(photoData) {
        console.log('****','Received',photoData);
        var oldFileName = photoData["file"];
        var newFileName = __dirname+"/public/images/debug/gifencoder.gif";
        fs.unlink(newFileName,
          function(err) {
            fs.rename(oldFileName,newFileName,
              function(err2) {
                if (err2) {
                  console.log('*** ERROR MOVING FILE ****',err2);
                } else {
                  console.log('*** SUCCESS MOVING FILE ****',oldFileName,newFileName);
                } // end if
              } // end function
            );
          } // end function
        );
        setTimeout(process.exit,5000);
      } // end function
    );

    var raceID = new Date().getTime();
    var derby = { "id" : "debug", "name" : "Debug Race" };

    camera.start(derby,raceID);

  } // end function
);
