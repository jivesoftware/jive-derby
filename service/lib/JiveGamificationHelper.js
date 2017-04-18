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

var GamificationHelper = {};

//TODO: REFACTOR TO CONSTANT REFERENCE
jive.events.addLocalEventListener("derbyRace-created",
  function(data) {
    jive.logger.debug("Awarding Gamification for Racers...");

    //CHECK IF DIAGNOSTIC MODE OR NOT data["diagnosticMode"]

    // data["results"].forEach(
    //   function(result) {
    //     var racerID = result["racer"]["id"];
    //
    //     //TODO: IMPLEMENT YOUR GAMIFICATION LOGIC HERE
    //
    //   } // end function
    // );
  } // end function
);

module.exports = GamificationHelper;
