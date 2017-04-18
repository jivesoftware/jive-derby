'use strict';

var jive = require('jive-sdk');
var SerialPort = require('serialport');

const RACE_RESULTS_EVENT_NAME = "DerbyTimerResults";
const RESULT_DELIMITERS = [33,34,35,36,37,38,39,40]; /*** ASCII CODES FOR ! " # $ % & ' ( * ***/

/**
 * Parses the raw USB data into an object. Inbound data will be one a string
 * containing one or more lane=time pairs, separated by a space. The time
 * is a floating point followed by some non-digit character.
 *
 * Examples: "1=4.3435# 2=5.0920!"
 *           "3=5.3456&"
 *
 * @param  {string} str      Raw USB data.
 * @return {Object}          Parsed data object for Firebase.
 */
function parseResult (result) {
  const parts = result["data"].split("=");
  var data = {};
  if (parts.length === 2) {
    data['L'+parts[0]] = {
      duration : parseFloat(parts[1]),
      timestamp : result["timestamp"]
    };
  } // end if

  return data
} // end parse

var DerbyTimer = function Constructor(config,listener) {
  var self = this;
  self.config = config || {};

  //*** EXAMPLE DATA:  4=1.9462! 3=2.1702" 2=2.4705# 1=2.6496$  ****/
  function variableDelimiterParser(emitter, buffer) {
      if (!self.currentDelimiter) {
        /*** SETTING OUR FIRST DELIMITER WE WILL FIND ***/
        self.currentDelimiter = self.delimeters.shift();
      } // end if

      for (var i = 0; i < buffer.length; i++) {
        if (self.currentDelimiter === buffer[i]) {
          emitter.emit('data',{ data : new Buffer(self.buffer).toString('ascii'), timestamp : new Date() });
          self.currentDelimiter = self.delimeters.shift();
          self.buffer = [];
        } else if (buffer[i] !== 32) { /*** OMITTING " " EMPTY SPACE DELIMETER BETWEEN LANE RESULTS ***/
          self.buffer.push(buffer[i]);
        } // end if

      } // end for i
  }; // end function

  SerialPort.list((err, ports) => {

    self.port = new SerialPort(config["device"], {
      baudRate: config["baudRate"],
      //*** CUSTOM PARSER TO EMIT EVENTS BASED ON HOW THE DERBY TIMER OPERATES ***
      parser: variableDelimiterParser
    });

    self.port.on('open', () => {
      jive.logger.debug(`*** Connected to Derby Timer ${self.port.path} @ ${self.port.options.baudRate}`);

      /*** REGISTER THE LISTENER ***/
      jive.events.addListener(RACE_RESULTS_EVENT_NAME, listener);

      /*** RESETS ALL THE VARIABLES AND TIMER DISPLAY ***/
      self.reset();
    });

    self.port.on('data', (data) => {

      /*** TRIGGER AN AGGREGATED RACE RESULT EVENT ***/
      if (Object.keys(self.results).length < 1) {
        setTimeout(
          function() {

            /** EMIT AGGREGATED RACE RESULTS ***/
            jive.events.emit(
              RACE_RESULTS_EVENT_NAME, {
                timestamp : new Date(),
                results : self.results
              });

            /*** RESETTING TIMER & TRACKING VARIABLES ***/
            if (config["autoResetTimeoutMs"] && config["autoResetTimeoutMs"] > -1) {
              setTimeout(
                function() {
                  self.reset();
                },
                config["autoResetTimeoutMs"]
              );
            } // end if

          }, // end function
          config["raceResultsTimeoutMs"]
        ); // end setTimeout
      } // end if

      var result = parseResult(data);
      for (var key in result) {
        self.results[key] = result[key];
        /*** ADDING IN THE RANK OF EACH LANE ***/
        self.results[key]["rank"] = Object.keys(self.results).length;
      } // end for key

    });
  });
} // end function

DerbyTimer.prototype.reset = function() {
  var self = this;
  jive.logger.debug('*** Resetting Timer ...');

  //** RESET VARIABLES ***/
  self.results = {};
  self.photoPath = null;
  self.currentDelimiter = null;
  self.delimeters = RESULT_DELIMITERS.slice(0);
  self.buffer = [];

  //** RESET THE DISPLAY TIMER ***/
  self.port.write('R', function(err) {
    if (err) {
      jive.logger.error('*** Error Resetting Display: ',err.message);
    }
  });
} // end function

DerbyTimer.prototype.start = function(callback) {
  var self = this;

  //** RESET THE DISPLAY TIMER ***/
  if (self.config["sendRaceStartSignal"]) {
    jive.logger.debug('*** Starting Race Solenoid ...');

    self.port.write('S', function(err) {
        if (err) {
          jive.logger.error('*** Error Starting Solenoid: ',err.message);
        } else {
          jive.logger.debug('*** Successfully sent Start Command!');
          callback();
        } // end if
      } // end function
    );
  } // end if
} // end function

