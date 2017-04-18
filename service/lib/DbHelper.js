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
var URL = require('url-parse');
var q = require('q');
var config = jive.service.options["ext"];

var pg = require('pg');

// "databaseUrl" : "pg://user:pass@localhost:5432/dbname",
var dbURL = new URL(jive.service.options["databaseUrl"]);
var dbPool = new pg.Pool({
  "user": dbURL["username"],
  /*** REMOVE THE / PREFIX ***/
  "database": (dbURL["pathname"].indexOf("/") === 0) ? dbURL["pathname"].substring(1) : dbURL["pathname"],
  "password": dbURL["password"],
  "host": dbURL["hostname"],
  "port": dbURL["port"],
  "max": config["pg-db-config"]["max"],
  "idleTimeoutMillis": config["pg-db-config"]["idleTimeoutMillis"]
});

//var dbPool = new pg.Pool(config["pg-db-config"]);

var dbQuery = function(sql,params) {
  return q.promise(
    function(resolve, reject){
      //console.log('****','SQL',sql,params);
      dbPool.query(sql, params,
        function (err, rs) {
          if (err) {
            reject(err);
          } else {
            resolve(rs);
          } // end if
        }
      );
    });
  };

module.exports = {
  pool : dbPool,
  query : dbQuery
};
