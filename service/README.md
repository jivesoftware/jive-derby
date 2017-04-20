
![Jive Derby](../raspi/public/images/jive-derby-logo.png "Jive Derby")

# Cloud Environment
The cloud enviroment

## Dependencies
* Jive SDK v0.2.17+ (required for enhancements to add-on packaging)
* Node VM 6.9.x (or greater) (untested on v7.x)
* Postgres 9.6.1 (or native row_to_json, array_to_json support)

# Configuration

## Initialize DB Schema
See: **services/resources/db/jive-derby.sql** for a schema init script
TODO:  Automate

## Install the Jive Derby Add-On
TODO:  ADD DETAILS ... jive-sdk build addon ... use ./extension.zip > Add-On Console > Upload Add-On

## Add Jive Derby DES Client
TODO:  ADD DETAILS ... Add-On Console > Analytics Services > Add Client

## Configure the Jive Cloud Environment environment.js
Update the /tiles/tiles-shared/public/javascripts/environment.js accordingly
TODO: REMOVE THIS NEED ONCE WE HAVE A CHANCE TO REFACTOR MORE FOR PACKAGED SOLUTION WITH EXT-PROPS

## Disable Package Apps & Package Add-Ons (Optional)
In the event you want to iterate and do development, you may find it handy to disable the following properties in *jiveclientconfiguration.json*:
* packageApps
* packageAddOnConfigure

## Add Gamification Support (Optional)
TODO:  ADD DETAILS ...


See: https://docs.jivesoftware.com/cloud_int/comm_mgr/jive.help.rewards/#admin/RewardingActivityfromOtherSystems.html
or Bunchball documentation
or use your custom solution

## jiveclientconfiguration.json
There are a ton of configuration options in this file.  So let's get started.

### Required
* *clientUrl* - This is the URL where your service can be found.
>Note you need to provide this URL in the **raspi/jiveclientconfiguration.json**.

* *databaseUrl* - This is the database connect URL.
* *ext.service.securityHeader,securityValue* - This is the security token header/value that is expected for priveleged Jive Derby API calls.
>Note:  Must match **raspi/jiveclientconfiguration.json** > ext.security.remote.header,value

* *ext.jive.options.apiUserFields* - These are the allowed API fields that will be pulled from the Jive Service.
>Note:  Must be a superset of **raspi/jiveclientconfiguration.json** > ext.jive.extendedProfileFields

* *ext.jive.options.tenantID* - This should match the tenantID of your primary Jive Instance.
>Note:  This value can be found in the Add-On registration payload

* *ext.jive.des.service* - The DES service end-point you wish to use.  Default to US, alternatively use: *api-eu.jivesoftware.com*
* *ext.jive.des.clientID,clientSecret* - The DES clientID/secret generated from your Jive Instance.  See *Add DES Client ID/Secret* Steps (above)
* *ext.aws.s3.webURL* - The URL prefix for your AWS S3 bucket.  It can be the default AWS URL, or you can put a vanity URL on it.  Must be HTTPS!!!
* *ext.aws.s3.bucket* - Name of the bucket to place race photos and supporting interfaces.
* *ext.aws.iot.thing.name,host* - Must match your AWS IoT Configuration.  See [raspi > README.md](../raspi/README.md)

### Optional
TODO:

* *ext.aws.s3.defaultStorage* - If you want to configure the storage values for each photo, you can set it here.  Defaults to *STANDARD*
* *ext.defaults.echoClients.maxFailCount* - Number of times an echo client can fail before it is disabled.
* *ext.defaults.randomRacers* - An array of racer profile information that is used to mask real user name and identities to echo clients.

## resources/AWS.config.json
You will need to replace the access key/secret tokens in this file with your own values.

````json
{
  "accessKeyId": "TODO:REPLACE",
  "secretAccessKey": "TODO:REPLACE",
  "region": "us-east-1"
}
````
>**Note:**  At the time of creation, AWS IoT only works with **region** *us-east-1* (and other limited regions), be sure that this region is set accordingly.

# Starting Service

````bash
npm start
````

Once started, you will need to grab the **extension.zip** generated to upload to your Jive instance.  See *Install the Jive Derby Add-On* (above)

## Starting with AWS Elastic Bean Stalk
There is a lot of documentation to do here to configure the AWS EC2/ElasticBeanstalk instance.  All the files are located in this repo to convert this service into an AMI for EC2/EBS.

You can run the included **aws-zip.sh** in this directory to generate a compliant AMI archive for EBS.  

TODO: MORE Details
TODO: CONVERT TO FULLY AUTOMATED AWS SCRIPTS
