var ACTION_IDS = [
  "org.jivesoftware.jivederby.app.profile.tab",
  "org.jivesoftware.jivederby.app.profile.navbar"
];

var jiveURL;

/*** USED TO STORE LOCAL COPIES TO ALL RACES RETRIEVED ***/
var CONTENT_MAP = {};

/*** TODO: SYNC BETTER WITH jiveclientconfiguration.json ***/
var MEASUREMENT_UNITS = {
  "humidity" : "%",
  "temperature" : "F",
  "uv" : "",
  "ambient-light" : "lux",
  "distance" : "ft",
  "microphone" : "dBA",
  "pressure" : "inHg",
  "split" : "sec"
};

var MEASUREMENT_LABELS = {
  "distance" : "Distance",
  "temperature" : "Temperature",
  "humidity" : "Humidity",
  "ambient-light" : "Ambient Light",
  "uv" : "UV Index",
  "microphone" : "Sound Level",
  "sound-level" : "Sound Level",
  "pressure" : "Pressure",
  "split1" : "Split 1",
  "split2" : "Split 2",
  "split3" : "Split 3",
  "split4" : "Split 4"
};

function hydrateRaceContext(content, data) {
  var context = {
    derby : {
      id : data["derbyID"],
      name : data["derbyName"]
    },
    race : {
      id : data["raceID"],
      name : data["raceName"],
      photoURL : data["photoURL"],
      splits : [ data["split1"], data["split2"], data["split3"], data["split4"] ].filter(function(i) { return (i != undefined); }),
      results : [],
      timestamp : moment(new Date(data["timestamp"])).startOf('hour').fromNow(),
    },
    measurements : [],
    content : {
      uri : content["resources"]["self"]["ref"],
      url : content["resources"]["html"]["ref"],
      subject : content["subject"]
    }
  };

  /*** ADD IN RESULTS ***/
  for (x=1; x<=8; x++) {
    if (data["lane"+x]) {
      context["race"]["results"].push({
        racerID : data["lane"+x],
        lane : x,
        rank : data["rank"+x],
        speed : data["speed"+x],
        totalTimeSec : data["totalTimeSec"+x]
      })
    } else {
      break;
    } // end if
  } // end for x

  if (context["race"]["splits"].length > 0) {
    context["race"]["splits"].forEach(
      function(split,idx) {
        context["measurements"].push({
          type : "split"+(idx+1),
          value : split,
          label : MEASUREMENT_LABELS["split"+(idx+1)],
          unit : MEASUREMENT_UNITS["split"]
        });
      } // end function
    );
  } // end if
  
  /**** ADD IN MEASUREMENTS ***/
  Object.keys(data).filter(function(i) { return i.startsWith('env-'); }).forEach(
    function(key) {
        console.log('***',key);
        var measureType = key.substring('env-'.length);
        context["measurements"].push({
          type : measureType,
          value : data[key],
          label : MEASUREMENT_LABELS[measureType],
          unit : MEASUREMENT_UNITS[measureType]
        });
    } // end function
  );

  return context;
} // end function

function onToggleData(event) {
  if ($('#race-results-wrapper').is(':visible')) {
    $('#race-results-wrapper').hide();
    $('#measurements-wrapper').show();
    $('#toggle-type').html('Race Results');
  } else {
    $('#measurements-wrapper').hide();
    $('#race-results-wrapper').show();
    $('#toggle-type').html('Measurements');
  } // end if
  app.resize();
} // end function

