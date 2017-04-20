#!/bin/bash

# A LOW TECH GENERATOR FOR AWS EBS TO UPLOAD AMI IMAGE
# TODO: REPLACE WITH SCRIPT TO NOT JUST ZIP BUT DEPLOY TO AWS

export fileName='jive-derby-aws-'$(($(date +"%Y%m%d%H%M%S")))'.zip'
echo Generating $fileName...
zip $fileName -r .ebextensions \
apps \
extension_src \
lib \
public \
resources \
services \
templates \
tiles \
app.js \
Dockerfile \
Dockerrun.aws.json \
jiveclientconfiguration.json \
LICENSE \
package.json \
README.md
