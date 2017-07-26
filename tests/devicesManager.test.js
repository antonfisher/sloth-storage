const fs = require('fs');
const {join} = require('path');
//const async = require('async');
const expect = require('expect.js');
const {exec} = require('./utils');
const DevicesManager = require('../src/devicesManager');

const testFsDir = 'testfs';
const testFsPath = join(process.cwd(), testFsDir);

let devicesManager;

describe('devicesManager', () => {
  beforeEach(() => {
    exec(`mkdir -p ./${testFsDir}/dev{1,2}`);
    devicesManager = new DevicesManager(testFsPath);
  });

  afterEach(() => {
    exec(`rm -rf ./${testFsDir}`);
    devicesManager.destroy();
    devicesManager = null;
  });

  it('Should find new device', (done) => {
    const timeout = 10;
    devicesManager = new DevicesManager(testFsPath, timeout);
    expect(devicesManager.getDevices()).to.be.an('array');
    expect(devicesManager.getDevices()).to.have.length(2);
    exec(`mkdir -p ./${testFsDir}/dev3`);
    setTimeout(() => {
    expect(devicesManager.getDevices()).to.be.an('array');
    expect(devicesManager.getDevices()).to.have.length(3);
      expect(devicesManager.getDevices()).to.contain(join(testFsPath, 'dev3'));
      done();
    }, timeout * 1.1);
  });

  describe('#getDevicesPath()', () => {
    it('Should return devices path', () => {
      const devicesPath = devicesManager.getDevicesPath();
      expect(devicesPath).to.be.a('string');
      expect(devicesPath).to.be(testFsPath);
    });
  });

  describe('#getDevices()', () => {
    it('Should return devices list', () => {
      const devices = devicesManager.getDevices();
      expect(devices).to.be.an('array');
      expect(devices).to.have.length(2);
      expect(devices).to.contain(join(testFsPath, 'dev1'));
      expect(devices).to.contain(join(testFsPath, 'dev2'));
    });
  });

  describe('#getDeviceForWrite()', () => {
    it('Should return device from list', (done) => {
      const devices = devicesManager.getDevices();

      devicesManager.getDeviceForWrite((err, device) => {
        expect(devices).to.be.an('array');
        expect(devices).to.contain(device);
        done(err);
      });
    });
  });

});
