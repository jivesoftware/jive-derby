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

///////////////////////////////////////////////////////////////////////////////////////////////////
// Setup express

var express = require('express'),
    jive = require('jive-sdk'),
    q = require('q');
var bodyParser = require('body-parser');
var consolidate = require('consolidate');
var mustache = consolidate.mustache;
var path = require('path');
var SocketIo = require('./lib/SocketIoHelper');
var app = express();

///////////////////////////////////////////////////////////////////////////////////////////////////
// Setup jive

var failServer = function(reason) {
    console.log('FATAL -', reason );
    process.exit(-1);
};

var startServer = function () {
    if ( !jive.service.role || jive.service.role.isHttp() ) {
        var server = app.listen( app.get('port') || 8090, app.get('hostname') || undefined, function () {
            console.log("Express server listening on " + server.address().address +':'+server.address().port);
        });
        SocketIo.init(server);
    }
};

// NOTE: SPECIFY MY OWN VIEWS DIRECTORY AND ENGINE
app.engine('html', mustache);
app.use(express.static(__dirname+'/public'));
app.set('view engine', 'html');
app.set('views', __dirname+'/lib/templates');

// NOTE: REMOVED APP TO KEEP JIVE SDK FROM CONFIGURING
//jive.service.init(app)
jive.service.init()

/*** ADDED INITIATILAZION AFTER jiveclientconfiguration.json IS READ ***/
.then(function() {
  return q.fcall(
    function() {
      /*** NEEDED FOR JSON PARSING ***/
      app.use(bodyParser.urlencoded({
        extended: true
      }));

      /**** ADDING IN THE API MIDDLEWARE LAYER HERE ****/
      app.use('/admin',require('./lib/RaceAdminAPI'));

      /*** BootStrapping Service, without SDK ***/
      jive.events.addLocalEventListener( "serviceBootstrapped",
        function() {
          require('./lib/BootStrapHelper')['onBootstrap'](app);
      });

    })
})
.then( function() { return jive.service.start() } ).then( startServer, failServer );
