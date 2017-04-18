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
  console.log('onReady',tileConfig,tileOptions);

  if ( typeof tileConfig !== 'object' ) {
      tileConfig = JSON.parse(unescape(tileConfig) || {} );
  } // end if

  /*** FETCH LIST OF AVAILABLE DERBIES ***/
  var leaderboardURI = tileConfig["leaderboardURI"]; //.substring(tileConfig["leaderboardURI"].indexOf('/api'));
  console.log('****',leaderboardURI);
  osapi.jive.corev3.contents.get({
      "type": "document",
      "uri": leaderboardURI,
      "fields": "content.text"
  }).execute(
      function (response) {
        if (!response["error"] && response["content"]) {
            $('#leaderboard-wrapper').html(response["content"]["text"]);
            $('table').attr('width',500);
            $('table').css('width',500);
            for (x=0; x<100; x++) {
              $('#leaderboard-wrapper').append('<ul><li><h1>HEllo</h1></li></ul>');
            }
            //app.resize();
        } // end if
      } // end function
    );

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
