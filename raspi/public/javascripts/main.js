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
var app = {

  RACER_MAP : {},

  CURRENT_RACE_ID : null,

  addGlobalMessage : function(clazz,message) {
    clazz = clazz || "INFO";
    this.addToRaceStatusLog({
      type : clazz,
      message : message
    });
    //$('.global-message').find('span').html(clazz + " - " + message + "<br/>" + new Date());
  }, // end function

  addToRaceStatusLog : function(data) {
    var message = data["type"] + " - " + data["message"];
    if (data["obj"]) {
      message += "\n" + JSON.stringify(data["obj"],null,4);
    } // end if
    $('.race-status-log pre').prepend("==============================\n"+new Date().toISOString()+" - "+message+"\n")
  },

  addLaneMessage : function(clazz,lane,message,delayMS) {
    clazz = clazz || "info";
    delayMS = delayMS || 5000;
    var messagesWrapper = $('.lane-wrapper[data-lane='+(lane)+']').find('.messages');
    messagesWrapper.html('<div class="lane-message message-'+clazz+'">'+message+'</div>');
    messagesWrapper.slideDown('fast',
      function(){
        $(this).delay(delayMS).fadeOut('fast',
          function() {
            messagesWrapper.html('');
          });
      } // end function
    );
  }, // function

  resetRaceResults : function() {
    $('.results').hide();
    $('.results').removeClass('racePlace1 racePlace2 racePlace3 racePlace4 racePlace5 racePlace6 racePlace7 racePlace8');
    $('.results').html();
  },

  addLaneResult : function(lane, rank, timeSec) {
    var results = $('.lane-wrapper[data-lane='+(lane)+']').find('.results');
    results.addClass('racePlace'+rank);
    results.html(timeSec+" sec");
    results.slideDown('fast');

    //TODO:  OFFER TOGGLE TO QUICKLY TOGGLE RESULTS IN UI FROM DIAGNOSTIC TO LIVE USING CURERENT RACE_ID?
  }, // function

  displayResults : function(raceResults) {
    if (raceResults && (raceResults["raceID"] === this.CURRENT_RACE_ID)) {
      raceResults["results"].forEach(
        function(result) {
          app.addLaneResult(result["lane"],result["rank"],result["totalTimeSec"]);
        } // end function
      );
    } else {
      this.addToRaceStatusLog({ type : "WARN", message : "Results received, but not matching current race", obj : raceResults });
    } // end if
  }, // end function

  getLaneFromDOM : function(element) {
    return $(element).closest('.lane-wrapper').data('lane');
  }, // end function

  resetRacers : function() {
    $('.racerID').val('');
    $('.resetRacerBtn').click();
  }, // end function

  getRacers : function() {
    return Object.keys(app.RACER_MAP).sort().map(function(lane) { return app.RACER_MAP[lane] });
  }, // end function

  setRacer : function(lane,racer,self) {
    console.log('***',lane,racer,self);

    app.RACER_MAP[lane] = racer;

    /*** INIT UI ****/
    $(self).closest('.lane-wrapper').find('.lookup-racer').hide();

    var details = $(self).closest('.lane-wrapper').find('.racer-details');
    details.find('.racer-avatar').attr('src',racer["resources"]["avatar"]["ref"]);
    details.find('.racer-name').html(racer["displayName"]);

    if (racer["jive"] && racer["jive"]["profile"]) {
      var company = racer["jive"]["profile"].filter(
        function(field) {
          return (field["jive_label"] === "Company")
        } // end function
      );
      if (company && company.length === 1) {
        details.find('.racer-company').html(company[0]["value"]);
      } else {
        details.find('.racer-company').html('');
      } // end if
    } else {
      details.find('.racer-company').html('');
    }  // end if

    $(self).closest('.lane-wrapper').find('.racer-details').show();

    /*** SEE: MAX_LANES in race-manager.html ***/
    if (lane < MAX_LANES) {
      $('.lane-wrapper[data-lane='+(lane+1)+']').find('.racerID').focus();
    } // end if
  }, // end function

  setCurrentRaceID : function(raceID) {
    app.CURRENT_RACE_ID = raceID;
  }, // end function

  onRacerChange : function(element) {
    var self = this;

    //TODO: DO A LOADING INTERFACE
    var racerID = $(self).val();
    var lane = app.getLaneFromDOM(self);

    if (!isNaN(racerID)) {
      $.ajax({
        type: "GET",
        url: PROXY_URL+'/api/proxy/'+JIVE_TENANT_ID+'/people/'+racerID,
        dataType: 'json',
        success: function(data, textStatus, jqXHR) {
          //console.log('onRacerChange.lookupRacer','success',data);
          app.setRacer(lane,data,self);
        }, // end function
        error : function(jqXHR, exception) {
          if (jqXHR["status"] === 404) {
            app.addLaneMessage("error",lane,"User ["+racerID+"] is Disabled");
          } else {
            app.addToRaceStatusLog({ type : "ERROR", message : "Error loading Lane "+lane+" racer details", obj : jqXHR });
            app.addLaneMessage("error",lane,"Unknown Error, see Race Log (below)");
            console.log('ERROR','racer-details',jqXHR,exception);
          } // end if
        } // end function
      });
    } else {
      app.addLaneMessage("error",lane,"Please enter a valid Racer ID");
    } // end if
  }, // end function

  onResetRacerClick : function(element) {
    $(this).closest('.lane-wrapper').find('.lookup-racer').show();

    var details = $(this).closest('.lane-wrapper').find('.racer-details');
    details.hide();
    details.find('.racer-avatar').removeAttr('src');
    details.find('.racer-name').html('');
    details.find('.racer-company').html('');
  }, // end function

  onResetRaceClick : function(element) {
    app.resetRaceResults();
    console.log('Resetting Race...');
    $('.race-status-log pre').html('');
    $.ajax({
      type: "POST",
      url: '/admin/race/reset',
      dataType: 'json',
      success: function(data, textStatus, jqXHR) {
        console.log('resetRace','success',data);
        app.resetRacers();
        app.setCurrentRaceID("-------");
        app.addGlobalMessage('INFO','Successfully reset race devices');
      }, // end function
      error : function(jqXHR, exception) {
        console.log('ERROR','resetRace',jqXHR,exception);
        app.addGlobalMessage('ERROR','Unable to reset to race, see: console log');
      } // end function
    });
  },

  onStartRaceClick : function(element) {
    app.resetRaceResults();

    var racers = app.getRacers();

    if (racers && racers.length > 0) {
      //TODO: ADD IN SUPPORT FOR RACE NAME
      console.log('Starting Race...');
      $.ajax({
        type: "POST",
        url: '/admin/race/start',
        data: {
          racers : racers,
          derby : {
            id : $('#derbyID').val() || DEFAULT_DERBY["id"],
            name : $('#derbyName').val() || DEFAULT_DERBY["name"]
          },
          diagnosticMode : !$('#diagnosticMode').is(":checked")
        },
        dataType: 'json',
        success: function(data, textStatus, jqXHR) {
          console.log('startRace','success',data);
          app.setCurrentRaceID(data["id"]);
          app.addGlobalMessage('INFO','Successfully started new race ['+data["id"]+']');
        }, // end function
        error : function(jqXHR, exception) {
          console.log('ERROR','startRace',jqXHR,exception);
          app.addGlobalMessage('ERROR','Error Starting Race, see: console log');
        } // end function
      });
    } else {
      app.addGlobalMessage('ERROR','No Racers Defined!');
    } // end if
  }, // end function

  onDerbyOverrideClick : function(element) {
    if ($(this).is(':checked')) {
      $('.derby-control').prop('disabled',false).removeClass('disabled-control');
      $('label[for=derby-override], #derby-override').hide();
      $('#derby-save').show();
    } // end if
  }, // end function

  onDerbySaveClick : function(element) {
    console.log('***','onDerbySaveClick');
    $.ajax({
      type: "POST",
      url: '/admin/derby/save',
      data: {
        id : $('#derbyID').val(),
        name : $('#derbyName').val(),
        active : $('#derbyActive').is(':checked'),
        public : $('#derbyPublic').is(':checked')
      },
      success: function(data, textStatus, jqXHR) {
        console.log('onDerbySaveClick','success',data,jqXHR);
        app.addGlobalMessage('INFO','Successfully updated derby settings.');
        /*****/
        $('#derby-save').hide();
        $('#derby-override').prop('checked',false);
        $('.derby-control').prop('disabled',true).addClass('disabled-control');
        $('label[for=derby-override], #derby-override').show();
      }, // end function
      error : function(jqXHR, exception) {
        console.log('ERROR','startRace',jqXHR,exception);
        app.addGlobalMessage('ERROR','Unable to update derby settings.');
      } // end function
    });
  } // end function
};

$(function() {
  $('.racerID').change(app.onRacerChange);
  $('.resetRacerBtn').click(app.onResetRacerClick);
  $('#derby-override').click(app.onDerbyOverrideClick);
  $('#derby-save').click(app.onDerbySaveClick);
  $('#startRaceBtn').click(app.onStartRaceClick);
  $('#resetRaceBtn').click(app.onResetRaceClick);
  //$('#refreshResultsBtn').click(app.onRefreshResultsClick);

  app.addGlobalMessage("INFO","Successfully Loaded");
});
