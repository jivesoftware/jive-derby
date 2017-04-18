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
'use strict';

var jive = require('jive-sdk');
var q = require('q');
var fs = require('fs');
var config = jive.service.options["ext"];
var util = require('util');
var path = require('path');
var mime = require('mime-types');

//TODO: MOVE TO CENTRAL COMPONENT OR CONSOLIDATE IOT TO THIS HELPER
var AWS = require('aws-sdk');
AWS.config.setPromisesDependency(require('q'));

/*** SEE: http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html ***/

//*** Example of reading in credentials from AWS.config (INI format) ***
//*** Note:  You can also set AWS_PROFILE environment variable
//*** File must be located in ~/.aws/credentials
//AWS.config.credentials = new AWS.SharedIniFileCredentials({profile: 'test-2'});

//*** Example of read in credentials from JSON file ***
AWS.config.loadFromPath('./resources/AWS.config.json');

var s3 = new AWS.S3();

var S3Helper = {};
var s3config = config["aws"]["s3"];

S3Helper.init = function() {

  //TODO:  CHAIN THESE TOGETHER IN PROMISES via .promise();

  function defaultBucketError(err,bucket) {
    jive.logger.error('S3','Unexpected Condition',err,bucket);
  } // end function

  function processDefaultFiles() {
    var s3dir = process.cwd() + s3config["defaultFiles"];

    var deferred = q.defer();

    function pushFile(file) {
      var deferred = q.defer();

      var pathKey = file.substring(s3dir.length + 1);
      var contentType = mime.lookup(file);

      var fileStream = fs.createReadStream(file);

      fileStream.on('open',
        function () {
          saveS3File(s3config["bucket"],pathKey,fileStream,contentType).then(
             function(data) {
               deferred.resolve();
               /*** NOOP ***/
             }, // end function
             function(err) {
               /*** NOOP ***/
               deferred.reject();
             } // end function
          );
      });

      return deferred.promise;
    } // end function

    function pushDir(file) {
      var deferred = q.defer();

      var pathKey = file.substring(s3dir.length + 1);

      s3.putObject({ Bucket : s3config["bucket"],Key : pathKey + "/", Body : "", ACL : "public-read" },
        function(err,bucket) {
          if (!err) {
            jive.logger.info('Successfully created S3 folder',s3config["bucket"],pathKey);
            deferred.resolve();
          } else {
            jive.logger.warn('Failed to create S3 folder',s3config["bucket"],pathKey);
            deferred.reject();
          } // end if
      });

      return deferred.promise;
    } // end function

    function crawl(dir) {
      var fileList = fs.readdirSync(dir);
      fileList.forEach(
        function(fileName) {
          var filePath = path.join(dir,fileName);
          var stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            pushDir(filePath).then(
              function() {
                crawl(filePath,true);
              } // end function
            );
          } else if (stat.isFile()) {
            pushFile(filePath).then(
              function() {
                /*** NOOP ***/
              } // end function
            );
          } // end if
        } // end function
      );
    } // end function

    crawl(s3dir);

    deferred.resolve();

    return deferred.promise;
  } // end function

  s3.headBucket({ Bucket : s3config["bucket"] },
    function(err,bucket) {
      if (err) {
        if (err["statusCode"] === 404) {
          jive.logger.info("S3 Bucket",s3config["bucket"],"Not Found.  Creating New Bucket!");
          s3.createBucket({
            Bucket : s3config["bucket"],
            CreateBucketConfiguration : {
              LocationConstraint : s3config["location"]
            }
          },
          function(err,bucket) {
            if (err) {
              jive.logger.fatal("S3 Bucket",s3config["bucket"]," Cound Not Be Created.  Please see error and try-again.",err);
            } else {
              //TODO: DO HEAD CHECK PRIOR TO CREATE
              //TODO:  CODE TO REDUCE THE DUPLICATION OF BUCKET NAME IN ALL CONFIG DEVICES

              /*** CONFIGURE BUCKET POLICY ***/
              s3.putBucketPolicy({
                Bucket : s3config["bucket"],
                Policy : util.format(s3config["policy"],s3config["bucket"])
              },defaultBucketError);

              processDefaultFiles().then(
                function() {
                  jive.logger.debug("","Configuring S3 Website Configuration",s3config["bucket"]);
                  //TODO:  CONFIRM THAT THIS IS WORKING...CHECKED ONCE AND DIDNT SEE IT
                  /*** CONFIGURE WEBSITE SETTINGS ***/
                  s3.putBucketWebsite({
                    Bucket : s3config["bucket"],
                    WebsiteConfiguration : s3config["websiteConfig"]
                  },function(err,bucket) {
                    //TODO:  THIS MESSAGE IS NOT SHOWING UP IN THE LOGS CORRECTLY, DOUBLE CHECK PROMISE CHAIN
                    jive.logger.info("S3 Bucket",s3config["bucket"],"is available and Ready!");
                  });
                } // end function
              );
            } // end if
          });
        } else {
          jive.logger.fatal("S3 Bucket",s3config["bucket"]," Not Found, but auto-recover unavailable.  Please see error and try-again.",err);
        } // end if
      } else {
        jive.logger.info("S3 Bucket",s3config["bucket"],"is available and Ready!");
      }// end if
    } // end function
  );

} // end function

