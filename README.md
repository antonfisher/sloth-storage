# sloth-storage

[![Build Status](https://travis-ci.org/antonfisher/sloth-storage.svg?branch=master)](https://travis-ci.org/antonfisher/sloth-storage)
[![Coverage Status](https://coveralls.io/repos/github/antonfisher/sloth-storage/badge.svg?branch=master)](https://coveralls.io/github/antonfisher/sloth-storage?branch=master)
[![GitHub license](https://img.shields.io/github/license/antonfisher/sloth-storage.svg)](https://github.com/antonfisher/sloth-storage/blob/master/LICENSE)

## Idea
The idea is to build drive distributed storage device with FTP interface on Node.js.

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


## Modules Hierarchy
```
+--------+
| daemon <------+
+--------+      |
                |
          +-----+------+
          | FTP server <----+
          +------------+    |
                            |
+------------+    +---------+----------+
| replicator <----> mergeFs API module |
+---------^--+    +---^----------------+
          |           |
       +--+-----------+--+
       | devices manager |
       +-----------------+
```

## Hardware

### Install deps:

```bash
# install nodejs
sudo curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt-get install -y gcc g++ make git;
sudo apt-get install -y nodejs

# install application
git clone https://github.com/antonfisher/sloth-storage.git
cd sloth-storage
npm install
cd src/hardware
npm install
cd -

# display + gpio configuration
curl -sS https://get.pimoroni.com/microdotphat | bash # https://pinout.xyz/pinout/micro_dot_phat
sudo cat >/etc/udev/rules.d/20-gpiomem.rules <<EOF
SUBSYSTEM=="bcm2835-gpiomem", KERNEL=="gpiomem", GROUP="gpio", MODE="0660"
EOF
sudo usermod -a -G gpio pi
sudo usermod -a -G gpio root
sudo echo "America/Los_Angeles" > /etc/timezone
sudo dpkg-reconfigure tzdata
```

## Usage

```bash
# run only application
npm start

# set different device path (not /media/<USER>)
npm start -- --devices-path <path>

# show full help
npm start -- --help

# run on RPI
npm start -- --rpi
```

## Current stage
- [x] research
- [x] proof-of-concept building
- [x] main codebase and tests
- [x] hardware assembling
- [ ] **run/debug**

## License
MIT License. Free use and change.
