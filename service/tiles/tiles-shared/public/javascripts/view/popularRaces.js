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

  $('#loading-wrapper').hide();
  if (tileConfig["races"] && tileConfig["races"].length > 0) {
    tileConfig["races"].forEach(
      function(race) {
        var numUnlikes = (isNaN(race["Unlike"])) ? 0 : race["Unlike"];
        var html = fillTemplate('race-row-template',{
            race : {
              url : race["url"],
              label : race["subject"].split(' ')[2],
              numComments : (race["Comment"] || 0),
              numLikes : (numUnlikes > 0) ? (race["Like"] - numUnlikes) : (race["Like"] || 0),
              numShares : (race["Share"] || 0),
              numViews : (race["View"] || 0),
              numOutcomes : (race["CreateOutcome"] || 0)
            }
          });
        $("#race-results tbody").append(html);
      } // end if
    );

    //TODO: IMPLEMENT TILE ACTION FOR THIS ... POSSIBLY RENDER META-DATA IN AN ACTION WINDOW
    // $('a.race-link').click(
    //   function(event) {
    //     // RUN THE TILE ACTION
    //     jive.tile.doAction(this, {
    //       "privateString" : $("#private_string").text()
    //     }).then(
    //       function(actionData) {
    //         //NOTE: ACTION DATA HAS THE INFORMATION PASSED TO jive.tile.close()
    //
    //         /*** POSSIBLY UPDATE PRIVATE PROPS OR SOMETHING ELSE, HERE IS AN EXAMPLE POTENTIALLY ***/
    //         jive.tile.updatePrivateProps ( {
    //             "privateString" : actionData["privateString"]
    //         }, function(returnObject) {
    //             console.log("Updated private properties: ", returnObject);
    //             $("#private_string").text(returnObject["privateString"]);
    //         });
    //
    //         // Resize window
    //         app.resize();
    //     }, function() {
    //         alert("Canceled action");
    //     });
    //   } // end function
    // );

    $('#races-wrapper').slideDown('fast',app.resize);
  } else {
    $('#no-popular-data-wrapper').slideDown('fast',app.resize);
  } // end if

  app.resize();
} // end function

function fillTemplate(templateID,data) {
  var template = $('#'+templateID).html();
  Object.keys(data).forEach(
    function(key) {
      Object.keys(data[key]).forEach(
        function(prop) {
          template = template.replace(new RegExp("{{"+key+"."+prop+"}}","gi"),data[key][prop]);
        } // end function
      );
    } // end function;
  );
  return template;
} // end replaceTemplate

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
