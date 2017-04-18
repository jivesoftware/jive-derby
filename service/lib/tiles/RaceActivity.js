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
var _ = require("underscore");
var derbies = require('../DerbyHelper');

var TileHelper = {};

const _TILE = config["jive"]["tiles"]["raceActivity"];

jive.events.registerEventListener(jive.constants.globalEventNames.NEW_INSTANCE,
  function(tileInstance) {
    if (tileInstance["name"] === _TILE["name"]) {
      mapDerbyToJiveTenant(tileInstance,true);
    } // end if
  }, // end function
  { "description" : "Jive Derby - Activity Stream Bind Derby to TenantID" }
);

jive.events.registerEventListener(jive.constants.globalEventNames.INSTANCE_REMOVED,
  function(tileInstance) {
    if (tileInstance["name"] === _TILE["name"]) {
      mapDerbyToJiveTenant(tileInstance,false);
    } // end if
  }, // end function
  { "description" : "Jive Derby - Activity Stream UNbind Derby from TenantID" }
);

function mapDerbyToJiveTenant(tileInstance,doAddMapping) {
  jive.logger.debug("(Un)mapping Derby to Tenant from TileInstance");
  var tenantID = (doAddMapping) ? tileInstance["tenantId"] : null;
  var derbyID = tileInstance["config"]["derbyID"];
  var placeURI = (doAddMapping) ? tileInstance["config"]["parent"] : null;
  jive.logger.debug('****',tileInstance,doAddMapping,tenantID,derbyID,placeURI);
  derbies.setJiveTenantDetails(derbyID,tenantID,null,null,placeURI,null).then(
    function() {
      jive.logger.debug("Successfully (Un)mapped Derby to TenantID",tenantID,derbyID,doAddMapping);
    },
    function(error) {
      jive.logger.error("ERROR, While unmapping Derby from TenantID",tileInstance["guid"],tenantID,derbyID,doAddMapping,error);
    }
  );
} // end function

TileHelper.pushData = function(data) {
  jive.logger.debug("Pushing Jive Derby Race Activity",data["raceID"]);

  var derbyID = data["derby"]["id"];
  var raceID = data["raceID"];
  var isDiagnosticMode = data["diagnostic"];

  jive.extstreams.findByDefinitionName(_TILE["name"])
  .then(
    function(targetInstances) {
      if (targetInstances && targetInstances.length > 0) {
        targetInstances.forEach(
          function(instance) {
            var tileConfig = instance['config'];
            if (tileConfig["derbyID"] === derbyID) {
              if (!isDiagnosticMode || (!tileConfig["onlyLive"] && isDiagnosticMode)) {
                return jive.extstreams.pushActivity(instance,buildRaceResultActivity(instance,data));
              } // end if
            } else {
              jive.logger.info("Instance",instance["id"],"is not configured for this race result",derbyID,isDiagnosticMode);
            } // end if
          } // end for
        );
      } else {
        jive.logger.debug('No target tile instances found, ignoring Race Activity push...');
      } //end if
    } // end function
  );
} // end pushData

/******************************
* TODO: DOCUMENTATION
******************************/
function buildActivityDescription(tileInstance,raceResults,winner) {

  /*** ARE THESE RACE RESULTS BOUND TO THE SAME JIVE COMMUNITY AS THIS TILE? ***/
  var isRemoteTile = (winner["racer"]["profileURL"].indexOf(tileInstance["jiveCommunity"]) < 0);
  /*** FIND LIST OF OTHER RACERS, NON WINNERS ***/
  var otherRacers = raceResults["results"].filter(
      function(result) {
        return result["racer"]["id"] !== winner["racer"]["id"];
      } // end function
  );

  /*** CONSTRUCT A SUFFIX OF @mentions FOR THE DESCRIPTION ***/
  var descriptionText = "";
  if (otherRacers && otherRacers.length > 0) {
    descriptionText = " with ";

    otherRacers.forEach(
      function(result,idx,arr) {
        if (isRemoteTile) {
          /*** DO SIMPLE NAMES WITHOUT @MENTIONS ***/
          descriptionText += result["racer"]["name"];
        } else {
          /*** DO @MENTIONS SINCE WE KNOW ITS THE SAME INSTANCEcd  ***/
          descriptionText += util.format(
            _TILE["mentionTemplate"],
            result["racer"]["id"],
            result["racer"]["profileURL"],
            result["racer"]["name"]
          );
        } // end if

        /*** IF 3 or more OTHER RACERS, USE COMMA SERIES ***/
        if (arr.length > 2) {
          if (idx === (arr.length - 2)) {
            descriptionText += " and ";
          } else if (idx < (arr.length - 2)) {
            descriptionText += ", ";
          } // end if
        } else {
          /*** IF ONLY 2 USE ONLY AN AMPERSAND ***/
          if (idx !== arr.length -1) {
            descriptionText += " &amp; ";
          } // end if
        } // end if
      } // end function
    ); // end forEach
  } // end if

  return util.format(
            _TILE["description"],
            winner["racer"]["name"],
            descriptionText
          );
} // end function

function buildRaceResultActivity(tileInstance,raceResults) {

    var winner = raceResults["results"].filter(
        function(result) {
          return result["rank"] === 1;
        } // end function
    )[0];

    var activityDescription = buildActivityDescription(tileInstance,raceResults,winner);

    return {
        "activity": {
            "action": {
                "name": "posted",
                "description": "Jive Derby Race Results",
            },
            //TODO: "email" try to avoid capturing email, if not ... then remove "actor"
            "actor": {
                "id" : winner["racer"]["id"],
                "name": winner["racer"]["name"],
                "jive" : { "username" : winner["racer"]["username"] }
            },
            "object": {
                "type": "website",
                "url" : "https://developer.jivesoftware.com",
                "hideGoToItem" : true,
                "image": _TILE["icons"]["icon128"],
                "title": util.format(
                          _TILE["title"],
                          //TODO:  ADD IN RACE NAME
                          raceResults["derby"]["name"],
                          raceResults["raceID"]
                         ),
                //TODO:  UPDATE TO INCLUDE AN @MENTION TO THE USER IN THE DESCRIPTION
                "description": activityDescription
            },
            "jive" : {
              "app" : {
                "appUUID" : config["jive"]["app"]["uuid"],
                "view" : config["jive"]["app"]["views"]["activity"],
                "context" : _.omit(raceResults,"photo")
              }
            },
            "externalID": util.format(
                      _TILE["externalID"],
                      raceResults["derby"]["id"],
                      raceResults["raceID"]
                     )
        }
    };
} // end function

module.exports = TileHelper;
