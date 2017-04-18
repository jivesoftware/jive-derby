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

var dbQuery = require('./DbHelper')['query'];

var _TILE = config["jive"]["tiles"]["raceStats"];

const NodeCache = require( "node-cache" );
const RACE_HISTORY_BY_DERBY = new NodeCache({
  stdTTL : 0,
  checkperiod :0,
  useClones : true,
  errorOnMissing : false
});

jive.events.addLocalEventListener(config.events.DERBY_RACE_CREATED,
  function(raceResultData) {
    jive.logger.debug("***","Updating Race Time History Cache...",raceResultData);
    var derbyID = raceResultData["derby"]["id"];

    getHistory(derbyID).then(
      function(history) {
        history = history || [];

        var raceData = {
          raceID : raceResultData["raceID"],
          splits : raceResultData["splits"],
          measurements : raceResultData["measurements"],
          timestamp : raceResultData["tiemstamp"],
          results : raceResultData["results"].map(
            function(result) {
              return {
                lane : result["lane"],
                speed : result["speed"],
                totalTimeSec : result["totalTimeSec"]
              };
            })
        };

        history.push(raceData);
        jive.logger.debug("***","Adding Race Results to Race History Cache...",raceData);

        if (history.length > _TILE["raceHistoryMaxCount"]) {
          jive.logger.debug("***","Pruning Race Results",history.length,_TILE["raceHistoryMaxCount"]);
          history = history.slice(history.length - _TILE["raceHistoryMaxCount"]);
        } // end if

        setHistory(derbyID,history);
      } // end function
    );

  } // end function
);

var getHistory = q.nfbind(RACE_HISTORY_BY_DERBY.get);

function setHistory(derbyID,history) {
  jive.logger.debug('***','setHistory',derbyID,history);
  RACE_HISTORY_BY_DERBY.set(derbyID,history);
} // end function

function init() {
  jive.logger.debug('Initialzing Recent RacePhotos Tile Cache ...');
  dbQuery(config["sql"]["getActiveDerbies"],[]).then(
    function(derbies) {
      if (derbies.rows.length > 0) {
        derbies.rows.forEach(
          function(derby) {
            dbQuery(_TILE["sql"]["initRaceTimeHistory"],[ derby["id"], _TILE["raceHistoryMaxCount"] ]).then(
              function(results) {
                if (results && results.rows.length > 0) {
                  var history = [];
                  results.rows.forEach(
                    function(data) {
                      history.unshift(data["json"]);
                    } // end function
                  );
                  setHistory(derby["id"],history);
                } // end if
              } // end function
            );
          } // end function
        ); // end forEach
      } // end if
    }
  );
} // end function

init();

module.exports = {
  getHistory : getHistory,
  setHistory : setHistory
};
