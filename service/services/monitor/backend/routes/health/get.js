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
var jive = require('jive-sdk');
var config = jive.service.options["ext"];

exports.route = function(req, res) {
    var conf = jive.service.options;
    var myConf = jive.service.options['ext'];

    //TODO: IMPLEMENT A REAL HEALTH CHECK

    // status values: ok, fault, unknown, intermittent, maintenance

    return res.status(200).send(
    	{
    	  'status': 'ok',
    	  'lastUpdate' : new Date().toISOString(),
    	  'messages' : [
    	      {
    	    	  'detail' : 'example detail',
    	    	  'fix' : 'example fix',
    	    	  'level' : 'info',
    	    	  'summary' : 'sample summary'
    	      }
    	  ],
    	  'resources' : [
       	      {
       	    	  'lastUpdate' : new Date().toISOString(),
    	    	    'name' : 'derbies',
    	    	    'status' : 'ok',
                'count' : '',
    	    	    'url' : 'http://www.jivesoftware.com'
    	        },
              {
       	    	  'lastUpdate' : new Date().toISOString(),
    	    	    'name' : 'races',
    	    	    'status' : 'ok',
                'count' : '',
    	    	    'url' : 'http://www.jivesoftware.com'
    	        },
    	 ]
    	}
    );
};
