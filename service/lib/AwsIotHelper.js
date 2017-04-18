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
var config = jive.service.options["ext"];
var util = require('util');
var q = require('q');
var dbPool = require('./DbHelper')['pool'];
var dbQuery = require('./DbHelper')['query'];

var AWS = require('aws-sdk');
AWS.config.setPromisesDependency(require('q'));
AWS.config.loadFromPath('./resources/AWS.config.json');
var iot = new AWS.IotData({ endpoint: config["aws"]["iot"]["thing"]["host"] });

var AWS_THING_NAME = config["aws"]["iot"]["thing"]["name"];

var AwsIoTHelper = {};

function saveRaceMeasurement(options,sensorType,value,unit) {

  var deferred = q.defer();

  var raceID = options["data"]["raceID"];

  var sql = "INSERT INTO jderby_measurements AS m (raceID,type,value,unit) \
                   VALUES($1, $2::text, $3, $4::text) \
                   ON CONFLICT (raceID,type) \
                   DO UPDATE SET value=$3, unit=$4::text \
                   WHERE m.raceID=$1 AND m.type=$2::text";
  var params = [raceID,sensorType,value,unit];

  dbQuery(sql,params).then(
    function(rs) {
      deferred.resolve(options);
    }, // end function
    function(err) {
      deferred.reject({ message : err["detail"], details : err });
    } // end function
  );

  return deferred.promise;
} // end function

var MEASUREMENT_VALUE_PARSERS = {
  "distance" : function(raw) { return raw["value"]; },
  "humidity" : function(raw) { return raw["value"]; },
  "pressure" : function(raw) { return raw["value"]; },
  "microphone" : function(raw) { return raw["value"]; },
  "uv" : function(raw) { return raw["value"]; },
  "ambient-light" : function(raw) { return raw["value"]; },
  "temperature" : function(raw) {
                    return (raw && raw["value"] && raw["value"][config["defaults"]["measurements"]["units"]["temperature"]]) ?
                            Math.round((raw["value"][config["defaults"]["measurements"]["units"]["temperature"]]*100))/100 :
                            null;
                  }
};

function getSensorValue(service,sensor,value) {
  return (MEASUREMENT_VALUE_PARSERS[sensor]) ? MEASUREMENT_VALUE_PARSERS[sensor](value) : null;
} // end function

function getSensorUnit(service,sensor,value) {
  return (config["defaults"]["measurements"]["units"][sensor]) ?
          config["defaults"]["measurements"]["units"][sensor] :
          "";
} // end function

AwsIoTHelper.getLatestEnvMeasurements = function(options) {
  jive.logger.debug("aws.getLatestEnvMeasurements...");

  var deferred = q.defer();

  iot.getThingShadow({ thingName : AWS_THING_NAME },
    function(err, data) {
      if (err || !data) {
        jive.logger.error("****","Unable to Read Shadow Device",err,err.stack,data);
      } else {
        jive.logger.debug("****","Received AWS IoT Shadow Document",data);
        var iotValues = JSON.parse(data["payload"])["state"]["desired"];
        Object.keys(iotValues).forEach(
          function(service) {
            Object.keys(iotValues[service]).forEach(
              function(sensor) {
                var sensorValue = getSensorValue(service,sensor,iotValues[service][sensor]);
                var sensorUnit = getSensorUnit(service,sensor,iotValues[service][sensor]);

                //jive.logger.debug("****","Adding measurement",service,sensor,sensorValue);

                /*** SAVING MEASUREMENT TO RACE ***/
                saveRaceMeasurement(options,sensor,sensorValue,sensorUnit).then(
                  function(success) {
                    jive.logger.debug("****","Successfully Added Measurement",options["data"]["raceID"],sensor,sensorValue,sensorUnit);

                    /*** ADD TO OPTIONS DATA PAYLOAD ***/
                    options["data"]["measurements"].push({
                      type : sensor,
                      unit : sensorUnit,
                      value : sensorValue
                    });

                  }, // end function
                  function(error) {
                    jive.logger.error("****","Error Adding Measurement",options["data"]["raceID"],sensor,sensorValue,sensorUnit,error);
                  }
                );
              } // end function
            );
          } // end function
        );
      } // end if
      deferred.resolve(options);
    } // end function
  );

  return deferred.promise;
};

module.exports = AwsIoTHelper;
