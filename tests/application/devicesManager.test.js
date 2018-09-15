const {join} = require('path');
const expect = require('expect.js');
const simple = require('simple-mock');

const {exec} = require('../utils');
const DevicesManager = require('../../src/application/devicesManager');

const testFsDir = 'testfs';
const testFsPath = join(process.cwd(), testFsDir);
const storageDirName = '.sloth-storage';

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
      const lookupDevicesInterval = 100;
      devicesManager = new DevicesManager({devicesPath: testFsPath, lookupDevicesInterval, storageDirName});
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
      const lookupDevicesInterval = 100;
      devicesManager = new DevicesManager({devicesPath: testFsPath, lookupDevicesInterval, storageDirName});
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
      const lookupDevicesInterval = 100;
      devicesManager = new DevicesManager({devicesPath: testFsPath, lookupDevicesInterval, storageDirName});
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
        }, lookupDevicesInterval * 1.1);
      });
    });

    it('should emit "warning" event if failed to create storage directory on a devices', (done) => {
      const mockFs = require('fs'); //eslint-disable-line global-require
      const lookupDevicesInterval = 1000;
      simple.mock(mockFs, 'mkdir').callbackWith('lol-warn');
      exec(`rm -rf ./${testFsDir}/dev1/${storageDirName}`);
      const stoplookupDevicesInterval = setTimeout(() => {
        simple.restore();
        done('"warning" event hasn\'t been thrown');
      }, lookupDevicesInterval * 0.9);
      devicesManager = new DevicesManager({
        devicesPath: testFsPath,
        lookupDevicesInterval,
        storageDirName,
        fs: mockFs
      });
      devicesManager.on(DevicesManager.EVENTS.WARN, (err) => {
        clearTimeout(stoplookupDevicesInterval);
        expect(err).to.contain('Fail to create storage directory');
        expect(err).to.contain(`${testFsDir}/dev1`);
        expect(err).to.contain('lol-warn');
        simple.restore();
        done();
      });
    });

    it('should emit "warn" event if there are no directories in devices path', (done) => {
      exec(`mkdir -p ./${testFsDir}/empty`);
      const lookupDevicesInterval = 1000;
      const emptyPath = join(testFsPath, 'empty');
      const stoplookupDevicesInterval = setTimeout(() => {
        done('"warn" event hasn\'t been thrown');
      }, lookupDevicesInterval * 0.9);
      devicesManager = new DevicesManager({devicesPath: emptyPath, lookupDevicesInterval, storageDirName});
      devicesManager.on(DevicesManager.EVENTS.WARN, (message) => {
        clearTimeout(stoplookupDevicesInterval);
        expect(message).to.contain('fail to find any devices');
        expect(message).to.contain(emptyPath);
        done();
      });
    });

    it('should emit "error" event for non-existing devices path', (done) => {
      const lookupDevicesInterval = 100;
      const nonExistingPath = '/not-exist';
      const stoplookupDevicesInterval = setTimeout(() => {
        done('"error" event hasn\'t been thrown');
      }, lookupDevicesInterval * 0.9);
      devicesManager = new DevicesManager({devicesPath: nonExistingPath, lookupDevicesInterval, storageDirName});
      devicesManager.on(DevicesManager.EVENTS.ERROR, (e) => {
        clearTimeout(stoplookupDevicesInterval);
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
    const lookupDevicesInterval = 100;
    const calculateCapacityInterval = 100;

    beforeEach((done) => {
      exec(`mkdir -p ./${testFsDir}/dev{1,2}`);

      devicesManager = new DevicesManager({
        devicesPath: testFsPath,
        lookupDevicesInterval,
        calculateCapacityInterval,
        storageDirName
      });
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
        exec(`rm -rf ./${testFsDir}/*`);

        setTimeout(() => {
          devicesManager.getDeviceForWrite((err, dev) => {
            expect(err.message).to.contain('No devices for write');
            done();
          });
        }, lookupDevicesInterval * 1.1);
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
        exec(`rm -rf ./${testFsDir}/*`);

        setTimeout(() => {
          expect(devicesManager.getDeviceForWriteSync.bind(devicesManager)).to.throwException((err) => {
            expect(err).to.be.a(Error);
            expect(err.message).to.contain('No devices for write');
            done();
          });
        }, lookupDevicesInterval * 1.1);
      });
    });

    describe('#_mapDevicesNames()', () => {
      it('should return device names only', () => {
        const deviceNames = devicesManager._mapDevicesNames([`/${testFsDir}/dev1/${storageDirName}`]);
        expect(deviceNames).to.be.an('array');
        expect(deviceNames).to.have.length(1);
        expect(deviceNames[0]).to.be('dev1');
      });
    });

    describe('#_parseDfOutput()', () => {
      it('should return device stats, totalCapacity and usedCapacityPercent', () => {
        const dev1 = `${devicesManager.getDevicesPath()}/dev1`;
        const dev2 = `${devicesManager.getDevicesPath()}/dev2`;
        const df = devicesManager._parseDfOutput(
          [
            'Mounted on   1K-blocks Use%',
            '/dev           9999999   0%',
            '/run           9999999   1%',
            '/              9999999  10%',
            `${dev1}             100  50%`,
            `${dev2}             200  50%`
          ].join('\n')
        );
        expect(df).to.be.an('object');
        expect(df).to.only.have.keys('stats', 'totalCapacity', 'usedCapacityPercent');
        expect(df.stats).to.be.an('object');
        expect(df.stats).to.only.have.keys(dev1, dev2);
        expect(df.stats[dev1]).to.be.an('object');
        expect(df.stats[dev1]).to.only.have.keys('usedPercent', 'size');
        expect(df.stats[dev1].usedPercent).to.be(0.5);
        expect(df.stats[dev1].size).to.be(100);
        expect(df.stats[dev2]).to.be.an('object');
        expect(df.stats[dev2]).to.only.have.keys('usedPercent', 'size');
        expect(df.stats[dev2].usedPercent).to.be(0.5);
        expect(df.stats[dev2].size).to.be(200);
        expect(df.totalCapacity).to.be(300);
        expect(df.usedCapacityPercent).to.be(0.5);
      });

      it('should return device stats, totalCapacity and usedCapacityPercent as null if no devices found', () => {
        const df = devicesManager._parseDfOutput('');
        expect(df).to.be.an('object');
        expect(df).to.only.have.keys('stats', 'totalCapacity', 'usedCapacityPercent');
        expect(df.stats).to.be.an('object');
        expect(df.stats).to.be.empty();
        expect(df.totalCapacity).to.be(null);
        expect(df.usedCapacityPercent).to.be(null);
      });
    });

    describe('#_calculateCapacity()', () => {
      let _calculateCapacityFn;

      beforeEach(() => {
        _calculateCapacityFn = simple.mock(devicesManager, '_calculateCapacity');
      });

      afterEach(() => {
        _calculateCapacityFn = null;
        simple.restore();
      });

      it('##getTotalCapacity() should be null by default and after first check', (done) => {
        expect(devicesManager.getTotalCapacity()).to.be(null);

        setTimeout(() => {
          expect(devicesManager.getTotalCapacity()).to.be(null);
          expect(_calculateCapacityFn.callCount).to.be.greaterThan(0);
          done();
        }, calculateCapacityInterval * 1.1);
      });

      it('##getUsedCapacityPercent() should be null by default and after first check', (done) => {
        expect(devicesManager.getUsedCapacityPercent()).to.be(null);

        setTimeout(() => {
          expect(devicesManager.getUsedCapacityPercent()).to.be(null);
          expect(_calculateCapacityFn.callCount).to.be.greaterThan(0);
          done();
        }, calculateCapacityInterval * 1.1);
      });

      it('##getCapacityStats() should be empty by default and after first check', (done) => {
        const stats = devicesManager.getCapacityStats();
        expect(stats).to.be.an('object');
        expect(stats).to.be.empty();

        setTimeout(() => {
          const stats = devicesManager.getCapacityStats();
          expect(stats).to.be.an('object');
          expect(stats).to.be.empty();
          expect(_calculateCapacityFn.callCount).to.be.greaterThan(0);
          done();
        }, calculateCapacityInterval * 1.1);
      });
    });
  });
});
