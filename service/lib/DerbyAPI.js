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

var express = require('express');
var jive = require('jive-sdk');
var derbyMgr = require('./DerbyManager');
var proxy = require('./JiveApiProxy');
var config = jive.service.options["ext"];
var q = require('q');
var uuid = require('uuid/v4');

var multer  = require('multer');
var upload = multer({ dest: 'tmp-race-photos/' });

const SECURITY_HEADER = config["service"]["securityHeader"];
const SECURITY_KEY = config["service"]["securityValue"];

var api = express.Router();

function sendJSON(res,status,body) {
  //NOTE: res isn't honoring status(201).json(xxxxx), so trying something else
  res.status(status);
  res.type("application/json");
  if (body) {
    res.send(JSON.stringify(body));
  } // end if
  res.end();
};

/*** THIS MIDDLEWARE IS EXECUTED FOR EVERY SERVICE ****/
api.use(
  function(req,res,next) {
    //ONLY PROTECTING POST/PUT OPERATIONS
    if (["POST","post","PUT","put"].includes(req.method) &&
        //TODO: HAS TO BE A BETTER WAY THAN THIS ... ALSO NEED TO TEST
        /*** ACCEPT THE CALLBACK CREATE ROUTINE ***/
        !req.originalUrl.match(/^\/api\/derby\/([A-Za-z0-9]+)\/results\/callback.*/)) {
      var header = config[""]
      var securityKey = req.headers[SECURITY_HEADER.toLowerCase()] || req.headers[SECURITY_HEADER];

      //TODO: ADD IN SCENARIO FOR JiveEXTN signed services
        //TODO: PARSE TENTANTID FROM AUTHORIZATION HEADER > LOOKUP clientId/secret
        //return jive.util.jiveAuthorizationHeaderValid(req.headers["authorization"],clientId,clientSecret,true);

      if (securityKey !== SECURITY_KEY) {
        jive.logger.warn('****','Authorization Check FAILED','****');
        return next({ status : 401, message :"Unrecognized Security Key" });
      } // end if
      jive.logger.debug('****','Authorization Check PASSED','****');
    } // end if
    next();
  } // end function
);

/*** DATA VALIDATION FOR POST /races ****/
api.use('/races',
  function(req,res,next) {
    // if (!req.body["raceData"] || !req.file) {
    //   return next({ status : 400, message :"Missing Race Details and/or Multipart Photo" });
    // } // end if

    //TODO: ADD MORE VALIDATION

    next();
  } // end function
);

/*** DATA VALIDATION FOR PUT /derby/:derbyID/races/:raceID/racer/:racerID ****/
api.use('/derby/:derbyID/races/:raceID/racer/:racerID',
  function(req,res,next) {

    //TODO: ADD VALIDATION

    next();
  } // end function
);

/*** DATA VALIDATION FOR POST /derby/:derbyID/results/callback ****/
api.use('/derby/:derbyID/results/callback',
  function(req,res,next) {
    //TODO: IMPLEMENT VALIDATION LOGIC
    next();
  } // end function
);

/*** DATA VALIDATION FOR POST /derby/:derbyID/racer/:racerID ****/
api.use('/derby/:derbyID/racer/:racerID',
  function(req,res,next) {
    //TODO: IMPLEMENT VALIDATION LOGIC
    next();
  } // end function
);

/*** DATA VALIDATION FOR POST /derby ****/
api.use('/derby',
  function(req,res,next) {
    //TODO: IMPLEMENT VALIDATION LOGIC
    next();
  } // end function
);

/******************************************
* TODO: DOCUMENTATION
*******************************************/
api.post('/derby',
  function(req,res,next) {
    jive.logger.debug(req.method,'/derby');

    var options = {
      data : req.body
    };

    var deferred = q.defer();

    derbyMgr.createDerby(options).then(
      function(success) {
        sendJSON(res,200);
        deferred.resolve();
      }, // end function
      function (error) {
        next(error);
        deferred.reject();
      } // end function
    );

    return deferred.promise;
  } // end function
);

