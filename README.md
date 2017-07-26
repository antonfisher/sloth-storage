# slug-storage

[![Build Status](https://travis-ci.org/antonfisher/slug-storage.svg?branch=master)](https://travis-ci.org/antonfisher/slug-storage)

Stages:
- [x] research
- [ ] proof-of-concept building
- [ ] hardware assembling

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


## Modules HierarchyNode.js 
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
