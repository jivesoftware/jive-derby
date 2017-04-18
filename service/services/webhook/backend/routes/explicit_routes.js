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
var jive = require('jive-sdk');

var config = jive.service.options["ext"];
var webhook = require('../../../../lib/JiveWebhookHelper');

exports.webhookActivityCallback = {
    'verb' : 'post',
    'path' : 'callback/:externalID*?',
    //TODO: VALIDATE JIVE HEADERS, OR CONFIRM NON-DEV MOVE IS WORKING WITH jiveLocked=true
    'jiveLocked' : true,
    'route': function(req,res,next) {
        /*** RESPOND FAST ***/
        res.status(200).end();

        var tenantID = req.headers["x-tenant-id"];
        jive.logger.debug('****','Received Webhook Data',tenantID,req.headers,req.body);

        /*** AND THEN PROCESS ASYNCHRONOUSLY ***/
        var data = req.body || [];
        data.forEach(
          function(activity) {
            //PROCESS ONLY JIVE DERBY EXT STREAM OBJECTS
            if (webhook.isDerbyActivity(activity)) {

              //PROCESS CREATES DIFFERENTLY THAN OTHER ACTIVITY
              if (activity["activity"]["verb"] === "jive:created") {
                  webhook.linkRaceExtObject(tenantID,activity).then(
                    function(data) {
                      jive.events.emit(config.events.JIVE_EXTOBJECT_CREATED,data);
                      jive.logger.info("Successfully linked race",activity["activity"]["object"]["id"]);
                    }, // end function
                    function(error) {
                      jive.logger.error("Unable to link race",activity["activity"]["object"]["id"],error);
                    } // end function
                  );
              } else {
                //TODO: PROCESS OTHER SOCIAL MARKERS ... TRENDING RACES TILE?
                jive.logger.debug("Ignoring Webhook Activity (TEMP)",
                                  activity["activity"]["verb"],
                                  activity["activity"]["object"]["id"]);
              } // end if
            } else {
                jive.logger.debug("Activity detected, but not Jive Derby",activity["activity"]["object"]);
            } // end if

          } // end function
        ); // end forEach
    } // end function
};
