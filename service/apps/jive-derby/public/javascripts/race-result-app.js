var ACTION_IDS = [];

var winner = null;

function onReady(env) {
  console.log('onReady',env);
  var jiveURL = env["jiveUrl"];

  //TODO: ADD IN UI INIT STUFF

  app.resize();
} // end function

/************************************************************************
  STEP 3 - Use this method if you only want to perform something once the Viewer has been resolved
  NOTE: If not needed, you can remove the entire function
************************************************************************/
function onViewer(viewer) {
  console.log("onViewer",viewer);
  findViewerInResults();

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

function fillWinnerTemplate(data) {
  var ts = moment(new Date(data["timestamp"]));
  return fillTemplate("winner-hero-template",{
    "racer" : winner["racer"],
    "derby" : data["derby"],
    "race" : {
      "name" : (data["raceName"]) ? data["raceName"] : data["raceID"],
      "date" : ts.format('MMMM Do YYYY'),
      "time" : ts.format('h:mm:ss a')
    },
    "result" : winner
  });
} // end fillWinnerTemplate

/************************************************************************
  STEP 6 - Use this method if you only want to perform something once the Data Context has been resolved
  NOTE: If not needed, you can remove the entire function
************************************************************************/
function onData(data) {
  console.log("onData",data);

  /**** DETERMINE THE WINNER BASED ON RESULT RANK ***/
  winner = data["results"].filter(  function(result) {  return (result["rank"] === 1); })[0];

  /*** SET ATTRIBUTE FOR RACE PHOTO ***/
  $('#race-img').attr('src',data["photoURL"]);
  $('#race-img').parent().attr('href',data["photoURL"]);

  /*** UPDATE WINNER HERO ***/
  $(".winner-hero").html(fillWinnerTemplate(data));

  /**** MARK THE RACE AS DEBUG IF APPROPRIATE, MUST RUN AFTER WINNER-HERO POPULATES ***/
  if (data["diagnostic"]) {
    $('#raceMode').show();
  } // end if

  /*** DISPLAY ANY RESULTS WE'VE COLLECTED ***/
  data["results"].forEach(
    function(result) {
      $("#race-results tbody").append(fillTemplate('race-result-template',{ "racer" : result["racer"], "result" : result }));
    } // end function
  );

  /*** ADDING WINNER HIGHLIGHT ***/
  $('#race-results tbody .rank-1').addClass("info");

  findViewerInResults();

  //TODO: PUT IN BETTER LOCATION (i.e. UNHARDCODE)
  //TODO: WILL MATCH THE VALUES FROM ThunderboardReact.js
  var measurementLabels = {
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

  /*** ADD IN RACE SPLITS ****/
  //TODO:

  /*** DISPLAY ANY AND ALL MEASUREMENTS WE'VE COLLECTED ***/
  data["measurements"].forEach(
    function(measurement) {
      measurement["label"] = (measurementLabels[measurement["type"]]) ? (measurementLabels[measurement["type"]]) : measurement["type"];
      measurement["unit"] = measurement["unit"] || "";
      $("#measurements").append(fillTemplate('measurement-template',{ measurement : measurement}))
    } // end function
  );

  $('#main-wrapper').slideDown('fast',function() {
    app.resize();
  });

} // end function

function findViewerInResults() {
  if (app.data && app.viewer) {
      //TODO:  CHECK TO MAKE SURE THAT THE JIVE INSTANCE FOR THE RACER IS THE SAME AS THE JIVE INSTANCE VIEWING THE RESULTS
      $('a[data-racerid="'+app.viewer["resources"]["self"]["ref"]+'"]').closest('tr').addClass('success');
      app.resize();
  } // end if
} // end function
