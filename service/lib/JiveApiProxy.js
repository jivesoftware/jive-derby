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
var q = require('q');
var util = require('util');
var db = jive.service.persistence();

var ApiProxy = {};

/****************************************************
* TODO: DOCUMENT
* TODO:  MAY NO LONGER BE NEEDED
****************************************************/
function cleanseResponseBody(response) {
  var entity = response["entity"];

  //console.log('***',entity);

  //TODO: DOUBLE CHECK THIS ISN'T NEEDED

  /*** STRIP OUT allowIllegalResourceCall HEADER ***/
  // entity = entity.substring(entity.indexOf("{"));
  // return JSON.parse(entity);

  return entity;
} // end function

/****************************************************
* TODO: DOCUMENT
****************************************************/
var PROFILE_FIELDS = config["jive"]["options"]["apiUserFields"] || "id,jive.username";
ApiProxy.getUserDetails = function(tenantID,userID) {
  var deferred = q.defer();
  jive.community.findByTenantID(tenantID).then(
    function(community) {
      if (community) {
        jive.community.doRequest(community,{
           "path" : util.format("/api/core/v3/people/%d?fields=%s",userID,PROFILE_FIELDS),
           "method" : "GET",
           "headers" :  {
               "content-type" : "application/json"
           }
         }).then(
           function(success) {
             deferred.resolve(cleanseResponseBody(success));
          }, // end function
          function (error) {
            error = error || {};
            error["trace"] = "x2002";
            deferred.reject(error);
          } // end function
        );
      } else {
        deferred.reject({ trace : "x2003", message: "TenantID not Found", tenantID });
      } // end if
    } // end function
  );

  return deferred.promise;
} // end function

/****************************************************
* TODO: DOCUMENT
****************************************************/
ApiProxy.updateDocumentLeaderboard = function(contentURI,contentBody) {
  var deferred = q.defer();

  //*** TODO: PARSE OUT THE JIVE URL FROM THE CONTENT URI ***/
  var apiPath = contentURI.substring(contentURI.indexOf("/api"));

  getCommunity(tenantID).then(
    function(community) {
      community.doRequest({
         "path" : apiPath,
         "method" : "GET",
         "headers" :  {
             "content-type" : "application/json"
         }
       }).then(
         function(success) {
           var contentEntity = cleanseResponseBody(success);
           /*** REPLACE THE CONTENT BODY FOR THE UPDATED DOM ***/
           contentEntity["content"]["text"] = contentBody;
           //TODO: DO I NEED TO PURGE ANY FIELDS TO MAKE UPDATE WORK?
           community.doRequest({
             "path" : apiPath,
             "method" : "PUT",
             "postBody" : contentEntity,
             "headers" :  {
                 "content-type" : "application/json"
             }
           }).then(
             function(success) {
                deferred.resolve(cleanseResponseBody(success));
             }, // end function
             function(error) {
               error = error || {};
               error["trace"] = "x3003";
               deferred.reject(error);
             } // end function
          );
       }, // end function
       function(error) {
         error = error || {};
         error["trace"] = "x3002";
         deferred.reject(error);
       } // end function
    );
  }, // end function
  function(error) {
    error = error || {};
    error["trace"] = "x3001";
    deferred.reject(error);
  } // end function
  );

  return deferred.promise;
} // end function

module.exports = ApiProxy;