module.exports = DerbyTimer;


/** MISC DOCUMENTATION FROM VENDOR **

Communications 19200, 8 data bits, 1 stop bit, no parity, no flow control

The timer uses an MCP 2200 USB chip

These are the commands the timer responds to.

-- Check for commands
procedure check_command is
	-- Not a loop
	-- Quickly check for a command and return
	-- if buffer_RX_data_counter > 0 then

	if checkRX then
		cmd = getRXchar		-- Take a byte from serial


		if ( cmd == "R" ) | ( cmd == "r" ) then
			cmd = "R"
			do_reset

		 elsif ( cmd == "A" ) | ( cmd == "a" ) then  -- Solenoid test
			cmd = "A"
			start_solenoid = true
			resetClock
 			getClock( t_sec, t_hi, t_lo )
			while t_hi < 50
			 loop
			  getClock( t_sec, t_hi, t_lo )
			  update_display
			 end loop
			start_solenoid = false

		elsif ( cmd == "D" ) | ( cmd == "d" ) then
			cmd = "D"
			display_check

		elsif ( cmd == "T" ) | ( cmd == "t" ) then
			-- Send race times
			-- send_times
			cmd = "T"
		elsif ( cmd == "F" ) | ( cmd == "f" ) then
			-- Force race finish
			abort_flag = on
			cmd = "F"
			forced_end
		elsif ( cmd == "S" ) | ( cmd == "s" ) then
			-- trigger start gate
			cmd = "S"
		elsif ( cmd == "V" ) | ( cmd == "v" ) then
			send_ver
			cmd = "V"
		elsif ( cmd == "X" ) | ( cmd == "x" ) then
			sensor_test
			cmd = 0
		elsif ( cmd == "N" ) | ( cmd == "n" ) then
			sensor_analysis
			cmd = 0
		elsif ( cmd == "M" ) | ( cmd == "m" ) then
			read_sensor_analysis
			cmd = 0
		elsif ( cmd == "L" ) | ( cmd == "l" ) then
 			lanes	-- Get or set active lanes
		else
			putTXchar = cmd
			putTXchar = "?"
			send_new_line
			cmd = 0	-- Unknown Command! Ignore!
		end if
	else
		cmd = 0	-- No Command
	end if
end procedure


procedure lanes is	-- Get or set active lanes
	cmd = getRXchar		-- Take a byte from serial (waiting if necessary)
	if cmd == "?" then
		putTXchar = "L"
		print_binary_8 ( putTXchar, active_lanes ^ 0xFF )
	else
		-- Expect 8 bit value ( strin of 8 1s & 0s)
		-- bit read was for position 8 - ignore
		cmd = getRXchar	-- position 7 - ignore
		cmd = getRXchar	-- Lane 6
		if cmd == "1" then
			-- active_lanes = active_lanes & 0b_1101_1111
			active_lane6 = off
		elsif cmd == "0" then
			-- active_lanes = active_lanes | 0b_0010_0000
			active_lane6 = on
		end if
		cmd = getRXchar	-- Lane 5
		if cmd == "1" then
			-- active_lanes = active_lanes & 0b_1110_1111
			active_lane5 = off
		elsif cmd == "0" then
			-- active_lanes = active_lanes | 0b_0001_0000
			active_lane5 = on
		end if
		cmd = getRXchar	-- Lane 4
		if cmd == "1" then
			-- active_lanes = active_lanes & 0b_1111_0111
			active_lane4 = off
		elsif cmd == "0" then
			active_lane4 = on
			-- active_lanes = active_lanes | 0b_0000_1000
		end if
		cmd = getRXchar	-- Lane 3
		if cmd == "1" then
			active_lane3 = off
			-- active_lanes = active_lanes & 0b_1111_1011
		elsif cmd == "0" then
			-- active_lanes = active_lanes | 0b_0000_0100
			active_lane3 = on
		end if
		cmd = getRXchar	-- Lane 2
		if cmd == "1" then
			-- active_lanes = active_lanes & 0b_1111_1101
			active_lane2 = off
		elsif cmd == "0" then
			-- active_lanes = active_lanes | 0b_0000_0010
			active_lane2 = on
		end if
		cmd = getRXchar	-- Lane 1
		if cmd == "1" then
			-- active_lanes = active_lanes & 0b_1111_1110
			active_lane1 = off
		elsif cmd == "0" then
			-- active_lanes = active_lanes | 0b_0000_0001
			active_lane1 = on
		end if
		putTXchar = "L"
		print_binary_8 ( putTXchar, active_lanes ^ 0xFF )

		end if
	send_new_line
end procedure
*/
