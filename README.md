# sloth-storage

[![Build Status](https://travis-ci.org/antonfisher/sloth-storage.svg?branch=master)](https://travis-ci.org/antonfisher/sloth-storage)
[![Coverage Status](https://coveralls.io/repos/github/antonfisher/sloth-storage/badge.svg?branch=master)](https://coveralls.io/github/antonfisher/sloth-storage?branch=master)
[![GitHub license](https://img.shields.io/github/license/antonfisher/sloth-storage.svg)](https://github.com/antonfisher/sloth-storage/blob/master/LICENSE)

## Idea
The idea is to build drive distributed storage system with FTP interface on Node.js.

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

## Current stage
- [x] research
- [x] proof-of-concept building
- [ ] **main codebase and tests**
- [ ] hardware assembling

## License
MIT License. Free use and change.
