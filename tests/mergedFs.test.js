const fs = require('fs');
const {join} = require('path');
const {execSync} = require('child_process');
const async = require('async');
const expect = require('expect.js');
const MergedFs = require('../src/mergedFs');
const DevicesManager = require('../src/devicesManager');

const testFsDir = 'testfs';
const testFsPath = join(process.cwd(), testFsDir);

const exec = (command) => execSync(command, {shell: '/bin/bash'});

let devicesManager;
let mergedFs;

describe('mergedFs', () => {
  beforeEach(() => {
    exec(`mkdir -p ./${testFsDir}/dev{1,2}`);
    exec(`mkdir -p ./${testFsDir}/dev1/dir{1,2}`);
    exec(`mkdir -p ./${testFsDir}/dev2/dir{2,3}`);
    exec(`touch ./${testFsDir}/dev1/file1.txt`);
    exec(`touch ./${testFsDir}/dev2/file2.txt`);

    devicesManager = new DevicesManager(testFsPath);
    mergedFs = new MergedFs(devicesManager);
  });

  afterEach(() => {
    exec(`rm -rf ./${testFsDir}`);
    devicesManager = null;
    mergedFs = null;
  });

  describe('#mkdir()', () => {
    it('Should create directory on each device (1 level)', (done) => {
      const dir = 'dir-new-1';
      const devices = devicesManager.getDevices();

      mergedFs.mkdir(join(testFsPath, dir), (err) => {
        if (err) {
          return done(err);
        }

        async.concat(
          devices,
          (dev, done) => fs.readdir(dev, done),
          (err, res) => {
            expect(res).to.be.an('array');
            res = res.filter(i => (i === dir));
            expect(res).to.have.length(devices.length);
            done(err);
          }
        );
      });
    });

    it('Should create directory on each device (2 level)', (done) => {
      const dir = 'dir-new-2';
      const subDir = 'dir1';
      const devices = devicesManager.getDevices();
      mergedFs.mkdir(join(testFsPath, subDir, dir), (err) => {
        if (err) {
          return done(err);
        }

        async.concat(
          devices,
          (dev, done) => fs.readdir(join(dev, subDir), done),
          (err, res) => {
            expect(res).to.be.an('array');
            res = res.filter(i => (i === dir));
            expect(res).to.have.length(devices.length);
            done(err);
          }
        );
      });
    });
  });

  describe('#readdir()', () => {
    it('Should return list of files in directory', (done) => {
      mergedFs.readdir(testFsPath, (err, res) => {
        expect(res).to.be.an('array');
        expect(res).to.have.length(5);
        expect(res).to.contain('dir1');
        expect(res).to.contain('dir2');
        expect(res).to.contain('dir3');
        expect(res).to.contain('file1.txt');
        expect(res).to.contain('file1.txt');
        done(err);
      });
    });
  });

  describe('#exists()', () => { // this method is deprecated in node v8
    it('Should return TRUE for existing file', (done) => {
      mergedFs.exists(join(testFsPath, 'file1.txt'), (res) => {
        expect(res).to.be.an('boolean');
        expect(res).to.be(true);
        done();
      });
    });

    it('Should return FALSE for not existing file', (done) => {
      mergedFs.exists(join(testFsPath, 'file-not-exist.txt'), (res) => {
        expect(res).to.be.an('boolean');
        expect(res).to.be(false);
        done();
      });
    });
  });

  describe('#stat()', () => {
    it('Should return stat for file', (done) => {
      mergedFs.stat(join(testFsPath, 'file1.txt'), (err, res) => {
        expect(res).to.be.an('object');
        expect(res).to.have.key('atime');
        done(err);
      });
    });

    it('Should return error for non-existion file', (done) => {
      mergedFs.stat(join(testFsPath, 'file-not-exist.txt'), (err, res) => {
        expect(res).to.be(undefined);
        expect(err).to.be.an('object');
        expect(err).to.have.key('code');
        expect(err.code).to.be('ENOENT');
        done();
      });
    });
  });
});
