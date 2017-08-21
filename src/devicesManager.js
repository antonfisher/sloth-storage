const defaultNodeFs = require('fs');
const {join} = require('path');
const EventEmitter = require('events');
const async = require('async');

const mathUtils = require('./mathUtils');
const {CODES} = require('./errorHelpers');

const DEFAULT_STORAGE_DIR_NAME = '.slug-storage';
const DEFAULT_LOOK_FOR_INTERVAL = 5 * 1000;

class DevicesManager extends EventEmitter {
  constructor({
    devicesPath,
    lookupInterval = DEFAULT_LOOK_FOR_INTERVAL,
    storageDirName = DEFAULT_STORAGE_DIR_NAME,
    fs = defaultNodeFs
  } = {}) {
    super();

    if (!devicesPath) {
      throw new Error('No "devicesPath" parameter specified');
    }

    //TODO logger
    //console.log(`MergedFs devices path: ${devsPath}`);

    this.devicesPath = devicesPath;
    this.storageDirName = storageDirName;
    this.fs = fs;

    this.devices = [];
    this.isInitLookup = true;

    this._lookupDevices();
    this._lookupDevicesInterval = setInterval(() => this._lookupDevices(), lookupInterval);
    this._asyncFilterDirs = this._asyncFilterDirs.bind(this);
    this._asyncFilterNonExisting = this._asyncFilterNonExisting.bind(this);
  }

  _asyncFilterDirs(paths, done) {
    return this.fs.stat(
      paths,
      (err, stat) => done(null, !err && stat.isDirectory())
    );
  }

  _asyncFilterNonExisting(paths, done) {
    return this.fs.stat(
      paths,
      err => done(null, err && err.code === CODES.ENOENT)
    );
  }

  _lookupDevices() {
    //console.log('Look up devices start...');
    async.waterfall([
      done => this.fs.readdir(this.devicesPath, (err, files) => {
        if (err) {
          return done(new Error(`Cannot read devices directory "${this.devicesPath}": ${err}`));
        }
        return done(null, files.map(fileName => join(this.devicesPath, fileName)));
      }),
      (filePaths, done) => async.filter(filePaths, this._asyncFilterDirs, (err, dirs) => {
        if (!dirs.length) {
          return done(new Error(`Fail to find any devices in "${this.devicesPath}"`));
        }
        return done(null, dirs.map(dir => join(dir, this.storageDirName)));
      }),
      (storageDirs, done) => async.filter(
        storageDirs,
        this._asyncFilterNonExisting,
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
            (dir, mkdirDone) => this.fs.mkdir(dir, (mkdirErr) => {
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

  getDevices(random = false) {
    if (random) {
      return this.devices.sort(() => (0.5 - Math.random()));
    }

    return this.devices;
  }

  //TODO use capacity analisys
  getDeviceForWriteSync() {
    if (this.devices.length > 0) {
      return this.devices[mathUtils.getRandomIntInclusive(0, this.devices.length - 1)];
    }

    throw new Error('No devices for write');
  }

  getDeviceForWrite(callback) {
    process.nextTick(() => {
      try {
        return callback(null, this.getDeviceForWriteSync());
      } catch (e) {
        return callback(e);
      }
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
