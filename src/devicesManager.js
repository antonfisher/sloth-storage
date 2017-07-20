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
    //console.log(`MergedFs devices found: ${this.devices}`);
  }

  getDevicesPath() {
    return this.devicesPath;
  }

  getDevices() {
    return this.devices;
  }
}

module.exports = DevicesManager;
