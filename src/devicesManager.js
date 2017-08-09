const fs = require('fs');
const {join} = require('path');
const EventEmitter = require('events');
const async = require('async');

const mathUtils = require('./mathUtils');

const DEFAULT_STORAGE_DIR_NAME = '.slug-storage';
const DEFAULT_LOOK_FOR_INTERVAL = 5 * 1000;

function _asyncFilterDirs(paths, done) {
  return fs.stat(
    paths,
    (err, stat) => done(null, !err && stat.isDirectory())
  );
}

function _asyncFilterNonExisting(paths, done) {
  return fs.stat(
    paths,
    err => done(null, err && err.code === 'ENOENT')
  );
}

class DevicesManager extends EventEmitter {
  constructor(devicesPath, lookupUnterval = DEFAULT_LOOK_FOR_INTERVAL, storageDirName = DEFAULT_STORAGE_DIR_NAME) {
    super();

    if (!devicesPath) {
      throw new Error('No "devicesPath" parameter specified');
    }

    //TODO logger
    //console.log(`MergedFs devices path: ${devsPath}`);

    this.devicesPath = devicesPath;
    this.storageDirName = storageDirName;

    this.devices = [];
    this.isInitLookup = true;

    this._lookupDevices();
    this._lookupDevicesInterval = setInterval(() => this._lookupDevices(), lookupUnterval);
  }

  _lookupDevices() {
    //console.log('Look up devices start...');
    async.waterfall([
      done => fs.readdir(this.devicesPath, (err, files) => {
        if (err) {
          return done(new Error(`Cannot read devices directory "${this.devicesPath}": ${err}`));
        }
        return done(null, files.map(fileName => join(this.devicesPath, fileName)));
      }),
      (filePaths, done) => async.filter(filePaths, _asyncFilterDirs, (err, dirs) => {
        if (!dirs.length) {
          return done(new Error(`Fail to find any devices in "${this.devicesPath}"`));
        }
        return done(null, dirs.map(dir => join(dir, this.storageDirName)));
      }),
      (storageDirs, done) => async.filter(
        storageDirs,
        _asyncFilterNonExisting,
        (err, nonExistingStorageDirs) => {
          const existingStorageDirs = storageDirs.filter(dir => !nonExistingStorageDirs.includes(dir));
          return done(null, existingStorageDirs, nonExistingStorageDirs);
        }
      ),
      (existingStorageDirs, nonExistingStorageDirs, done) => {
        const addedStorageDirs = [];
        if (nonExistingStorageDirs.length > 0) {
          async.each(
            nonExistingStorageDirs,
            (dir, mkdirDone) => fs.mkdir(dir, (mkdirErr) => {
              if (mkdirErr) {
                this.emit(
                  DevicesManager.EVENTS.WARN,
                  `Fail to create storage directory on "${dir}" device, skip it in list: ${mkdirErr}`
                );
              } else {
                addedStorageDirs.push(dir);
              }
              return mkdirDone(null);
            }),
            err => done(err, existingStorageDirs.concat(addedStorageDirs), addedStorageDirs)
          );
        } else {
          return done(null, existingStorageDirs, addedStorageDirs);
        }
      }
    ], (err, devices, addedStorageDirs) => {
      //console.log('Looked up devices:', err, devices, addedStorageDirs);

      if (err) {
        this.devices = [];
        return this.emit(DevicesManager.EVENTS.ERROR, new Error(`Fail to process storage directories: ${err}`));
      }

      const removedStorageDirs = this.devices.filter(dev => !devices.includes(dev));

      this.devices = devices;

      if (this.devices.length > 0 && this.isInitLookup) {
        this.isInitLookup = false;
        this.emit(DevicesManager.EVENTS.READY, this.devices);
      }

      removedStorageDirs.forEach(dir => this.emit(DevicesManager.EVENTS.DEVICE_REMOVED, dir));
      addedStorageDirs.forEach(dir => this.emit(DevicesManager.EVENTS.DEVICE_ADDED, dir));
    });
  }

  getDevicesPath() {
    return this.devicesPath;
  }

  getDevices() {
    return this.devices;
  }

  getDeviceForWrite(callback) {
    // use capacity analisys
    process.nextTick(() => {
      if (this.devices.length > 0) {
        return callback(null, this.devices[mathUtils.getRandomIntInclusive(0, this.devices.length - 1)]);
      }
      return callback(null, null); // throw an error?
    });
  }

  destroy() {
    clearInterval(this._lookupDevicesInterval);
  }
}

DevicesManager.EVENTS = {
  WARN: 'warn',
  ERROR: 'error',
  READY: 'ready',
  DEVICE_ADDED: 'device_added',
  DEVICE_REMOVED: 'device_removed'
};

module.exports = DevicesManager;
