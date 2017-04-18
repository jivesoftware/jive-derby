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

//************************************************************************
//NOTE: CALLED AS SOON AS THE FULL CONTEXT IS RESOLVED
//************************************************************************
function onReady(tileConfig,tileOptions,viewer,container) {
  console.log('onReady',tileConfig,tileOptions,viewer,container);

  if ( typeof tileConfig !== 'object' ) {
      tileConfig = JSON.parse(tileConfig || {} );
  } // end if

  //TODO: CREATE UI TOGGLE TO SHOW ASSIGNED DERBIES AS WELL
  var onlyUnassigned = true;

  /*** FETCH LIST OF AVAILABLE DERBIES ***/
  osapi.http.get({
        'href': HOST + '/api/derby?onlyActive=true&onlyPublic=true&onlyUnassigned='+onlyUnassigned,
        headers: { 'Content-Type': ['application/json'] },
        'noCache': true
    }).execute(
      function (response) {
        if (!response["error"] && response["content"]) {
            var json = JSON.parse(response["content"]);
            var derbies = json["data"];
            derbies.forEach(
              function(derby) {
                $('#derbyList').append('<option value="'+derby["id"]+'">'+derby["name"]+'</option>');
              } // end function
            );
            $('#select-derby-wrapper').slideDown('fast',app.resize);
        } else {
          console.log('ERROR','Unable to Load Derbies',response);
        } // end if
      } // end function
    );

  var json = tileConfig || {
      "onlyLive": true
  };

  /*** PRESET CONTROL TO MATCH EXISTING CONFIG ***/
  if (json["onlyLive"]) {
      $('#onlyLive').attr("checked","checked");
  } else {
    $('#onlyLive').removeAttr("checked");
  } // end if

  /*** UPDATE THE TOKEN CONFIGURED DIALOG ***/
  if (!json["tokenConfigured"]) {
    $('#grant-access-panel').slideDown('fast');
  } else {
    $('#addon-configured').show();
    $('#btn_save').prop('disabled',false);
  } // end if

  /*** SYNC SELECTIONS OF DERBIES TO MATCH EXISTING CONFIG ***/
  if (json['derbyID']) {
    $("#derbyList option[value='" + json['derbyID'] + "']").prop("selected", true);
  } // end if

  $("#btn_save").click( function() {

      /*** PICK UP WHAT WAS LOADED (AND MODIFIED SINCE LOADING) ***/
      var config = app.config || {};

      /*** SAVE DERBY SELECTIONS TO CONFIG ***/
      var derbyID = $("#derbyList").val();
      var derbyName = $("#derbyList option:selected").html();
      if (derbyID) {
        config["derbyID"] = derbyID;

        /** MARKING CONTAINER WITH DERBY DETAILS FOR OTHER TILES TO PICK UP **/
        osapi.jive.core.post({
          v: 'v3',
          format : 'json',
          href: "/places/"+container["placeID"]+"/extprops",
          body: {
            derbyMapping : JSON.stringify({
              id : derbyID,
              name : derbyName
            })
          }}).execute(
           function(response) {
             if (response["error"]) {
              //TODO: ADD IN BETTER HANDLING HERE
              alert('There was an issue marking this Place for the Derby');
             } // end if
             /*** SAVE ONLY LIVE PREFERENCE TO CONFIG ***/
             config["onlyLive"] = $('#onlyLive').is(":checked");
             jive.tile.close(config, {} );
           } // end function
         );
      } else {
        alert('Please select a derby');
        return;
      } // end if
  });

  /*** DELAY AS A HACK TO MAKE SURE EVERYTHING IS LOADED ***/
  setTimeout(
    function() {
      initOAuth();
      if ($('#grant-access-panel').is(':visible')) {
        $('#grant-button').slideDown('fast',app.resize);
      } // end if
    },
    1000
  );

  app.resize();
} // end function

function initOAuth() {
    /*** ONLY READY WHEN BOTH VIEWER AND CONTAINER ARE RENDERED ***/
    var ticketErrorCallback = function (error) {
      console.log('ticketErrorCallback error',error);
    };

    var jiveAuthorizeUrlErrorCallback = function (error) {
      console.log('jiveAuthorizeUrlErrorCallback error',error);
    };

    var preOauth2DanceCallback = function (error) {
      console.log("preOauth2DanceCallback",error);
    };

    var onLoadCallback = function (config, identifiers) {
      onLoadContext = {
          config: config,
          identifiers: identifiers
      };
    };

    var successCallBack = function(ticketID) {
      if (ticketID) {
        app.config["tokenConfigured"] = true;
        $('#grant-access-panel').slideUp('fast',
          function() {
            $('#addon-configured').show();
            $('#btn_save').prop('disabled',false);
            app.resize();
          } // end function
        );
      } // end if
    };

    if (!app.config["tokenConfigured"]) {
      OAuth2ServerFlow({
           serviceHost: HOST,
           grantDOMElementID: '#grant-button',
           ticketErrorCallback: ticketErrorCallback,
           jiveAuthorizeUrlErrorCallback: jiveAuthorizeUrlErrorCallback,
           oauth2SuccessCallback: successCallBack,
           preOauth2DanceCallback: preOauth2DanceCallback,
           onLoadCallback: onLoadCallback,
           authorizeUrl: HOST+"/jive/oauth/authorize",
           jiveOAuth2Dance: true,
           context: {
             placeURI : app.container["resources"]["self"]["ref"],
             jiveUserURI : app.viewer["resources"]["self"]["ref"]
           },
           popupWindowWidth: 500,
           popupWindowHeight: 400
       }).launch(/*{'viewerID': new Date().getTime()}*/);
    } // end if

} // end function

// //************************************************************************
// //NOTE: CALLED AS SOON AS THE CONFIG IS RESOLVED
// //************************************************************************
// function onConfig(tileConfig,tileOptions) {
//   console.log('onConfig',tileConfig,tileOptions);
//
// } // end function
//
// //************************************************************************
// //NOTE: CALLED AS SOON AS THE CONTAINER IS RESOLVED
// //************************************************************************
// function onContainer(container) {
//   console.log('onContainer',container);
// } // end function
//
// //************************************************************************
// //NOTE: CALLED AS SOON AS THE VIEWER IS RESOLVED
// //************************************************************************
// function onViewer(viewer) {
//   console.log('onViewer',viewer);
// } // end function
