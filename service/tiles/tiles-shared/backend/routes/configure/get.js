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

 var jive = require("jive-sdk");
 var config = jive.service.options["ext"];

 const _SHARED_TILE = "shared";

 exports.route = function(req, res){
    var sharedTileConfig = config["jive"]["tiles"][_SHARED_TILE]

    var tileName = req.query.tile || _SHARED_TILE;

    var configurationUI = sharedTileConfig["configuration-ui"];
    if (config["jive"]["tiles"][tileName]["configuration-ui"]) {
        configurationUI = config["jive"]["tiles"][tileName]["configuration-ui"];
    } // end if

    var configData = {
      host : jive.service.serviceURL(),
      tileName : tileName,
      tileHeader : config["jive"]["tiles"][tileName]["tileConfigHeader"]
    };

    res.render(configurationUI,configData);
 };