/******************************************
* TODO: DOCUMENTATION
*******************************************/
api.get('/derby/:derbyID',
  function(req,res,next) {
    jive.logger.debug(req.method,'/derby/:derbyID');
    var derbyID = req.params.derbyID;

    var deferred = q.defer();

    derbyMgr.getDerby(derbyID,{}).then(
      function(success) {
        sendJSON(res,200,{ data: success });
        deferred.resolve();
      }, // end function
      function (error) {
        next(error);
        deferred.reject();
      } // end function
    );

    return deferred.promise;
  } // end function
);

/******************************************
* TODO: DOCUMENTATION
*******************************************/
api.get('/derby',
  function(req,res,next) {
    jive.logger.debug(req.method,'/derby');

    var options = {
      params : {
        onlyActive : (req.query.hasOwnProperty('onlyActive')) ? ('true' === req.query.onlyActive) : config["defaults"]["derbies"]["onlyActive"],
        onlyPublic : (req.query.hasOwnProperty('onlyPublic')) ? ('true' === req.query.onlyPublic) : config["defaults"]["derbies"]["onlyPublic"],
        onlyUnassigned : (req.query.hasOwnProperty('onlyUnassigned')) ? ('true' === req.query.onlyUnassigned) : config["defaults"]["derbies"]["onlyUnassigned"],
        count : (!isNaN(req.query.count)) ? req.query.count : config["defaults"]["derbies"]["resultCount"],
        sort : ["asc","ASC","DESC","desc"].includes(req.query.sort) ? req.query.sort : config["defaults"]["derbies"]["sortOrder"]
      }
    };

    var deferred = q.defer();

    derbyMgr.getDerbies(options).then(
      function(success) {
        sendJSON(res,200,{data : success});
        deferred.resolve();
      }, // end function
      function (error) {
        next(error);
        deferred.reject();
      } // end function
    );

    return deferred.promise;
  } // end function
);

/******************************************
* TODO: DOCUMENTATION
*******************************************/
api.get('/derby/:derbyID/snapshot',
  function(req,res,next) {
    var derbyID = req.params.derbyID;
    var deferred = q.defer();

    derbyMgr.getDerbySnapshot(derbyID,{}).then(
      function(history) {
        sendJSON(res,200,{ data : (history || []) });
        deferred.resolve();
      }, // end function
      function (error) {
        next(error);
        deferred.reject();
      } // end function
    );

    return deferred.promise;
  } // end function
);

/******************************************
* TODO: DOCUMENTATION
*******************************************/
api.get('/derby/:derbyID/stats',
  function(req,res,next) {
    var derbyID = req.params.derbyID;
    jive.logger.debug(req.method,'derbyStats',derbyID);

    //YYYY-MM-DD
    var now = new Date();
    var options = {
      params : {
        date : req.query["date"] || (now.getFullYear()+"-"+(now.getMonth()+1)+"-"+now.getDate())
      }
    };

    var deferred = q.defer();

    derbyMgr.getDerbyStats(derbyID,options).then(
      function(success) {
        success["date"] = options["params"]["date"];
        sendJSON(res,200,{data : success});
        deferred.resolve();
      }, // end function
      function (error) {
        next(error);
        deferred.reject();
      } // end function
    );

    return deferred.promise;
  } // end function
);

/******************************************
* TODO: DOCUMENTATION
*******************************************/
api.post('/races',
  upload.single('racePhoto'),
  function(req,res,next) {
    var data = req.body["raceData"];
    data = (typeof data == 'object') ? data : JSON.parse(data);
    var photo = req.file;
    jive.logger.debug(req.method,'racesCreate',data,photo);

    /**** CLEANSE DIAGNOSTIC MODE ****/
    data["diagnostic"] = (data.hasOwnProperty('diagnostic')) ?
      ('true' === data["diagnostic"]) :
      config["defaults"]["races"]["diagnosticMode"];

    var deferred = q.defer();

    derbyMgr.createRace(data,photo).then(
      function(success) {
        sendJSON(res,201);
        deferred.resolve();
      }, // end function
      function (error) {
        next(error);
        deferred.reject();
      } // end function
    );

    return deferred.promise;
  } // end function
);

