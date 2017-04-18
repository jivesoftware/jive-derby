'use strict';
var jive = require('jive-sdk');
var config = jive.service.options["ext"];

var SocketIoHelper = function Constructor() {

}; // end function


function onConnection(client) {
  client.on('connect',
    function(data) {
      jive.logger.debug('***','onConnect',data);
    } // end function
  );
  client.on('event',
    function(data) {
      jive.logger.debug('***','onEvent',data,client);
    } // end function
  );
  client.on('disconnect',
    function() {
      jive.logger.debug('***','onDisconnect',client);
    } // end function
  );
} // end function

SocketIoHelper.prototype.init = function(server) {
  this.io = require('socket.io')(server);
  this.io.on('connection',onConnection);
  this.io.serveClient(true);
} // end function

SocketIoHelper.prototype.sendRaceResults = function(raceResults) {
  this.io.emit('raceResults',raceResults);
} // end sendRaceResults

SocketIoHelper.prototype.sendMessage = function(type,message,obj) {
  this.io.emit('message',{ type : type, message : message, obj : obj });
} // end sendMessage

var instance = new SocketIoHelper(config);

module.exports = instance;
