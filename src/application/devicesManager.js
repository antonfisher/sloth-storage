const defaultNodeFs = require('fs');
const defaultChildProcess = require('child_process');
const {join} = require('path');
const EventEmitter = require('events');
const async = require('async');

const mathUtils = require('./mathUtils');
const {CODES} = require('./errorHelpers');

const DEFAULT_STORAGE_DIR_NAME = '.sloth-storage';
const DEFAULT_INTERVAL_LOOKUP_DEVICES = 5 * 1000;
const DEFAULT_INTERVAL_CALCULATE_CAPACITY = 5 * 1000;

class NoDevicesFoundWarning extends Error {
  constructor(devicesPath) {
    super(`storage is not ready to operate, fail to find any devices in "${devicesPath}"`);
  }
}

/**
 * @param {String}        devicesPath               path of folders to use as devices, null to discover usb drives
 * @param {Number}        lookupDevicesInterval     interval to check if a new device appeared
 * @param {Number}        calculateCapacityInterval interval to calculate devices capacity
 * @param {String}        storageDirName            direcotry name to create on device to store application data
 * @param {child_process} childProcess              link to nodejs child_process module
 * @param {fs}            fs                        link to nodejs fs module
 */
class DevicesManager extends EventEmitter {
  constructor({
    devicesPath,
    lookupDevicesInterval = DEFAULT_INTERVAL_LOOKUP_DEVICES,
    calculateCapacityInterval = DEFAULT_INTERVAL_CALCULATE_CAPACITY,
    storageDirName = DEFAULT_STORAGE_DIR_NAME,
    childProcess = defaultChildProcess,
    fs = defaultNodeFs
  } = {}) {
    super();

    if (!devicesPath) {
      throw new Error('No "devicesPath" parameter specified');
    }

    this.devicesPath = devicesPath;
    this.storageDirName = storageDirName;
    this.childProcess = childProcess;
    this.fs = fs;

    this.devices = [];
    this.isInitLookup = true;
    this._capacityStats = {};
    this._totalCapacity = null;
    this._usedCapacityPercent = null;

    this._lookupDevices();
    this._lookupDevicesInterval = setInterval(() => this._lookupDevices(), lookupDevicesInterval);

    this._calculateCapacity();
    this._calculateCapacityIntervalInterval = setInterval(() => this._calculateCapacity(), calculateCapacityInterval);

    this._asyncFilterDirs = this._asyncFilterDirs.bind(this);
    this._asyncFilterNonExisting = this._asyncFilterNonExisting.bind(this);
  }

  _asyncFilterDirs(paths, done) {
    return this.fs.stat(paths, (err, stat) => done(null, !err && stat.isDirectory()));
  }

  _asyncFilterNonExisting(paths, done) {
    return this.fs.stat(paths, (err) => done(null, err && err.code === CODES.ENOENT));
  }

  //TODO tests
  _calculateCapacity() {
    //ls -la /dev/disk/by-uuid/
    this.emit(
      DevicesManager.EVENTS.VERBOSE,
      //TODO format percent/capacity function
      `Get devices utilization (current usage: ${(this._usedCapacityPercent * 100).toFixed(5)}%)...`
    );
    this.childProcess.exec('df -kl --output=target,size,pcent', (err, res) => {
      if (err) {
        this.emit(DevicesManager.EVENTS.WARN, `Fail to get device capacities: ${err}`);
        return;
      }

      let totalCapacity = 0;
      let usedCapacity = 0;
      const stats = res
        .split('\n')
        .slice(1)
        .reduce((acc, item) => {
          const [target, textSize, textPercent] = item.replace(/\s+/g, ' ').split(' ');
          if (textPercent && textSize && target && target.startsWith(this.devicesPath)) {
            const size = Number(textSize);
            const usedPercent = Number(textPercent.replace('%', '')) / 100;
            acc[target] = {usedPercent, size};
            totalCapacity += size;
            usedCapacity += size * usedPercent;
          }
          return acc;
        }, {});

      this._capacityStats = stats;
      this._totalCapacity = totalCapacity;

      if (totalCapacity > 0) {
        const usedCapacityPercent = usedCapacity / totalCapacity;
        if (usedCapacityPercent !== this._usedCapacityPercent) {
          this._usedCapacityPercent = usedCapacityPercent;
          this.emit(DevicesManager.EVENTS.USED_CAPACITY_PERCENT_CHANGED, this._usedCapacityPercent);
        }
      }
    });
  }

  getCapasityStats() {
    return this._capacityStats;
  }

  getTotalCapacity() {
    return this._totalCapacity;
  }

  getUsedCapacityPercent() {
    return this._usedCapacityPercent;
  }

