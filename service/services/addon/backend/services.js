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
var derbyMgr = require('../../../lib/DerbyManager');
var s3 = require('../../../lib/AwsS3Helper');

function initLeaderBoardCaches() {
  jive.logger.debug("Updating Leaderboard Caches...");
  var options = { params : {  onlyActive : true } };
  derbyMgr.getDerbies(options).
  then(
    function(derbies) {
      if (derbies) {
        derbies.forEach(
          function(derby) {
            jive.logger.debug("Updating Leaderboard",derby);
            derbyMgr.updateLeaderboardCache(derby);
          } // end funciton
        );
      } // end if
    } // end function
  );
} // end function

exports.onBootstrap = function(app) {
    jive.logger.info("********** STARTING *****************");
    initLeaderBoardCaches();
    s3.init();
    jive.logger.info("********** STARTED! *****************");
};
