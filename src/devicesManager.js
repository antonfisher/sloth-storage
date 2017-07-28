const fs = require('fs');
const {join} = require('path');
const EventEmitter = require('events');

const DEFAULT_FIND_INTERVAL = 5 * 1000;

class DevicesManager extends EventEmitter {
  constructor(devicesPath, lookupUnterval = DEFAULT_FIND_INTERVAL) {
    super();

    if (!devicesPath) {
      throw new Error('No "devicesPath" parameter specified');
    }

    //TODO logger
    //console.log(`MergedFs devices path: ${devsPath}`);

    this.devicesPath = devicesPath;
    this.devices = [];

    this._lookupDevices();
    this._lookupDevicesInterval = setInterval(() => this._lookupDevices(), lookupUnterval);
  }

  _lookupDevices() {
    // TODO logger
    //console.log('lookup new devices... ', this.devices.length);
    this.devices = fs.readdirSync(this.devicesPath).map(devPath => join(this.devicesPath, devPath));
    this.emit('ready');
  }

  // the maximum is inclusive and the minimum is inclusive
  _getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getDevicesPath() {
    return this.devicesPath;
  }

  getDevices() {
    return this.devices;
  }

  getDeviceForWrite(callback) {
    // use capacity analisys
    process.nextTick(() => callback(null, this.devices[this._getRandomIntInclusive(0, this.devices.length - 1)]));
  }

  destroy() {
    clearInterval(this._lookupDevicesInterval);
  }
}

module.exports = DevicesManager;
