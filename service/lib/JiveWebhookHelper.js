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
var race = require('./DerbyRaceHelper');

var JiveWebhookHelper = {};

jive.events.registerEventListener(jive.constants.globalEventNames.INSTANCE_REMOVED,
  function(tileInstance) {
    if (tileInstance["name"] !== config["jive"]["tiles"]["raceActivity"]["name"]) {
      jive.logger.debug("Tile Instance Removed, but not Race Activity Tile, ignoring...",tileInstance["name"]);
      return;
    } // end if

    //*** REMOVE WEBHOOK FOR TILE PARENT PLACE
    jive.webhooks.findByTenantID(tileInstance["tenantId"]).then(
      function(webhooks) {
        webhooks = webhooks || [];
        webhooks.forEach(
          function(webhook) {
            if (webhook["entity"]["object"] === tileInstance["config"]["parent"]) {
              jive.webhooks.unregister(webhook).then(
                function() {
                  jive.logger.info("Successfully Removed Webhook",webhook["entity"]["resources"]["self"]["ref"]);
                }, // end function
                function(error) {
                  jive.logger.error("Error removing webhook",webhook["entity"]["resources"]["self"]["ref"],error);
                } // end function
              );
            } else {
              jive.logger.debug("Found Webhook",webhook["entity"]["resources"]["self"]["ref"],'but not matching parent place.');
            } // end if
          } // end if
        );
      } // end function
    );
  } // end function
);

jive.events.registerEventListener(jive.constants.globalEventNames.NEW_INSTANCE,
  function(tileInstance) {
    if (tileInstance["name"] !== config["jive"]["tiles"]["raceActivity"]["name"]) {
      jive.logger.debug("Tile Instance Added, but not Race Activity Tile, ignoring...",tileInstance["name"]);
      return;
    } // end if

    //NOTE:  PREVENT WEBHOOKS FROM BEING CREATED FOR NON-PRIMARY INSTANCES
    //TODO:  UPDATE MODEL TO SUPPORT MULTIPLE jiveURLs for RACE RESULTS (P3/P4 issue)
    if (tileInstance["tenantId"] !== config["jive"]["options"]["tenantID"]) {
      jive.logger.debug("Tile added to a non-primary Jive instance.  Ignoring addPlaceWebhook request.",tileInstance["name"],tileInstance["tenantId"]);
      return;
    } // end if

    //*** ADD WEBHOOK FOR TILE PARENT PLACE
    jive.webhooks.register(
      tileInstance["tenantId"],
      "extStreamActivity",
      tileInstance["config"]["parent"],
      util.format("%s/webhook/callback/place",jive.service.options["clientUrl"])
    ).then(
      function(success) {
        jive.logger.info("Successfully created Jive Derby content webhook",success['entity']);
      },
      function(error) {
        jive.logger.error("ERROR","Failed to create Jive Derby webhook",error);
      }
    );
  }
); // end function

JiveWebhookHelper.isDerbyActivity = function(webhookEvent) {
  //TODO:  BETTER WAY TO DO THIS...LOOK FOR A UUID IN THE PAYLOAD?
  return (webhookEvent && webhookEvent["activity"] &&
          webhookEvent["activity"]["generator"] &&
          webhookEvent["activity"]["generator"]["displayName"] === 'Jive Derby Integration');
} // end function

JiveWebhookHelper.linkRaceExtObject = function(tenantID,activity) {
  return jive.community.findByTenantID(tenantID).then(
    function(community) {
      if (community) {
        return jive.community.doRequest(community,{
           "url" : activity["activity"]["object"]["id"]+"?directive=silent",
           "method" : "GET",
           "headers" :  {
               "content-type" : "application/json"
           }
         }).then(
          function(response) {
            //TODO: MAKE MORE BULLET-PROOF
            var externalID = response["entity"]["externalID"];
            return race.linkRaceToExtObject(
                tenantID,
                externalID,
                activity["activity"]["object"]["id"],
                activity["activity"]["object"]["url"],
                activity
            );
          },
          function(error) {
            return q.fcall(function () {  return error; });
          }
        );
      } else {
        return q.fcall(function () {  return null; });
      } // end if
    } // end function
  );
} // end function

module.exports = JiveWebhookHelper;
