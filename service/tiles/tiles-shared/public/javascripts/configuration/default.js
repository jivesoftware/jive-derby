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

  if ( typeof tileConfig === "string" ) {
      tileConfig = JSON.parse(tileConfig);
  } // end if

  if (tileConfig && tileConfig["derbyID"] && tileConfig["derbyName"]) {
    $('#current-config').html(tileConfig["derbyName"]);
    $('#current-config-wrapper').slideDown('fast',app.resize);
  } // end if

  /*** FETCH LIST OF AVAILABLE DERBY PLACES ***/
  osapi.jive.core.get({
    v: 'v3',
    format : 'json',
    href: "/extprops/derbyMapping?fields=resources.html,resources.self,name,resources.extprops,placeID,type&count=50"
  }).execute(
     function(response) {
       if (!response["error"]) {
         //TODO: NEED TO HANDLE PAGINATION, BUT FOR THE FORESEEABLE FUTURE WE ARE FINE
         if (response["list"] && response["list"].length > 0) {
           response["list"].forEach(
             function(obj) {
               console.log('***','Found Jive Object Marked as Derby Place',obj);
               if (obj["placeID"]) {
                 var extProps = obj["resources"]["extprops"]["ref"].substring(obj["resources"]["extprops"]["ref"].indexOf('/places'));
                 $('#derbyList').append('<option value="'+extProps+'">'+obj["name"]+' ('+obj["type"]+')</option>');
               } else {
                 //NOTE: THIS ISN'T LIKELY GIVEN WE CONTROL WHAT GETS MARKED, BUT THE API DOES ALLOW NON-PLACE ITEMS TO BE RETURNED
               } // end if
             } // end function
           );
           $('#select-derby-wrapper').slideDown('fast',app.resize);
         } else {
           $('#status-msg').html('There were no mapped Jive Derby places found.  Please use the <em><strong>Race Activity</strong></em> Tile to map a Jive Derby to a Place, and then try again.');
           $('#status-message-wrapper').slideDown('fast',app.resize);
         } // end if
       } else {
         console.log('***','Error Finding Mapped Jive Derby Places',response["error"]);
         $('#status-msg').html('There was an error finding mapped Jive Derby places. <br/><br/>'+JSON.stringify(response["error"]));
         $('#status-message-wrapper').removeClass('bg-info');
         $('#status-message-wrapper').addClass('bg-danger');
         $('#status-message-wrapper').slideDown('fast',app.resize);
       }// end if
     } // end function
   );

  $("#btn_save").click( function() {
      var placeExtPropsURI = $("#derbyList").val();
      osapi.jive.core.get({
        v: 'v3',
        format : 'json',
        href: placeExtPropsURI
      }).execute(
        function(response) {
          if (!response["error"] && response["content"]["derbyMapping"]) {
            /*** PICK UP WHAT WAS LOADED (AND MODIFIED SINCE LOADING) ***/
            var config = app.config || {};
            var derby = JSON.parse(unescape(response["content"]["derbyMapping"]));
            config["derbyID"] = derby["id"];
            config["derbyName"] = derby["name"];
            console.log('Saving Tile Configuration',config);
            jive.tile.close(config, {} );
          } else {
            //TODO: ADD METHODS
            $('#status-msg').html('Unable to save Jive Derby configuration.  Please make sure you have adequate permissions to the selected Jive Place. <br/><br/>'+JSON.stringify(response["error"]));
            $('#status-message-wrapper').removeClass('bg-info');
            $('#status-message-wrapper').addClass('bg-danger');
            $('#status-message-wrapper').slideDown('fast',app.resize);
          } // end if
        } // end function
      );
  });
} // end function

// //************************************************************************
// //NOTE: CALLED AS SOON AS THE CONFIG IS RESOLVED
// //************************************************************************
// function onConfig(tileConfig,tileOptions) {
//   console.log('onConfig',tileConfig,tileOptions);
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
