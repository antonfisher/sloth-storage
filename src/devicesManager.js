const fs = require('fs');
const {join} = require('path');

class DevicesManager {
  constructor(devicesPath) {
    if (!devicesPath) {
      throw new Error('No "devicesPath" parameter specified');
    }

    //TODO logger
    //console.log(`MergedFs devices path: ${devsPath}`);

    this.devicesPath = devicesPath;
    this.devices = [];

    this._findDevices();
  }

  _findDevices() {
    this.devices = fs.readdirSync(this.devicesPath).map(devPath => join(this.devicesPath, devPath));
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

  getDeviceForWrite() {
    // use capacity analisys
    return this.devices[this._getRandomIntInclusive(0, this.devices.length - 1)];
  }
}

module.exports = DevicesManager;