/******************************************
* TODO: DOCUMENTATION
*******************************************/
api.get('/derby/:derbyID/races',
  function(req,res,next) {
    var derbyID = req.params.derbyID;
    jive.logger.debug(req.method,'racesList',derbyID);

    var deferred = q.defer();

    var options = {
      params : {
        sort : ["asc","ASC","DESC","desc"].includes(req.query.sort) ? req.query.sort : config["defaults"]["races"]["sortOrder"],
        count : (!isNaN(req.query.count)) ? req.query.count : config["defaults"]["races"]["resultCount"],
        min : (!isNaN(req.query.min)) ? req.query.min : null,
        max : (!isNaN(req.query.max)) ? req.query.max : null,
        racer : (!isNaN(req.query.racer)) ? req.query.racer : null
      }
    };

    derbyMgr.getRaces(derbyID,options).then(
      function(success) {
        sendJSON(res,200,{data : success});
        deferred.resolve();
      }, // end function
      function (error) {
        next(error);
        deferred.reject();
      } // end function
    );

    return deferred.promise;
  } // end function
);

/******************************************
* TODO: DOCUMENTATION
*******************************************/
api.get('/derby/:derbyID/races/:raceID',
  function(req,res,next) {
    var derbyID = req.params.derbyID;
    var raceID = req.params.raceID;
    jive.logger.debug(req.method,'racesListByID',derbyID,raceID);

    var deferred = q.defer();

    derbyMgr.getRace(derbyID,raceID,{}).then(
      function(success) {
        sendJSON(res,200,{data : success});
        deferred.resolve();
      }, // end function
      function (error) {
        next(error);
        deferred.reject();
      } // end function
    );

    return deferred.promise;
  } // end function
);

/******************************************
* TODO: DOCUMENTATION
* TODO: PUT /api/derby/jw17/races/12345/racer/32109?active=(true|false)&primary=(true|false)&refresh=(true|false)
*******************************************/
api.put('/derby/:derbyID/races/:raceID/racer/:racerID',
  function(req,res,next) {
    var derbyID = req.params.derbyID;
    var raceID = req.params.raceID;
    var racerID = req.params.racerID;

    var options = {
      "active" : req.query.active,
      "primary" : req.query.primary,
      "refresh" : (req.query.hasOwnProperty('refresh')) ? ('true' === req.query.refresh) : false
    };

    jive.logger.debug('PUT','raceResultToggle',derbyID,raceID,racerID,options);

    var deferred = q.defer();

    derbyMgr.toggleRaceResult(derbyID,raceID,racerID,options).then(
      function(success) {
        sendJSON(res,201);
        deferred.resolve();
      }, // end function
      function (error) {
        next(error);
        deferred.reject();
      } // end function
    );

    return deferred.promise;
  } // end function
);

/******************************************
* TODO: DOCUMENTATION
* TODO:  // { id : 32109, name : "Ryan Rutan", "company" : "Jive Software", avatar : "https:///...../avatar" }
*******************************************/
api.get('/derby/:derbyID/racer/:racerID',
  function(req,res,next) {
    var derbyID = req.params.derbyID;
    var racerID = req.params.racerID;

    jive.logger.debug(req.method,'racersListByID',derbyID,racerID);

    var deferred = q.defer();

    derbyMgr.getRacer(derbyID,racerID,{}).then(
      function(success) {
        sendJSON(res,201,{data : success});
        deferred.resolve();
      }, // end function
      function (error) {
        next(error);
        deferred.reject();
      } // end function
    );

    return deferred.promise;
  } // end function
);

