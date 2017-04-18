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
var dbPool = require('./DbHelper')['pool'];
var dbQuery = require('./DbHelper')['query'];

var DerbyRacerHelper = {};

DerbyRacerHelper.getRacer = function(derbyID,racerID,options) {
  var deferred = q.defer();

  var sql = 'SELECT row_to_json(racer) as json \
             FROM \
             ( \
              SELECT id, name, username, title, company, avatarURL as "avatarURL", profileURL as "profileURL", uri, track, region, joinDate as "joinDate" \
                FROM jderby_racers \
                WHERE racerID=$1::int \
              ) as racer';
  var params = [racerID];

  dbQuery(SQL_GET_RACER_TO_JSON,params).then(
    function(rs) {
      if (rs.rows.length === 1) {
        deferred.resolve(rs.rows["json"]);
      } else {
        deferred.reject({ status: 404, message : "Racer ["+racerID+"] does not exist" });
      } // end if
    }, // end function
    function(err) {
      deferred.reject({ message : err["detail"], details : err });
    } // end function
  );

  return deferred.promise;
} // end function

DerbyRacerHelper.updateRacers = function(options) {

  var raceResults = options["data"]["results"];

  function saveRacerDetails(racer) {
    jive.logger.debug('','updating racer',racer["id"]);
    var deferred2 = q.defer();

    var joinDate = null;
    if (racer["joinDate"]) {
      var dateParts = racer["joinDate"].split('/');
      if (dateParts.length == 3) {
        joinDate = new Date(dateParts[2],dateParts[0]-1,dateParts[1]);
      } // end if
    } // end if

    var sql = "INSERT INTO jderby_racers AS r (id,username,name,company,title,avatarURL,profileURL,uri,track,region,joinDate) \
                     VALUES($1::int, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text, $8::text, $9::text, $10::text, $11) \
                     ON CONFLICT (id) \
                     DO UPDATE SET username=$2::text, name=$3::text, company=$4::text, title=$5::text, avatarURL=$6::text, profileURL=$7::text, uri=$8::text, track=$9::text, region=$10::text, joinDate=$11 \
                     WHERE r.id=$1::int";

    var params = [ racer["id"], racer["username"], racer["name"], racer["company"],
                   racer["title"], racer["avatarURL"], racer["profileURL"], racer["uri"], racer["track"], racer["region"], joinDate ];

    dbQuery(sql,params).then(
       function(rs) {
         if (rs["rowCount"] === 1) {
           deferred2.resolve();
         } // end if
       }, // end function
       function(err) {
         deferred2.reject({ message : err["detail"], details : err });  return;
       } // end function
    );
    return deferred2.promise;
  } // end function

  var deferred = q.defer();
  var promises = [];
  raceResults.forEach(
    function(result) {
      promises.push(saveRacerDetails(result["racer"]));
    } // end function
  );

  /**** SAVE ALL RACER DETAILS ***/
  q.all(promises).done(
    function(success) {
      deferred.resolve(options);
    }, // end function
    function(error) {
      jive.logger.error("Unable to save 1 or more racer details for race");
      deferred.reject(error);
    } // end function
  );

  return deferred.promise;
};

module.exports = DerbyRacerHelper;
