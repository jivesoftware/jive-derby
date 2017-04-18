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

var express = require('express'),
    jive = require('jive-sdk'),
    cors = require('cors'),
    q = require('q');

var app = express();

var failServer = function(reason) {
    console.log('FATAL -', reason );
    process.exit(-1);
};

var startServer = function () {
    if ( !jive.service.role || jive.service.role.isHttp() ) {
        var server = app.listen( app.get('port') || 8090, app.get('hostname') || undefined, function () {
            console.log("Express server listening on " + server.address().address +':'+server.address().port);
        });
    }
};

jive.service.init(app)

/*** ADDED INITIATILAZION AFTER jiveclientconfiguration.json IS READ ***/
.then(function() {
  return q.fcall(
    function() {
      /*** NEEDED TO SO WE CAN DO CROSS DOMAIN CALLS TO THESE SERVICES ***/
      app.use(cors());

      /**** ADDING IN THE API MIDDLEWARE LAYER HERE ****/
      app.use('/api',require('./lib/DerbyAPI'));

    }) // end function
})
.then( function() { return jive.service.autowire() } )
.then( function() { return jive.service.start() } ).then( startServer, failServer );
