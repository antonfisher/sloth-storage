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
      expect(() => new Replicator({})).to.throwException((e) => {
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

    const defaultReplicationCount = 2;

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
        replicator = new Replicator({
          idleTimeout: 50,
          mergedFs,
          devicesManager,
          replicationCount: defaultReplicationCount
        });
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
      const devices = devicesManager.getDevices(false);

      // 1st dir level
      const testFileName1 = 'test0.txt';
      exec(`echo "test1" > ${devices[0]}/${testFileName1}`);

      // 2nd dir level
      const testDirName2 = 'test';
      const testFileName2 = 'test1.txt';
      exec(`mkdir ${devices[0]}/${testDirName2}`);
      exec(`echo "test2" > ${devices[0]}/${testDirName2}/${testFileName2}`);

      replicator.on(Replicator.EVENTS.ERROR, (err) => done(err));
      replicator.on(Replicator.EVENTS.QUEUE_LENGTH_CHANGED, (queueLength) => {
        if (queueLength === 0) {
          // 1st dir level
          const fileCount1 = Number(exec(`find ${testFsDir} -type f -name ${testFileName1} | wc -l`));
          expect(fileCount1).to.be(2);

          // 2nd dir level
          const dirCount2 = Number(exec(`find ${testFsDir} -type d -name ${testDirName2} | wc -l`));
          expect(dirCount2).to.be(2);
          const fileCount2 = Number(exec(`find ${testFsDir} -type f -name ${testFileName2} | wc -l`));
          expect(fileCount2).to.be(2);

          done();
        }
      });

      replicator.onFileUpdate(devices[0], testFileName1);
      replicator.onFileUpdate(devices[0], join(testDirName2, testFileName2));
    });

    it('should add files if replicationCount increased', (done) => {
      const testFileName = 'test.txt';
      const devices = devicesManager.getDevices(false);

      exec(`echo "test" > ${devices[0]}/${testFileName}`);
      exec(`echo "test" > ${devices[2]}/${testFileName}`);

      replicator.on(Replicator.EVENTS.ERROR, (err) => done(err));
      replicator.on(Replicator.EVENTS.REPLICATION_FINISHED, () => {
        const fileCount = Number(exec(`find ${testFsDir} -type f -name ${testFileName} | wc -l`));
        expect(fileCount).to.be(3);

        // files should be equal
        const content0 = String(exec(`cat ${devices[0]}/${testFileName}`));
        const content1 = String(exec(`cat ${devices[1]}/${testFileName}`));
        const content2 = String(exec(`cat ${devices[2]}/${testFileName}`));
        expect(content0).to.be(content1);
        expect(content1).to.be(content2);

        done();
      });

      replicator.setReplicationCount(defaultReplicationCount + 1);
    });

    it('should remove files if replicationCount decreased', (done) => {
      const testFileName = 'test.txt';
      const devices = devicesManager.getDevices(false);

      exec(`echo "test" > ${devices[0]}/${testFileName}`);
      exec(`echo "test" > ${devices[2]}/${testFileName}`);

      replicator.on(Replicator.EVENTS.ERROR, (err) => done(err));
      replicator.on(Replicator.EVENTS.REPLICATION_FINISHED, () => {
        const fileCount = Number(exec(`find ${testFsDir} -type f -name ${testFileName} | wc -l`));
        expect(fileCount).to.be(1);
        done();
      });

      replicator.setReplicationCount(defaultReplicationCount - 1);
    });

    it('should not do anything if replicationCount was set to the same value', (done) => {
      replicator.on(Replicator.EVENTS.ERROR, (err) => done(err));
      replicator.on(Replicator.EVENTS.REPLICATION_STARTED, () => done('REPLICATION_STARTED event was fired'));
      replicator.setReplicationCount(defaultReplicationCount);
      setTimeout(() => done(), 10);
    });

    it('should emit a warning if value is 0', (done) => {
      const failTimeout = setTimeout(() => done('not warning emitted'), 10);
      replicator.on(Replicator.EVENTS.WARN, () => {
        clearTimeout(failTimeout);
        done();
      });
      replicator.on(Replicator.EVENTS.REPLICATION_STARTED, () => done('REPLICATION_STARTED event was fired'));
      replicator.setReplicationCount(0);
    });

    it('Replicator.isReady() should be false during replication process', (done) => {
      const testFileName = 'test.txt';
      const devices = devicesManager.getDevices(false);

      exec(`echo "test" > ${devices[0]}/${testFileName}`);

      replicator.on(Replicator.EVENTS.ERROR, (err) => done(err));
      replicator.on(Replicator.EVENTS.REPLICATION_STARTED, () => expect(replicator.isReady()).to.be(false));
      replicator.on(Replicator.EVENTS.REPLICATION_FINISHED, () => {
        expect(replicator.isReady()).to.be(true);
        done();
      });

      replicator.setReplicationCount(defaultReplicationCount + 1);
    });
  });
});
