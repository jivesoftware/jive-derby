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

var raceData = {
  splits : [ ],
  times : [ [], [], [], [] ],
  measurements : {}
};

var lineColors = [  'rgba(255,99,132,1)', 'rgba(54, 162, 235, 1)',  'rgba(75, 192, 192, 1)', 'rgba(255, 206, 86, 1)' ];

//************************************************************************
//NOTE: CALLED AS SOON AS THE FULL CONTEXT IS RESOLVED
//************************************************************************
function onReady(tileConfig,tileOptions,viewer,container) {
  console.log('onReady',tileConfig,tileOptions,viewer,container);

  if ( typeof tileConfig !== 'object' ) {
      tileConfig = JSON.parse(unescape(tileConfig) || {} );
  } // end if

  $('.nav-item').click(handleNavClick);

  /*** FETCH LIST OF AVAILABLE DERBIES ***/
  osapi.http.get({
    'href' : HOST + "/api/derby/"+tileConfig["derby"]["id"]+"/snapshot",
    'format' : 'json',
    'authz' : 'signed',
    'headers' : { 'Content-Type' : ['application/json'] }
  }).execute(
      function (response) {
        if (!response["error"] && response["content"]) {
          initRaceData(response["content"]);

          $('#loading-wrapper').hide();
          $('#stats-wrapper').slideDown('fast',function() {
              app.resize();
              /*** CLICK THE FIRST VISIBLE ELEMENT ***/
              $('.nav-item:visible:first').click();
          });
        } else {
          console.log('****','error',response["error"]);
          $('#loading-wrapper').hide();
          $('#no-data-wrapper').show();
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

function initRaceData(rawResults) {

  rawResults["data"].forEach(
    function(result) {

      /*** SPLITS ***/
      if (result["split1"]) {
        $(".nav-item[data-report='splits']").show();
        var splits = [ result["split1"], result["split2"], result["split3"], result["split4"] ].filter(function(x) { return (x > 0); });
        splits.forEach(
          function(split,idx) {
            raceData["splits"][idx] = raceData["splits"][idx] || [];
            raceData["splits"][idx].push(split);
          } // end function
        );
      } // end if

      /*** TIMES ***/
      if (result["results"] && result["results"].length) {
        $(".nav-item[data-report='time']").show();
        $(".nav-item[data-report='speed']").show();
        result["results"].forEach(
          function(val,idx,arr) {
            raceData["times"][idx].push({
              speed : val["speed"],
              totalTimeSec : val["totalTimeSec"]
            });
          } // end if
        ); // end forEach
      } // end if


      /*** MEASUREMENTS ***/
      result["measurements"].forEach(
        function(val) {
          /*** DISPLAY THE NAV ITEM ***/
          $(".nav-item[data-report='measurement-"+val["type"]+"']").show();
          raceData["measurements"][val["type"]] = raceData["measurements"][val["type"]] || [];
          raceData["measurements"][val["type"]].push(val);
        } // end function
      ); // end forEach

    } // end function
  );
  console.log('***','raceData',raceData);
} // end function

function handleNavClick(item) {
  var chartType = $(this).data('report');
  var chartCtx = $('#raceHistoryChart');

  $('#stats-nav ul li').removeClass('bg-primary');
  $(this).parent().addClass('bg-primary');

  if (chartType === "time") {
    displayChart(
      chartCtx,
      "Lane Times (seconds)",
      [ "Lane #1", "Lane #2", "Lane #3", "Lane #4" ],
      [
        raceData["times"][0].map(function(x) { return x["totalTimeSec"]; }),
        raceData["times"][1].map(function(x) { return x["totalTimeSec"]; }),
        raceData["times"][2].map(function(x) { return x["totalTimeSec"]; }),
        raceData["times"][3].map(function(x) { return x["totalTimeSec"]; })
      ]
    );
  } else if (chartType === "speed") {
    displayChart(
      chartCtx,
      "Lane Speed (ft/sec)",
      [ "Lane #1", "Lane #2", "Lane #3", "Lane #4" ],
      [
        raceData["times"][0].map(function(x) { return x["speed"]; }),
        raceData["times"][1].map(function(x) { return x["speed"]; }),
        raceData["times"][2].map(function(x) { return x["speed"]; }),
        raceData["times"][3].map(function(x) { return x["speed"]; })
      ]
    );
  } else if (chartType === "splits") {
    displayChart(
      chartCtx,
      "Lane Splits (seconds)",
      [ "Split 1", "Split 2" ],
      [
        raceData["splits"][0],
        raceData["splits"][1]
        //*** TODO: MAKE MORE DYNAMIC
        // ,
        // raceData["splits"][2].map(function(x) { return x["speed"]; }),
        // raceData["splits"][3].map(function(x) { return x["speed"]; })
      ]
    );
  } else if (chartType === "measurement-microphone") {
    displayChart(
      chartCtx,
      "Environment - Sound Levels",
      [ "dBA" ],
      [ raceData["measurements"]["microphone"].map(function(x) { return x["value"]; }) ]
    );
  } else if (chartType === "measurement-temperature") {
    displayChart(
      chartCtx,
      "Environment - Temperature",
      [ "F" ],
      [ raceData["measurements"]["temperature"].map(function(x) { return x["value"]; }) ]
    );
  } else if (chartType === "measurement-humidity") {
    displayChart(
      chartCtx,
      "Environment - Humidity",
      [ "%" ],
      [ raceData["measurements"]["humidity"].map(function(x) { return x["value"]; }) ]
    );
  } // end if
} // end function

function displayChart(ctx,title,labels,datasets) {
  console.log('****','displayChart',title,labels,datasets);

  $('#stats-wrapper').hide();
  $('#loading-wrapper').show();

  $('#chartHeader').html(title);

  //TODO:  DO WE NEED TO CLEAR THE CANVAS FIRST?

  var chartData = {
      type: 'line',
      data: {
        datasets : []
      },
      options: {
          scales: {
              yAxes: [{
                  ticks: {
                      beginAtZero:true
                  }
              }]
          }
      }
  };
  //*** TODO: CHANGE IMPLEMENTATION UPSTREAM TO BE MORE LOGICALLY BOUND ***/
  labels.forEach(
    function(label,idx) {
      chartData["data"]["datasets"].push({
        label: labels[idx],
        tension : 0,
        fill : false,
        data: datasets[idx],
        borderColor: [ lineColors[idx] ],
        borderWidth: 1
      });
    } // end function
  );

  $('#loading-wrapper').hide();
  new Chart(ctx,chartData);
  $('#stats-wrapper').slideDown('fast',app.resize);
} // end function
