const {join} = require('path');
const expect = require('expect.js');
const simple = require('simple-mock');

const {exec} = require('./utils');
const DevicesManager = require('../src/devicesManager');

const testFsDir = 'testfs';
const testFsPath = join(process.cwd(), testFsDir);
const storageDirName = '.slug-storage';

describe('devicesManager', () => {
  describe('Constructor', () => {
    it('should throw an error if "devicePath" is undefined', (done) => {
      try {
        const devicesManager = new DevicesManager();
        done(`No error was thrown: "${devicesManager.getDevicesPath()}"`);
      } catch (e) {
        expect(e).to.be.an(Error);
        expect(e.message).to.contain('devicesPath');
        done();
      }
    });
  });

  describe('Initialization', () => {
    let devicesManager;

    beforeEach(() => {
      exec(`mkdir -p ./${testFsDir}/dev{1,2}`);
      exec(`mkdir -p ./${testFsDir}/dev1/${storageDirName}`);
      exec(`mkdir -p ./${testFsDir}/dev2/${storageDirName}`);
    });

    afterEach(() => {
      devicesManager.destroy();
      devicesManager = null;
      exec(`rm -rf ./${testFsDir}`);
    });

    it('should emit "deviceAdded" event', (done) => {
      const lookupInterval = 100;
      devicesManager = new DevicesManager({devicesPath: testFsPath, lookupInterval, storageDirName});
      devicesManager.on(DevicesManager.EVENTS.READY, () => {
        expect(devicesManager.getDevices()).to.be.an('array');
        expect(devicesManager.getDevices()).to.have.length(2);

        devicesManager.on(DevicesManager.EVENTS.DEVICE_ADDED, (path) => {
          expect(path).to.be(join(testFsPath, 'dev3', storageDirName));
          expect(devicesManager.getDevices()).to.be.an('array');
          expect(devicesManager.getDevices()).to.have.length(3);
          done();
        });

        exec(`mkdir -p ./${testFsDir}/dev3`);
      });
    });

    it('should emit "deviceRemoved" event', (done) => {
      const lookupInterval = 100;
      devicesManager = new DevicesManager({devicesPath: testFsPath, lookupInterval, storageDirName});
      devicesManager.on(DevicesManager.EVENTS.READY, () => {
        expect(devicesManager.getDevices()).to.be.an('array');
        expect(devicesManager.getDevices()).to.have.length(2);

        devicesManager.on(DevicesManager.EVENTS.DEVICE_REMOVED, (path) => {
          expect(path).to.be(join(testFsPath, 'dev1', storageDirName));
          expect(devicesManager.getDevices()).to.be.an('array');
          expect(devicesManager.getDevices()).to.have.length(1);
          done();
        });

        exec(`rm -r ./${testFsDir}/dev1`);
      });
    });

    it('should find new device', (done) => {
      const lookupInterval = 100;
      devicesManager = new DevicesManager({devicesPath: testFsPath, lookupInterval, storageDirName});
      devicesManager.on(DevicesManager.EVENTS.READY, () => {
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
        }, lookupInterval * 1.1);
      });
    });

    it('should emit "warning" event if failed to create storage directory on a devices', (done) => {
      const mockFs = require('fs'); //eslint-disable-line global-require
      const lookupInterval = 1000;
      simple.mock(mockFs, 'mkdir').callbackWith('lol-warn');
      exec(`rm -rf ./${testFsDir}/dev1/${storageDirName}`);
      const stoplookupInterval = setTimeout(() => {
        simple.restore();
        done('"warning" event hasn\'t been thrown');
      }, lookupInterval * 0.9);
      devicesManager = new DevicesManager({
        devicesPath: testFsPath,
        lookupInterval,
        storageDirName,
        fs: mockFs
      });
      devicesManager.on(DevicesManager.EVENTS.WARN, (err) => {
        clearTimeout(stoplookupInterval);
        expect(err).to.contain('Fail to create storage directory');
        expect(err).to.contain(`${testFsDir}/dev1`);
        expect(err).to.contain('lol-warn');
        simple.restore();
        done();
      });
    });

    it('should emit "error" event if there are no directories in devices path', (done) => {
      exec(`mkdir -p ./${testFsDir}/empty`);
      const lookupInterval = 1000;
      const emptyPath = join(testFsPath, 'empty');
      const stoplookupInterval = setTimeout(() => {
        done('"error" event hasn\'t been thrown');
      }, lookupInterval * 0.9);
      devicesManager = new DevicesManager({devicesPath: emptyPath, lookupInterval, storageDirName});
      devicesManager.on(DevicesManager.EVENTS.ERROR, (e) => {
        clearTimeout(stoplookupInterval);
        expect(e).to.be.an(Error);
        expect(e.message).to.contain('Fail to find any devices');
        expect(e.message).to.contain(emptyPath);
        done();
      });
    });

    it('should emit "error" event for non-existing devices path', (done) => {
      const lookupInterval = 100;
      const nonExistingPath = '/not-exist';
      const stoplookupInterval = setTimeout(() => {
        done('"error" event hasn\'t been thrown');
      }, lookupInterval * 0.9);
      devicesManager = new DevicesManager({devicesPath: nonExistingPath, lookupInterval, storageDirName});
      devicesManager.on(DevicesManager.EVENTS.ERROR, (e) => {
        clearTimeout(stoplookupInterval);
        expect(e).to.be.an(Error);
        expect(e.message).to.contain('Cannot read devices directory');
        expect(e.message).to.contain('ENOENT');
        expect(e.message).to.contain(nonExistingPath);
        done();
      });
    });
  });

  describe('Runtime methods', () => {
    let devicesManager;
    const lookupInterval = 100;

    beforeEach((done) => {
      exec(`mkdir -p ./${testFsDir}/dev{1,2}`);

      devicesManager = new DevicesManager({devicesPath: testFsPath, lookupInterval, storageDirName});
      //devicesManager.on(DevicesManager.EVENTS.WARN, message => console.log(`WARN: ${message}`));
      //devicesManager.on(DevicesManager.EVENTS.ERROR, message => console.log(`ERROR: ${message}`));
      devicesManager.on(DevicesManager.EVENTS.READY, () => done());
    });

    afterEach(() => {
      devicesManager.destroy();
      devicesManager = null;
      exec(`rm -rf ./${testFsDir}`);
    });

    describe('#getDevicesPath()', () => {
      it('should return devices path', () => {
        const devicesPath = devicesManager.getDevicesPath();
        expect(devicesPath).to.be.a('string');
        expect(devicesPath).to.be(testFsPath);
      });
    });

    describe('#getDevices()', () => {
      it('should return devices list', () => {
        const devices = devicesManager.getDevices();
        expect(devices).to.be.an('array');
        expect(devices).to.have.length(2);
        expect(devices).to.contain(join(testFsPath, 'dev1', storageDirName));
        expect(devices).to.contain(join(testFsPath, 'dev2', storageDirName));
      });

      it('should return ordered devices list', () => {
        const devices = devicesManager.getDevices(true);
        expect(devices).to.be.an('array');
        expect(devices).to.have.length(2);
        expect(devices[0]).to.be(join(testFsPath, 'dev1', storageDirName));
        expect(devices[1]).to.be(join(testFsPath, 'dev2', storageDirName));
      });
    });

    describe('#getDeviceForWrite()', () => {
      it('should return device from list', (done) => {
        const devices = devicesManager.getDevices();

        devicesManager.getDeviceForWrite((err, device) => {
          expect(devices).to.be.an('array');
          expect(devices).to.contain(device);
          done(err);
        });
      });

      it('should return an error if no devices exist', (done) => {
        devicesManager.on(DevicesManager.EVENTS.ERROR, () => {
          //skip;
        });
        exec(`rm -rf ./${testFsDir}/*`);

        setTimeout(() => {
          devicesManager.getDeviceForWrite((err) => {
            expect(err).to.be.a(Error);
            expect(err.message).to.contain('No devices for write');
            done();
          });
        }, lookupInterval * 1.1);
      });
    });

    describe('#getDeviceForWriteSync()', () => {
      it('should return device from list', (done) => {
        const devices = devicesManager.getDevices();
        try {
          expect(devices).to.be.an('array');
          expect(devices).to.contain(devicesManager.getDeviceForWriteSync());
          done();
        } catch (e) {
          done(e);
        }
      });

      it('should throw an error return null if no devices exist', (done) => {
        devicesManager.on(DevicesManager.EVENTS.ERROR, () => {
          //skip;
        });
        exec(`rm -rf ./${testFsDir}/*`);

        setTimeout(() => {
          expect(devicesManager.getDeviceForWriteSync.bind(devicesManager))
            .to
            .throwException((err) => {
              expect(err).to.be.a(Error);
              expect(err.message).to.contain('No devices for write');
              done();
            });
        }, lookupInterval * 1.1);
      });
    });

    xdescribe('#_getCapacity()', () => {
      it('Should return capacities', (done) => {
        devicesManager._getCapacity(done);
      });
    });
  });
});
