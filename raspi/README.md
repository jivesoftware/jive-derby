
![Jive Derby](./public/images/jive-derby-logo.png "Jive Derby")

# Local Environment

## Raspberry Pi 3

### Environment Setup
The following are the known steps needed to configure a bare-bones Raspberry Pi 3 for the Jive Derby.

#### Operating System - Raspbian Lite
At the time of this project, **Raspbian Jessie** was the current Raspbian version.  While we see no reason more updated versions of Raspbian won't work, we are documenting the specific version [here](https://downloads.raspberrypi.org/raspbian_lite/images/raspbian_lite-2017-04-10/)

#### Install apt-get Modules
````bash
# Updates RPi To Latest Firmware
sudo apt-get install rpi-update
sudo rpi-update
## Needed to Sync Code from Github
sudo apt-get install git
## Needed for LIBUSB
sudo apt-get install libudev-dev
sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev blueman pi-bluetooth
# Needed for Image Processing
sudo apt-get install libjpeg-dev
# Needed for Random Python Libs (optional)
sudo apt-get install python-setuptools python-dev build-essential python-pip libgtk2.0-dev

# Once complete, restart the Raspberry Pi
sudo reboot
````

#### Manual Installed Libraries

##### ImageMagick
This library is also used with the creation of the animated GIF for the Jive Derby race.

**Example Commands**
````bash
cd /tmp
wget https://www.imagemagick.org/download/ImageMagick.tar.gz
tar xvzf ImageMagick.tar.gz
cd ImageMagick-*
./configure
make
sudo make install
make check
````

##### GraphicsMagick
This library is also used with the creation of the animated GIF for the Jive Derby race.  It leverages components of ImageMagick under the covers, hence the other installation.

**Example Commands**
````bash
cd /tmp
wget https://downloads.sourceforge.net/project/graphicsmagick/graphicsmagick/1.3.25/GraphicsMagick-1.3.25.tar.gz
tar xvzf ImageMagick.tar.gz
cd ImageMagick-*
./configure
make
sudo make install
make check
````

##### ngrok (Optional, but Highly Recommended)
If you would like to access the Raspberry Pi from a secure HTTPS tunnel, ngrok is a great utility.  Download, unzip, install and configure.  More details at https://ngrok.com/download.

**Example Commands**
````bash
cd /tmp
wget https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-stable-linux-arm.zip
unzip ngrok-stable-linux-arm.zip
sudo mv ngrok /usr/local/bin
sudo chmod 755 /usr/local/bin/ngrok
ngrok authtoken {YOUR_AUTH_TOKEN_ONCE_REGISTERED_ON_NGROK}
````

>Note: In **raspi/package.json** you can customize/remove the **ngrok** start command / parameters.

#### Manual Setup Steps

##### Sync Jive Derby Repo from Github
````bash
cd ~
git clone https://github.com/jivesoftware/jive-derby.git
````

##### Update jiveclientconfiguration.json

###### Required
* *clientUrl* - This should match the URL that you will want to access the admin console with.

* *ext.defaults.cloudServiceURL* - This is the URL where your Jive Derby cloud service is located.
>Note:  This is defined in **service/jiveclientconfiguration.json** > clientUrl.

* *ext.defaults.diagnosticMode* - Use this to set the default diagnostic mode for your derby.

* *ext.defaults.maxLanes* - Should match your derby track configuration.
* *ext.jive.tenantID* - This is the tenantID of the Jive Instance that will act as your identity provider.
>Note:  You can get this value from the community table in your DB once the add-on has been installed.
* *ext.jive.extendedProfileFields* - Identify any extended profile fields you would like to bring over.  Must match the API field name.
>Note:  Must be a subset of **service/jiveclientconfiguration.json** > ext.jive.options.apiUserFields
* *ext.security.local.username* - Local HTTP Basic username used to access the Admin Interface
* *ext.security.local.password* - Local HTTP Basic password used to access the Admin Interface
* *ext.security.remote.header,value* - Remote HTTP Header & value to add to privileged Jive Derby API calls.
>Note:  Must match **service/jiveclientconfiguration.json** > ext.service.securityHeader,securityValue
* *ext.derby.id,name* - The default Derby ID key and name for your local service.
>Note:  On startup, the local service will insure this derby exists in the database.
* *ext.ryg-light-tree.enabled* - If you are using the RYG stoplight, then enable it.  *Note the GPIO Pin numbers.*
* *ext.ir-break-sensors.[].enabled* - If you are using the IR Break Sensor(s), then enable it. *Note the GPIO Pin numbers.*
* *ext.derby-timer.enabled* - If you are using the IR Break Sensor(s), then enable it. *Note: the trackDistanceFt configuration, make sure it matches your derby track configuration*
* *ext.aws.iot.thing.name* - Must match your AWS IoT Thing Configuration
* *ext.aws.iot.thing.arn* - Must match your AWS IoT Thing Configuration.  Only need to change the random number, your thing name will be placed into the ARN dynamically.
* *ext.aws.iot.config.host* - Must match your AWS IoT Thing Configuration
* *ext.aws.iot.config.clientId* - Must match your AWS IoT Thing Configuration
* *ext.iot-devices.* - This configures the **thunderboard-ble** library.  See: https://www.npmjs.com/package/thunderboard-ble more details.

