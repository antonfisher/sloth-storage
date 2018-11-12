const expect = require('expect.js');
const {join} = require('path');

const DevicesManager = require('../../src/application/devicesManager');
const Replicator = require('../../src/application/replicator');
const MergedFs = require('../../src/application/mergedFs');

const {exec} = require('../utils');

const testFsDir = 'testfs';
const testFsPath = join(process.cwd(), testFsDir);
const storageDirName = '.sloth-storage';
const lookupDevicesInterval = 100;

describe('replicator', () => {
  describe('#constructor', () => {
    it('should require devicesManager parameter', () => {
      expect(() => new Replicator()).to.throwException((e) => {
        expect(e.message).to.contain('devicesManager');
      });
    });
  });

  describe('queue methods', () => {
    let replicator;

    beforeEach(() => {
      replicator = new Replicator({
        idleTimeout: 10000,
        devicesManager: true // replace by mock?
      });
    });

    afterEach(() => {
      replicator.destroy();
      replicator = null;
    });

    it('should mark only added device/relativePath as ready to read', () => {
      replicator._addToQueue('a', 'a1');
      expect(replicator.isReady('a', 'a1')).to.be(true);
      expect(replicator.isReady('b', 'a1')).to.be(false);
      expect(replicator.isReady('b', 'b1')).to.be(true);
      replicator._popFromQueue('a', 'a1');
      expect(replicator.isReady('b', 'a1')).to.be(true);
    });

    it('should mark added items as busy ones (multi)', () => {
      replicator._addToQueue('a', 'a1');
      replicator._addToQueue('a', 'a2');
      expect(replicator.isReady('a', 'a1')).to.be(true);
      expect(replicator.isReady('b', 'a1')).to.be(false);
      expect(replicator.isReady('a', 'a2')).to.be(true);
      expect(replicator.isReady('b', 'a2')).to.be(false);

      const [dev1, path1] = replicator._popFromQueue();
      expect(dev1).to.be('a');
      expect(path1).to.be('a1');
      expect(replicator.isReady('a', 'a1')).to.be(true);
      expect(replicator.isReady('b', 'a1')).to.be(true);
      expect(replicator.isReady('a', 'a2')).to.be(true);
      expect(replicator.isReady('b', 'a2')).to.be(false);

      const [dev2, path2] = replicator._popFromQueue();
      expect(dev2).to.be('a');
      expect(path2).to.be('a2');
      expect(replicator.isReady('a', 'a1')).to.be(true);
      expect(replicator.isReady('b', 'a1')).to.be(true);
      expect(replicator.isReady('a', 'a2')).to.be(true);
      expect(replicator.isReady('b', 'a2')).to.be(true);

      const [dev3, path3] = replicator._popFromQueue();
      expect(dev3).to.be(null);
      expect(path3).to.be(null);
      expect(replicator.isReady('a', 'a1')).to.be(true);
      expect(replicator.isReady('b', 'a1')).to.be(true);
      expect(replicator.isReady('a', 'a2')).to.be(true);
      expect(replicator.isReady('b', 'a2')).to.be(true);
    });
  });

  describe('replication', () => {
    let devicesManager;
    let replicator;
    let mergedFs;

    beforeEach((done) => {
      exec(`mkdir -p ./${testFsDir}/dev{1,2}`);
      exec(`mkdir -p ./${testFsDir}/dev1/${storageDirName}`);
      exec(`mkdir -p ./${testFsDir}/dev2/${storageDirName}`);
      exec(`mkdir -p ./${testFsDir}/dev3/${storageDirName}`);

      devicesManager = new DevicesManager({devicesPath: testFsPath, lookupDevicesInterval, storageDirName});
      mergedFs = new MergedFs({
        devicesManager,
        isFileReady: (dev, relativePath) => replicator.isReady(dev, relativePath)
      });
      devicesManager.on(DevicesManager.EVENTS.READY, () => {
        replicator = new Replicator({idleTimeout: 50, mergedFs, devicesManager, replicationCount: 2});
        done();
      });
    });

    afterEach(() => {
      devicesManager.destroy();
      devicesManager = null;
      replicator.destroy();
      replicator = null;
      mergedFs = null;
      exec(`rm -rf ./${testFsDir}`);
    });

    it('should replicate file to 2 copies', (done) => {
      const testFileName = 'test.txt';
      const devices = devicesManager.getDevices(false);

      exec(`echo "test" > ${devices[0]}/${testFileName}`);

      replicator.on(Replicator.EVENTS.ERROR, (err) => done(err));
      replicator.on(Replicator.EVENTS.QUEUE_LENGTH_CHANGED, (queueLength) => {
        if (queueLength === 0) {
          const filesCount = Number(exec(`find ${testFsDir} -type f -name ${testFileName} | wc -l`));
          expect(filesCount).to.be(2);
          done();
        }
      });

      replicator.onFileUpdate(devices[0], testFileName);
    });

    it('should add files if replicationCount increased', (done) => {
      const testFileName = 'test.txt';
      const devices = devicesManager.getDevices(false);

      exec(`echo "test" > ${devices[0]}/${testFileName}`);
      exec(`echo "test" > ${devices[2]}/${testFileName}`);

      replicator.on(Replicator.EVENTS.ERROR, (err) => done(err));
      replicator.on(Replicator.EVENTS.REPLICATION_FINISHED, () => {
        const filesCount = Number(exec(`find ${testFsDir} -type f -name ${testFileName} | wc -l`));
        expect(filesCount).to.be(3);
        done();
      });

      replicator.setReplicationCount(3);
    });

    it('should remove files if replicationCount decreased', (done) => {
      const testFileName = 'test.txt';
      const devices = devicesManager.getDevices(false);

      exec(`echo "test" > ${devices[0]}/${testFileName}`);
      exec(`echo "test" > ${devices[2]}/${testFileName}`);

      replicator.on(Replicator.EVENTS.ERROR, (err) => done(err));
      replicator.on(Replicator.EVENTS.REPLICATION_FINISHED, () => {
        const filesCount = Number(exec(`find ${testFsDir} -type f -name ${testFileName} | wc -l`));
        expect(filesCount).to.be(1);
        done();
      });

      replicator.setReplicationCount(1);
    });
  });
});
