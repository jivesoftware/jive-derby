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
var oauthUtil = jive.util.oauth;

// overrides jive-sdk/routes/oauth.js to store access token
var derbyOAuth = Object.create(jive.service.routes.oauth);
module.exports = derbyOAuth;

derbyOAuth.fetchOAuth2Conf = function() {
  return config["jive"]["oauth2"];
};

derbyOAuth.oauth2SuccessCallback = function( state, originServerAccessTokenResponse, callback ) {
  var content = originServerAccessTokenResponse['entity'];
  var tenantID = state["context"]["jiveTenantID"];
  jive.logger.debug('****',"oauth2SuccessCallback",tenantID);

  //TODO: REMOVE AFTER DEBUG
  //console.log('****',state,originServerAccessTokenResponse);

  jive.community.findByTenantID(tenantID).then(
    function(community) {
      if (community) {
        jive.logger.debug("Updating OAuth Token for",tenantID);
        community["oauth"] = content;
        community["oauth"]["ticket"] = state['viewerID'];
        jive.community.save(community).then(
          function() {
             jive.logger.debug("Successfully updated OAuth Token for",tenantID);
             callback({'ticket': state['viewerID'] });
          } // end function
        );
      } else {
        jive.logger.debug("Unable to Find Community",tenantID,"to save OAuth Token, ignoring...");
        callback(null);
      } // end if
    }
  );
};

derbyOAuth.getTokenStore = function() {
    return tokenStore;
};