  _lookupDevices() {
    this.emit(DevicesManager.EVENTS.VERBOSE, `Look up for devices (current number: ${this.devices.length})...`);
    async.waterfall(
      [
        (done) =>
          this.fs.readdir(this.devicesPath, (err, files) => {
            if (err) {
              return done(new Error(`Cannot read devices directory "${this.devicesPath}": ${err}`));
            }
            return done(null, files.map((fileName) => join(this.devicesPath, fileName)));
          }),
        (filePaths, done) =>
          async.filter(filePaths, this._asyncFilterDirs, (err, dirs) => {
            if (!dirs.length) {
              return done(new NoDevicesFoundWarning(this.devicesPath));
            }
            return done(null, dirs.map((dir) => join(dir, this.storageDirName)));
          }),
        (storageDirs, done) =>
          async.filter(storageDirs, this._asyncFilterNonExisting, (err, nonExistingDevices) => {
            const existingDevices = storageDirs.filter((dir) => !nonExistingDevices.includes(dir));
            return done(null, existingDevices, nonExistingDevices);
          }),
        (existingDevices, nonExistingDevices, done) => {
          const addedDevices = [];
          if (nonExistingDevices.length > 0) {
            async.each(
              nonExistingDevices,
              (dir, mkdirDone) =>
                this.fs.mkdir(dir, (mkdirErr) => {
                  if (mkdirErr) {
                    this.emit(
                      DevicesManager.EVENTS.WARN,
                      `Fail to create storage directory on "${dir}" device, skip it in list: ${mkdirErr}`
                    );
                  } else {
                    addedDevices.push(dir);
                  }
                  return mkdirDone(null);
                }),
              (err) => done(err, existingDevices, addedDevices)
            );
          } else {
            return done(null, existingDevices, addedDevices);
          }
        }
      ],
      (err, existingDevices, addededDevices) => {
        if (err instanceof NoDevicesFoundWarning) {
          this.emit(DevicesManager.EVENTS.WARN, `Fail to get device capacities: ${err.toString()}`);
          return null;
        } else if (err) {
          this.devices = [];
          return this.emit(DevicesManager.EVENTS.ERROR, new Error(`Fail to process storage directories: ${err}`));
        }

        const devices = existingDevices.concat(addededDevices).sort();
        const removedDevices = this.devices.filter((dev) => !devices.includes(dev));
        const addedDevicesWithExistingStorageDirs = existingDevices.filter((dev) => !this.devices.includes(dev));

        this.devices = devices;

        if (this.devices.length > 0 && this.isInitLookup) {
          this.isInitLookup = false;
          this.emit(
            DevicesManager.EVENTS.INFO,
            `${this.devices.length} device(s) found: ${this._mapDevicesNames(devices).join(', ')}`
          );
          this.emit(DevicesManager.EVENTS.INFO, `Storage is ready to operate on ${this.devices.length} device(s)`);
          this.emit(DevicesManager.EVENTS.READY, this.devices);
        }

        if (removedDevices.length > 0) {
          this.emit(
            DevicesManager.EVENTS.INFO,
            `Some device(s) were removed: ${this._mapDevicesNames(removedDevices).join(', ')}`
          );
          removedDevices.forEach((dir) => this.emit(DevicesManager.EVENTS.DEVICE_REMOVED, dir));
        }
        if (addededDevices.length > 0) {
          this.emit(
            DevicesManager.EVENTS.INFO,
            `Some device(s) were added: ${this._mapDevicesNames(addededDevices).join(', ')}`
          );
          addededDevices.forEach((dir) => this.emit(DevicesManager.EVENTS.DEVICE_ADDED, dir));
        }
        if (addedDevicesWithExistingStorageDirs.length > 0) {
          const deviceNames = this._mapDevicesNames(addedDevicesWithExistingStorageDirs).join(', ');
          this.emit(
            DevicesManager.EVENTS.INFO,
            `Some device(s) were added with already existing storage directory: ${deviceNames}`
          );
          addededDevices.forEach((dir) => this.emit(DevicesManager.EVENTS.DEVICE_ADDED, dir));
        }
      }
    );
  }

  //TODO tests
  _mapDevicesNames(devices) {
    return (devices || []).map((dev) =>
      dev
        .replace('/' + this.storageDirName, '')
        .split('/')
        .pop()
    );
  }

  getDevicesPath() {
    return this.devicesPath;
  }

  getDevices(ordered = false) {
    if (ordered) {
      return this.devices;
    }

    return [...this.devices].sort(() => (0.5 - Math.random() < 0 ? -1 : 1)); // random read access
  }

  //TODO use capacity analysis
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
    clearInterval(this._calculateCapacityIntervalInterval);
  }
}

DevicesManager.EVENTS = {
  VERBOSE: 'VERBOSE',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  READY: 'READY',
  DEVICE_ADDED: 'DEVICE_ADDED',
  DEVICE_REMOVED: 'DEVICE_REMOVED',
  USED_CAPACITY_PERCENT_CHANGED: 'USED_CAPACITY_PERCENT_CHANGED'
};

module.exports = DevicesManager;