###### Optional
* *ext.camera.* - Allows you to customize the camera parameters for image capture.
* *ext.gifencoder.* - Allows you to customize the encoder parameters and frame rates for image capture.
* *ext.derby-timer.sendRaceStartSignal* - If you have the Electronic Derby Timer with Solenoid Start, then set to True.
* *ext.derby-timer.autoResetTimeoutMs* - Amount of time to wait after timer results received before auto-resetting timer and RaceManager.

##### Connect Devices to Raspberry Pi GPIO Pins
![Raspberry Pi GPIO Layout](./raspi-gpio-layout.png "Raspberry Pi GPIO Layout")

>Note:  IR break sensors can be connected to other GPIO ports; however, the built in pull-up resistors on the specific pins above allow for direct connection.

##### Setup Persistent Device Name for Derby Timer
For consistency, it helps to be able to always know the name of a given device when it is connected.  The following steps were used to map the Electronic Derby Timer to **/dev/derby-timer**, which is referenced in the [raspi/jiveclientconfiguration.json](.jiveclientconfiguration.json).

**/etc/udev/rules.d/99-usb-serial.rules**
````bash
SUBSYSTEM=="tty", ATTRS{idVendor}=="04d8", >ATTRS{idProduct}=="00df", ATTRS{serial}=="0001668818", >SYMLINK+="derby-timer"

SUBSYSTEM=="tty", ATTRS{idVendor}=="04d8", >ATTRS{idProduct}=="00df", ATTRS{serial}=="0001671666", >SYMLINK+="derby-timer"
````
> Note: The first line is the regular timer without the solenoid starter, the second is the derby with the solenoid starter.  Given you will only have one plugged in at any point, mapping them both to the same device name is fine.

See the following article for ways to accommodate other devices: <br/>
http://hintshop.ludvig.co.nz/show/persistent-names-usb-serial-devices/

##### Configure Network Connectivity
If DHCP via eth0 then you are good, but if you want to use wireless, you can use the following steps.

See the following Raspberry Pi documentation: <br/>
https://www.raspberrypi.org/documentation/configuration/wireless/wireless-cli.md

##### Configure Auto Start Service
These steps will insure that your local node service will auto-start.

**Create Auto-Start Script**
````bash
echo -e "#"'!'"/bin/bash\ncd ~/jive-derby/raspi\nsudo npm start" > ~/jive-derby/raspi/autostart.sh
chmod 755 ~/jive-derby/raspi/autostart.sh

#### THEN RUN THIS COMMAND ####
sudo crontab -e

# AND INPUT THIS COMMAND AT THE END
@reboot bash /home/pi/jive-derby/raspi/autostart.sh > /home/pi/jive-derby/raspi/cronlog 2>&1

# SAVE CHANGES USING :wq
````

##### Setup Your IoT Shadow Devices and Certificates

**General Notes**
* Create New Thing
* Create Certificate (and activate it)
* Attach Policy to CERTIFICATE
* Attach Thing to CERTIFICATE
* Download Certificates and Update on Raspberry Pi
  * ~/raspi/lib/certs/jderby-environment.cert.pem
  * ~/raspi/lib/certs/jderby-environment.private.key
  * ~/raspi/lib/certs/jderby-environment.public.key

See http://docs.aws.amazon.com/iot/latest/developerguide/what-is-aws-iot.html for more details.
