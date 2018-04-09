const defaultNodeFs = require('fs');
const defaultChildProcess = require('child_process');
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
    childProcess = defaultChildProcess,
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
    this.childProcess = childProcess;
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
      (err) => done(null, err && err.code === CODES.ENOENT)
    );
  }

  _getCapacity(callback) {
    this.childProcess.exec('df --output=source,pcent', (err, res) => {
      if (err) {
        this.emit(DevicesManager.EVENTS.WARN, `Fail to get device capacities: ${err}`);
        return callback(err);
      }

      const stats = res.split('\n').slice(1).reduce((acc, item) => {
        const [source, percent] = item.replace(/\s+/g, ' ').split(' ');
        if (percent && source && source.startsWith('/dev/')) {
          acc[source] = Number(percent.replace('%', '')) / 100;
        }
        return acc;
      }, {});

      callback(err, stats);
    });
  }

  _lookupDevices() {
    //console.log('Look up devices start...');
    async.waterfall([
      (done) => this.fs.readdir(this.devicesPath, (err, files) => {
        if (err) {
          return done(new Error(`Cannot read devices directory "${this.devicesPath}": ${err}`));
        }
        return done(null, files.map((fileName) => join(this.devicesPath, fileName)));
      }),
      //(done) => this.childProcess.exec('ls -la /dev/disk/by-path | grep usb | grep part', (err, res) => {
      //  if (err) {
      //    return done(new Error(`Fail to get device capacities: ${err}`));
      //  }
      //  const devicePaths = res.split('\n').reduce((acc, item) => {
      //    const devices = item.split('../../');
      //    if (devices[1]) {
      //      acc.push(devices[1]);
      //    }
      //    return acc;
      //  }, []);
      //  console.log('## devicePaths', devicePaths);
      //  done(null, devicePaths);
      //}),
      (filePaths, done) => async.filter(filePaths, this._asyncFilterDirs, (err, dirs) => {
        if (!dirs.length) {
          return done(new Error(`Fail to find any devices in "${this.devicesPath}"`));
        }
        return done(null, dirs.map((dir) => join(dir, this.storageDirName)));
      }),
      (storageDirs, done) => async.filter(
        storageDirs,
        this._asyncFilterNonExisting,
        (err, nonExistingStorageDirs) => {
          const existingStorageDirs = storageDirs.filter((dir) => !nonExistingStorageDirs.includes(dir));
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
            (err) => done(err, existingStorageDirs.concat(addedStorageDirs), addedStorageDirs)
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

      const removedStorageDirs = this.devices.filter((dev) => !devices.includes(dev));

      this.devices = devices.sort();

      if (this.devices.length > 0 && this.isInitLookup) {
        this.isInitLookup = false;
        this.emit(DevicesManager.EVENTS.READY, this.devices);
      }

      removedStorageDirs.forEach((dir) => this.emit(DevicesManager.EVENTS.DEVICE_REMOVED, dir));
      addedStorageDirs.forEach((dir) => this.emit(DevicesManager.EVENTS.DEVICE_ADDED, dir));
    });
  }

  getDevicesPath() {
    return this.devicesPath;
  }

  getDevices(ordered = false) {
    if (ordered) {
      return this.devices;
    }

    return [...this.devices].sort(() => (0.5 - Math.random()));
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
  DEVICE_ADDED: 'deviceAdded',
  DEVICE_REMOVED: 'deviceRemoved'
};

module.exports = DevicesManager;