function saveS3File(bucket,pathKey,fileStream,contentType,metadata,storageClass,acl) {
  jive.logger.debug('','saveS3File',bucket,pathKey,contentType,metadata,storageClass,acl);
  var deferred = q.defer();
  storageClass = storageClass || s3config["defaultStorage"];     //TODO:  MAKE THIS CONFIGURABLE //"StorageClass" : "STANDARD_IA",
  acl = acl || "public-read";

  var obj = {
    "Bucket" : bucket,
    "Key" : pathKey,
    "Body" : fileStream,
    "StorageClass" : storageClass,
    "ACL" : acl
  };
  if (metadata) {
    obj["Metadata"] = metadata;
  } // end if
  if (contentType) {
    obj["ContentType"] = contentType;
  } // end if
  s3.putObject(obj,function(err,data) {
    if (!err) {
      jive.logger.debug("Successfully Added File",pathKey);
      deferred.resolve(data);
    } else {
      jive.logger.error("Failed to Add File",err);
      deferred.reject(err);
    } // end if
  });

  return deferred.promise;
} // end function

S3Helper.saveRacePhoto = function(options) {
  jive.logger.debug("s3.saveRacePhoto...");

  var bucketName = config["aws"]["s3"]["bucket"];
  var webURL = util.format(config["aws"]["s3"]["webURL"],bucketName);
  var noPhotoURL = util.format(config["aws"]["s3"]["noPhotoImage"],webURL);
  var derbyID = options["data"]["derby"]["id"];
  var raceID = options["data"]["raceID"];
  var photo = options["photo"];

  var deferred = q.defer();

  var fileMetadata = {
    "derbyID" : derbyID.toString(),
    "raceID" : raceID.toString()
  };

  var fileName = process.cwd()+"/"+photo["path"];
  var fileStream = fs.createReadStream(fileName);

  fileStream.on('error', function (err) {
    /*** NOT STOPPING THE CHAIN FOR A FAILED PHOTO ***/
    jive.logger.error("Error finding temporary race photo, continuing",raceID,err);
    options["data"]["photoURL"] = noPhotoURL;
    deferred.resolve(options)
  });

  fileStream.on('open', function () {
    saveS3File(bucketName,
              //TODO: CHANGE TO util.format
              //TODO: UNHARD CODE FROM GIF/PNG
              "photos/derby/"+derbyID+"/"+raceID+".gif",
              fileStream,"image/gif",fileMetadata).then(
      function(data) {
        jive.logger.debug("Successfully Read File",fileName);
        //TODO: CHANGE TO util.format
        options["data"]["photoURL"] = webURL+"/photos/derby/"+derbyID+"/"+raceID+".gif";
        deferred.resolve(options);
      }, // end function
      function(err) {
        jive.logger.error("Unable to Save Race Photo, Continuing...",err);
        options["data"]["photoURL"] = noPhotoURL
        deferred.resolve(options)
      } // end function
    );
  });

  fileStream.on('end', function () {
    fs.unlink(fileName, function() {
       jive.logger.debug("Removing TMP File",fileName);
     });
  });

  return deferred.promise;
};

module.exports = S3Helper;
