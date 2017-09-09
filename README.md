# slug-storage

[![Build Status](https://travis-ci.org/antonfisher/slug-storage.svg?branch=master)](https://travis-ci.org/antonfisher/slug-storage)
[![Coverage Status](https://coveralls.io/repos/github/antonfisher/slug-storage/badge.svg?branch=master)](https://coveralls.io/github/antonfisher/slug-storage?branch=master)
[![bitHound Dependencies](https://www.bithound.io/github/antonfisher/slug-storage/badges/dependencies.svg)](https://www.bithound.io/github/antonfisher/slug-storage/master/dependencies/npm)

## Idea:

The idea is to build drive distributed storage system with FTP interface on Node.js.

## Features:
- distributes files on a bunch of USB-drives
- keeps up file duplication for redundancy
- provides FTP interface.

## Configuration example:
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
      +-----+ daemon +------+
      |     +--------+      |
      |                     |
+-----v------+        +-----v------+
| replicator |        | FTP server |
+---------+--+        +-----+------+
          |                 |
          |       +---------v----------+
          |       | mergeFs API module |
          |       +---+----------------+
          |           |
       +--v-----------v--+
       | devices manager |
       +-----------------+
```

## Current stage:
- [x] research
- [x] proof-of-concept building
- [ ] **main codebase and tests**
- [ ] hardware assembling
