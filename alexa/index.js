/* eslint-disable  func-names */
/* eslint quote-props: ["error", "consistent"]*/
/**
 * This sample demonstrates a simple skill built with the Amazon Alexa Skills
 * nodejs skill development kit.
 * This sample supports multiple lauguages. (en-US, en-GB, de-DE).
 * The Intent Schema, Custom Slots and Sample Utterances for this skill, as well
 * as testing instructions are located at https://github.com/alexa/skill-sample-nodejs-fact
 **/

 //SEE: https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/speech-synthesis-markup-language-ssml-reference#say-as

'use strict';

const Alexa = require('alexa-sdk');
const https = require('https');
const util = require('util');

const APP_ID = "amzn1.ask.skill.c97b43d9-2e39-497e-9904-921e5c366cd7";

const JIVE_DERBY_HOST = process.env.jiveDerbyHost;
const JIVE_DERBY_API_LEADERBOARD = process.env.jiveDerbyLeaderboardEndPoint;
const JIVE_DERBY_API_RACE_STATS = process.env.jiveDerbyRaceStatsEndPoint;
const JIVE_DERBY_API_ENVIRONMENT_STATS = process.env.jiveDerbyEnvironmentEndPoint;

const TEMPLATE_LEADER = " .... %s %s from %s with a track time of %d seconds.";
const PLACE_WORDS = ["first","second","third","fourth", "fifth", "sixth", "seventh", "eigth", "nineth", "tenth"];

const DEFAULT_RACER_COUNT = 4;
const MAX_RACERS = 10;

var SESSION_EVENT;

const handlers = {
    'LaunchRequest': function () {
        this.emit('GetDerbyLeaders');
    },
    'GetDerbyLeader': function () {
      var self = this;
      doRequest('GET',JIVE_DERBY_API_LEADERBOARD,
        function(error,response,body) {
          if (error) {
            self.emit(':tell', "I was unable to get Jive Derby Leaderboard information : " + error);
            return;
          } // end if
          const data = JSON.parse(body);
          if (data["data"]["results"] && data["data"]["results"].length > 0) {
            const leader = data["data"]["results"][0];
            const racerName = leader["racer"]["name"];
            const racerCompany = leader["racer"]["company"];
            const racerTime = leader["totalTimeSec"];
            var speechOutput = 'The current leader in the Jive Derby is ';
            speechOutput += util.format(
              TEMPLATE_LEADER,
              "",
              leader["racer"]["name"],
              leader["racer"]["company"],
              leader["totalTimeSec"]
            );
          } else {
            speechOutput = 'There are currently no race results in the Jive Derby!';
          } // end if
          const cardTitle = "Jive Derby Leaderboard";
          const cardContent = cardTitle + " ... " + speechOutput;
          self.emit(':tellWithCard', speechOutput, cardTitle, cardContent);
        } // end function
      );
    },
    'GetDerbyLeaders': function () {
      var self = this;
      var maxRacers = Number(getSlotValue("NumberOfRacers")) || DEFAULT_RACER_COUNT;
      maxRacers = Math.min(maxRacers,MAX_RACERS);
      console.log('****','Max Racers',maxRacers);
      doRequest('GET',JIVE_DERBY_API_LEADERBOARD,
        function(error,response,body) {
          if (error) {
            self.emit(':tell', "I was unable to get Jive Derby Leaderboard information : " + error);
            return;
          } // end if
          const data = JSON.parse(body);
          var results = data["data"]["results"];
          var speechOutput = '';
          if (results.length > 1) {
            speechOutput = 'The current leaders in the Jive Derby are ';
            maxRacers = Math.min(maxRacers,results.length);
            for (var x=0; x<maxRacers; x++) {
              speechOutput += util.format(
                TEMPLATE_LEADER,
                util.format("in %s place, ",
                PLACE_WORDS[x]),
                results[x]["racer"]["name"],
                results[x]["racer"]["company"],
                results[x]["totalTimeSec"]
              );
            } // end for
          } else if (results.length == 1) {
            speechOutput = 'The current leader in the Jive Derby is ';
            speechOutput += util.format(TEMPLATE_LEADER,
              "",
              results[0]["racer"]["name"],
              results[0]["racer"]["company"],
              results[0]["totalTimeSec"]
            );
          } else {
            speechOutput = 'There are currently no race results in the Jive Derby!';
          } // end if
          const cardTitle = "Jive Derby Leaderboard";
          const cardContent = cardTitle + " ... " + speechOutput;
          self.emit(':tellWithCard', speechOutput, cardTitle, cardContent);
        } // end function
      );
    },
    'GetDerbyEnvironment': function () {
        const speechOutput = "It is cold outside!  It's a perfect day for a Jive Derby race!";
        const cardTitle = "Jive Derby Environment";
        const cardContent = cardTitle + " ... " + speechOutput;
        this.emit(':tellWithCard', speechOutput, cardTitle, cardContent);
    },
    'GetDerbyStats': function () {
        var self = this;
        doRequest('GET',JIVE_DERBY_API_RACE_STATS+"?date="+getSlotValue("RaceDate"),
          function(error,res,body) {
            if (error) {
              self.emit(':tell', "I was unable to get Jive Derby Statistics : " + error);
              return;
            } // end if

            const data = JSON.parse(body);
            var stats = data["data"];
            var speechOutput = '';
            var dateParts = stats["date"].split("-");
            if (stats["numRaces"] > 0) {
              speechOutput = util.format(
                'Derby stats for <say-as interpret-as="date">????%s%s</say-as>: ...... %d races ...... %d racers ...... with a fastest time of %d seconds.',
                dateParts[1],
                dateParts[2],
                stats["numRaces"],
                stats["numRacers"],
                stats["bestTimeSec"]
              );
            } else {
              speechOutput = util.format(
                'There are no derby stats for <say-as interpret-as="date">????%s%s</say-as>',
                dateParts[1],
                dateParts[2]
              );
            } // end if
            const cardTitle = "Jive Derby Race Statistics";
            const cardContent = cardTitle + " ... " + speechOutput;
            self.emit(':tellWithCard', speechOutput, cardTitle, cardContent);
          } // end function
        );
    }
    ,
    'Unhandled': function () {
        var speechOutput = "What information would you like from the Jive Derby?";
        this.emit(':ask',speechOutput,speechOutput);
    }
};

exports.handler = (event, context) => {
    //console.log('***','context',JSON.stringify(context));
    console.log('***','event',JSON.stringify(event));
    const alexa = Alexa.handler(event, context);
    SESSION_EVENT = event;
    alexa.appId = APP_ID;
    // To enable string internationalization (i18n) features, set a resources object.
    //alexa.resources = languageStrings;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

function getSlotValue(slotName) {
  return SESSION_EVENT["request"]["intent"]["slots"][slotName]["value"];
} // end function

function doRequest(method,path,callback) {
    var options = {
      host: JIVE_DERBY_HOST,
      path: path,
      method: method,
      headers: {
          'Content-Type': 'application/json',
      }
    };
    var req = https.request(options,
        function(res) {
          var body = '';
          res.on('data', function(chunk) {
              body += chunk;
           });
          res.on('error', function(error) {
             callback(error);
          });
          res.on('end', function() {
              callback(null,res,body);
           });
        } // end function
      );
      req.setTimeout(2000, function(){
          callback("HTTP TIMED OUT");
      });
      req.on('error', function(e) {
          callback("HTTP ERROR OCCURED : "+ e.message);
      });
      req.end();
} // end function
