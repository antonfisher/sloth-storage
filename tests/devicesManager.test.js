const {join} = require('path');
const expect = require('expect.js');

const {exec} = require('./utils');
const EVENTS = require('../src/appEvents');
const {DevicesManager} = require('../src/devicesManager');

const testFsDir = 'testfs';
const testFsPath = join(process.cwd(), testFsDir);

describe('devicesManager', () => {
  describe('Initialization', () => {
    let devicesManager;

    beforeEach(() => {
      exec(`mkdir -p ./${testFsDir}/dev{1,2}`);
    });

    afterEach(() => {
      devicesManager.destroy();
      devicesManager = null;
      exec(`rm -rf ./${testFsDir}`);
    });

    it('Should find new device', (done) => {
      const timeout = 10;
      const storageDirName = '.slug-storage';
      devicesManager = new DevicesManager(testFsPath, timeout, storageDirName);
      devicesManager.on('ready', () => {
        expect(devicesManager.getDevices()).to.be.an('array');
        expect(devicesManager.getDevices()).to.have.length(2);
        expect(devicesManager.getDevices()).to.contain(join(testFsPath, 'dev1', storageDirName));
        expect(devicesManager.getDevices()).to.contain(join(testFsPath, 'dev2', storageDirName));

        exec(`mkdir -p ./${testFsDir}/dev3`);

        setTimeout(() => {
          expect(devicesManager.getDevices()).to.be.an('array');
          expect(devicesManager.getDevices()).to.have.length(3);
          expect(devicesManager.getDevices()).to.contain(join(testFsPath, 'dev3', storageDirName));
          done();
        }, timeout * 1.1);
      });
    });

    xit('Should create storage directory on new divice');
    xit('Should mark new device as "read-only" during synchronization');
  });

  describe('Runtime methods', () => {
    let devicesManager;
    const storageDirName = '.slug-storage';

    beforeEach((done) => {
      exec(`mkdir -p ./${testFsDir}/dev{1,2}`);

      devicesManager = new DevicesManager(testFsPath, 1000, storageDirName);
      devicesManager.on(EVENTS.WARN, message => console.log(`WARN: ${message}`));
      devicesManager.on(EVENTS.ERROR, message => console.log(`ERROR: ${message}`));
      devicesManager.on(EVENTS.READY, () => done());
    });

    afterEach(() => {
      devicesManager.destroy();
      devicesManager = null;
      exec(`rm -rf ./${testFsDir}`);
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
        expect(devices).to.contain(join(testFsPath, 'dev1', storageDirName));
        expect(devices).to.contain(join(testFsPath, 'dev2', storageDirName));
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

      xit('Should not return "read-only" devices');
    });
  });
});
