# sloth-storage

[![Build Status](https://travis-ci.org/antonfisher/sloth-storage.svg?branch=master)](https://travis-ci.org/antonfisher/sloth-storage)
[![Coverage Status](https://coveralls.io/repos/github/antonfisher/sloth-storage/badge.svg?branch=master)](https://coveralls.io/github/antonfisher/sloth-storage?branch=master)
[![GitHub license](https://img.shields.io/github/license/antonfisher/sloth-storage.svg)](https://github.com/antonfisher/sloth-storage/blob/master/LICENSE)

[![sloth-storage result](https://raw.githubusercontent.com/antonfisher/antonfisher.github.io/master/images/posts/10-raspberry-pi-storage/sloth-storage-result.jpg)](https://antonfisher.com/posts/2018/12/14/drive-distributed-storage-on-raspberry-pi/)

More photos and article about this project are
[here](https://antonfisher.com/posts/2018/12/14/drive-distributed-storage-on-raspberry-pi/).

## Idea

The idea is to build drive distributed storage device with FTP interface on Node.js.

![sloth-storage idea](https://raw.githubusercontent.com/antonfisher/antonfisher.github.io/master/images/posts/10-raspberry-pi-storage/sloth-storage-logo.png)

## Features

- distributes files on a bunch of USB-drives
- keeps up file duplication for redundancy
- provides FTP interface.

## Configuration example

```
4Gb USB-drive -|     *-----------------------*
4Gb USB-drive -|     |  S  T  O  R  A  G  E  |
4Gb USB-drive -|<--->|    6.6Gb capacity     |<---> FTP client
4Gb USB-drive -|     | 3 copies of each file |
4Gb USB-drive -|     *-----------------------*
```
... or 10Gb storage (2 copies of each file).

## Hardware

Tested with Raspberry Pi 3.

Almost complete list of used components:
- 1 x RPi 3 ([ID:3055](https://www.adafruit.com/product/3055)) = $35.00
- 1 x Pimoroni Micro Dot pHAT with Included LED Modules - Red ([ID:3248](https://www.adafruit.com/product/3248)) = $29.95
- 4 x USB 3.0 4-Port USB Hub (eBay) = $16.40
- 1 x 8GB Class 10 MicroSD Memory Card ([ID:2692](https://www.adafruit.com/product/2692)) = $9.95
- 2 x DC 0-3V Analog Voltmeter (eBay) = $8.56
- 1 x Mini Panel Mount SPDT Toggle Switch ([ID:3221](https://www.adafruit.com/product/3221)) = $0.95
- 1 x Slim Metal Potentiometer Knob - 10mm Diameter x 10mm - T18 ([ID:2058](https://www.adafruit.com/product/2058)) = $1.90
- 1 x Solid Machined Metal Knob - 1" Diameter ([ID:2056](https://www.adafruit.com/product/2056)) = $3.95
- 2 x Mini 8-Way Rotary Selector Switch - SP8T ([ID:2925](https://www.adafruit.com/product/2925)) = $3.90
- 2 x LED diode - red and yellow

Box and indicators [blueprints](./blueprints).

RPi PIN connections:
- [pHAT](https://pinout.xyz/pinout/micro_dot_phat)
- for selectors, gauges, leds and toggle switch look for `const PIN = ...` for each component's class:
   [src/hardware](src/hardware).

I used 3A power supply which enough just for 4 USB-drives.

## Setup

>**Disclaimer:** this is a proof of concept device and cannot be used as reliable place to store your data.

1. Install [Raspbian](https://www.raspberrypi.org/downloads/raspbian/)
   SSH and WiFi configuration [instruction](https://desertbot.io/blog/setup-pi-zero-w-headless-wifi)
2. SSH to RPi
   ([how to find RPi in the network](https://antonfisher.com/posts/2015/12/04/how-to-find-raspberry-pi-ip-address-dhcp/))
3. Install dependencies:
   ```bash
   sudo su

   # install deps
   apt-get install -y gcc g++ make git vim htop;

   # set timezone
   echo "America/Los_Angeles" > /etc/timezone
   dpkg-reconfigure tzdata

   # install nodejs
   curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
   apt install -y nodejs

   # install application
   git clone https://github.com/antonfisher/sloth-storage.git
   cd sloth-storage
   npm install
   cd src/hardware
   npm install
   cd -

   # display
   curl -sS https://get.pimoroni.com/microdotphat | bash # https://pinout.xyz/pinout/micro_dot_phat
```
4. GPIO configuration:
```bash
sudo cat >/etc/udev/rules.d/20-gpiomem.rules <<EOF
SUBSYSTEM=="bcm2835-gpiomem", KERNEL=="gpiomem", GROUP="gpio", MODE="0660"
EOF
sudo usermod -a -G gpio pi
sudo usermod -a -G gpio root
   ```

## Usage

**Note:** RPi doesn't mount USB storage devices automatically.

### Start application:
```bash
# mount usb storage devices
npm run mount # show available devices
npm run mount:do # mount available devices

# start application on RPi
npm run rpi
```

### Connect to FTP server:
```bash
IP:7002
# "Anonymous" user
```

### Useful commands:
```bash
# unmount all mounted usb storage devices
npm run umount:do

# show full help
npm start -- --help

# run only application
npm start

# set different device path (not /media/<USER>)
npm start -- --devices-path <path>
```

## License
MIT License. Free use and change.