function onRaceClick(event) {
  $('.race-tile').removeClass('bg-primary');
  $(this).addClass('bg-primary');
  $('#race-details').hide();
  $('#race-loading').show();
  var contentID = $(this).data('contentid');
  var obj = CONTENT_MAP[contentID];
  if (obj) {
    obj.getExtProps().execute(
      function(extProps) {
        if (extProps["content"]) {
          var raceContext = hydrateRaceContext(obj,extProps["content"]);
          $('#race-details').html(
            fillTemplate('race-details-template',raceContext)
          );
          raceContext["race"]["results"].forEach(
            function(result) {

              //*** TODO:

              $("#race-results tbody").append(fillTemplate('race-result-template',{
                "racer": {
                  id : result["racerID"],
                  avatarURL : jiveURL + '/api/core/v3/people/'+result["racerID"]+'/avatar'
                },
                "result" : result
              }));
            } // end function
          );

          /*** DISPLAY ANY AND ALL MEASUREMENTS WE'VE COLLECTED ***/
          raceContext["measurements"].forEach(
            function(measurement) {
              $("#measurements").append(fillTemplate('measurement-template',{ measurement : measurement}))
            } // end function
          );
        } //end if
        $('#toggle-control').click(onToggleData);
        $('tr.rank-1').addClass('info');
        $('tr[data-racer="'+app.viewer["id"]+'"]').addClass('success');
        $('#race-loading').hide();
        $('#race-details').slideDown('fast',function() {
          app.resize();
        });
      } // end function
    );
  } else {
    $('#race-details').html('ERROR: TODO');
  } // end if
};

function initUI() {
  if (app.viewer != undefined &&
      app.actionContext.object != undefined) {
      var ctx = app.actionContext.object;

      /*** CUSTOMIZE THE UI TO REFLECT PERSONAL RESULTS OR NOT ***/
      if (ctx["id"] === app.viewer["id"]) {
        $('#title').prepend('<em>Your</em> ').show();
      } else {
        $('#title').append(' - '+ctx["displayName"]).show();
      }

      $('#racer-avatar').attr('src',ctx["resources"]["avatar"]["ref"]).show();

      /*** ADD THE RACE TILES ***/
      function addRaceTiles(data) {
        if (data['list']) {
          data["list"].forEach(
            function(content) {
               /*** FOR FUTURE LOOK UP ***/
               CONTENT_MAP[content['contentID']]= content;
               var titleTokens = content["subject"].split(" - ");

               $('#race-nav').append(
                 fillTemplate('race-tile-template',{
                  content : {
                    id : content['contentID']
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
            } // end function
          );
          //TODO: ADD IN NEXT PAGE RECURSION
        } // end if
      } // end function

      /*** FETCH THE RACE TILES ***/
      osapi.jive.core.get({
        v: 'v3',
        href: "/extprops/racer-"+ctx["id"]+"/"+ctx["id"],
      }).execute(
         function(response) {
           addRaceTiles(response);
           $('#race-loading').hide();
           $('.race-tile').click(onRaceClick);
           $(".race-tile").hover(function(){
              $(this).addClass("bg-info");
             }, function(){
              $(this).removeClass("bg-info");
             }
           );
           app.resize();
         } // end function
      );
  } // end if
} // end initUI

function onReady(env) {
  console.log('onReady',env);
  jiveURL = env["jiveUrl"];

  //TODO: ADD IN UI INIT STUFF

  app.resize();
} // end function

/************************************************************************
  STEP 3 - Use this method if you only want to perform something once the Viewer has been resolved
  NOTE: If not needed, you can remove the entire function
************************************************************************/
function onViewer(viewer) {
  console.log("onViewer",viewer,"console");
  initUI();
} // end function

/************************************************************************
  STEP 4 - Use this method if you only want to perform something once the View Context has been resolved
  NOTE: If not needed, you can remove the entire function
************************************************************************/
function onView(context) {
  console.log("onView",context);

} // end function

/************************************************************************
  STEP 5 - Use this method if you only want to perform something once the Action Context has been resolved
  NOTE: If not needed, you can remove the entire function
************************************************************************/
function onAction(context) {
  console.log("onAction",context);
  initUI();
} // end function

/************************************************************************
  STEP 6 - Use this method if you only want to perform something once the Data Context has been resolved
  NOTE: If not needed, you can remove the entire function
************************************************************************/
function onData(data) {
  console.log("onData",data);
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
