'use strict';
var jive = require('jive-sdk');
var config = jive.service.options["ext"];
var q = require('q');
var views = require('./RaceAdminViews');

var express = require('express');
var basicAuth = require('express-basic-auth');

var api = express.Router();

var authConfig = {
  challenge: true,
  users : {},
  unauthorizedResponse : function(req) {
      return "UNAUTHORIZED"
  }
};
authConfig["users"][config["security"]["local"]["username"]] = config["security"]["local"]["password"];

api.use(
  basicAuth(authConfig)
);

api.get('/race',views.startRaceUI);
api.post('/race/start',views.startRace);
api.post('/race/reset',views.resetRace);
api.post('/derby/save',views.saveDerby);

function sendJSON(res,status,body) {
  //NOTE: res isn't honoring status(201).json(xxxxx), so trying something else
  res.status(status);
  res.type("application/json");
  if (body) {
    res.send(JSON.stringify(body));
  } // end if
  res.end();
};

/*** THIS MIDDLEWARE ERROR HANLDER IS OUR PRIMARY ERROR HANDLER ****/
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
