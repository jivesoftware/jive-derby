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
  initUI();
} // end function

/*** ADD THE RACE TILES ***/
function addRaceItems(derbyID,data) {
  if (data['list']) {
    data["list"].forEach(
      function(content) {
         // POSSIBLE BUG IN Jive 9.0
         //if (content["externalID"] && content["externalID"].startsWith('jderby-'+derbyID+'-')) {
         //console.log('***','Adding to UI',content["externalID"]);
           var titleTokens = content["subject"].split(" - ");

           $('#race-list').append(
             fillTemplate('race-item-template',{
              content : {
                id : content['contentID'],
                url : content["resources"]["html"]["ref"]
              },
              derby: {
                name: titleTokens[0]
              },
              race: {
                name: titleTokens[1],
                time: moment(content['published']).startOf('hour').fromNow()
              }
             })
           );
        //  } else {
        //    console.log('***','Skipping in UI',derbyID,content["externalID"]);
        //  } // end if
      } // end function
    );
  } // end if

  $('#loading-wrapper').hide();

  /*** CHECK TO SEE THERE ARE ANY RACES LISTED AFTER FILTERING ***/
  if ($('#race-list li').size() > 0) {
    $('#races-wrapper').slideDown('fast',app.resize);
  } else {
    $('#no-data-wrapper').slideDown('fast',app.resize);
  } // end if
} // end function

function initUI() {
  if (app.viewer != undefined &&
      app.config != undefined) {
        var derbyID = app.config["derbyID"];

        /*** FETCH THE RACE TILES ***/
        osapi.jive.core.get({
          v: 'v3',
          href: "/extprops/racer-"+app.viewer["id"]+"/"+app.viewer["id"],
        }).execute(
           function(response) {
             addRaceItems(derbyID,response);
           } // end function
        );
  } // end if
} // end function

function fillTemplate(templateID,data) {
  var template = $('#'+templateID).html();
  Object.keys(data).forEach(
    function(key) {
      Object.keys(data[key]).forEach(
        function(prop) {
          template = template.replace(new RegExp("{{"+key+"."+prop+"}}","g"),data[key][prop]);
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