/******************************************
* TODO: DOCUMENTATION
*******************************************/
api.get('/derby/:derbyID/leaderboard',
  function(req,res,next) {
    var derbyID = req.params.derbyID;

    var params = {
      onlyActive : (req.query.hasOwnProperty('onlyActive')) ? ('true' === req.query.onlyActive) : config["defaults"]["leaderboard"]["onlyActive"],
      onlyPrimary : (req.query.hasOwnProperty('onlyPrimary')) ? ('true' === req.query.onlyPrimary) : config["defaults"]["leaderboard"]["onlyPrimary"],
      includeMarkup : (req.query.hasOwnProperty('includeMarkup')) ? ('true' === req.query.includeMarkup) : config["defaults"]["leaderboard"]["includeMarkup"],
      min : req.query.min,
      max : req.query.max
    };

    jive.logger.debug(req.method,'/derby/:derbyID/leaderboard',derbyID,params);

    var deferred = q.defer();

    derbyMgr.getLeaderboard(derbyID,params,true).then(
      function(leaderboardData) {
        /*** INCLUDE MARKUP WITH RESPONSE ***/
        if (params["includeMarkup"]) {
          derbyMgr.getLeaderboardMarkup(leaderboardData,params).then(
            function(leaderboardMarkup) {
              sendJSON(res,200,{ data: leaderboardData, markup : leaderboardMarkup});
              deferred.resolve();
            }, // end function
            function (errorMarkup) {
              sendJSON(res,206,{ data: leaderboardData, error : errorMarkup});
              deferred.reject();
            } // end function
          );
        } else {
          /*** INCLUDE JUST LEADERBOARD DATA ***/
          sendJSON(res,200,{ data: leaderboardData });
          deferred.resolve();
        } // end if
      }, // end function
      function (error) {
        next(error);
        deferred.reject();
      } // end function
    );

    return deferred.promise;
  } // end function
);

/******************************************
* TODO: DOCUMENTATION
*******************************************/
api.get('/proxy/:tenantID/people/:userID',
  function(req,res,next) {
    var userID = req.params.userID;
    var tenantID = req.params.tenantID;

    jive.logger.debug(req.method,'/proxy/:tenantID/people/:userID',tenantID,userID);

    var deferred = q.defer();

    proxy.getUserDetails(tenantID,userID).then(
      function(details) {
        if (details["jive"]["enabled"]) {
          sendJSON(res,200,details);
          deferred.resolve();
        } else {
          sendJSON(res,404,{data : "Disabled User" });
          deferred.reject();
        } // end if
      }, // end function
      function(error) {
        next(error);
        deferred.reject();
      } // end function
    );

    return deferred.promise;
  } // end function
);

/******************************************
* TODO: DOCUMENTATION
* TODO: OBFUSCATE NAMES AND IDENTIFIERS ARRAY
* TODO: UPDATE DOCUMENTATION FOR ?token= &header= &verb=POST
*******************************************/
api.post('/derby/:derbyID/results/callback',
  function(req,res,next) {
    var derbyID = req.params.derbyID;
    var echoURL = req.body.url;
    var securityHeader = req.body.header || 'X-JDERBY-TOKEN';
    var securityToken = req.body.token || uuid();
    var httpVerb = req.body.verb || 'POST';
    var onlyLive = (req.body.hasOwnProperty('onlyLive')) ? ('true' === req.body.onlyLive) : true;
    var active = (req.body.hasOwnProperty('active')) ? ('true' === req.body.active) : true;

    jive.logger.debug(req.method,'resultsCallbackEcho',derbyID,echoURL,httpVerb);

    var deferred = q.defer();

    derbyMgr.setResultsCallbackEcho(derbyID,echoURL,httpVerb,securityHeader,securityToken,onlyLive,active,{}).then(
      function(success) {
        sendJSON(res,201,{data : success});
        deferred.resolve();
      }, // end function
      function (error) {
        next(error);
        deferred.reject();
      } // end function
    );

    return deferred.promise;
  } // end function
);

// Handle 404
api.use(function(req, res) {
   res.status(404).end();
});

/*** THIS MIDDLEWARE ERROR HANDLER IS OUR PRIMARY ERROR HANDLER ****/
api.use(
  function(err,req,res,next) {
    var status = err.status || 500;
    sendJSON(res,status,{
      "message" : err.message,
      "status" : status,
      "details" : err["details"]
    });
  } // end function
);

module.exports = api;
