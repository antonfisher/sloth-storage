const fs = require('fs');
const {join} = require('path');
const async = require('async');
const expect = require('expect.js');
const {exec} = require('./utils');
const MergedFs = require('../src/mergedFs');
const DevicesManager = require('../src/devicesManager');

const testFsDir = 'testfs';
const testFsPath = join(process.cwd(), testFsDir);

let devicesManager;
let mergedFs;

function createTestFs() {
  exec(`mkdir -p ./${testFsDir}/dev{1,2}`);
  exec(`mkdir -p ./${testFsDir}/dev1/dir{1,2}`);
  exec(`mkdir -p ./${testFsDir}/dev2/dir{2,3}`);
  exec(`touch ./${testFsDir}/dev1/file1.txt`);
  exec(`touch ./${testFsDir}/dev1/dir1/file1-1.txt`);
  exec(`echo 'content' > ./${testFsDir}/dev2/file2.txt`);
  exec(`ln -s ../file2.txt ./${testFsDir}/dev2/dir3/link-file2.txt`);
}

function removeTestFs() {
  exec(`rm -rf ./${testFsDir}`);
}

describe('mergedFs', () => {
  beforeEach(() => {
    createTestFs();
    devicesManager = new DevicesManager(testFsPath);
    mergedFs = new MergedFs(devicesManager);
  });

  afterEach(() => {
    removeTestFs();
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

    it('Should return list of files in sub-directory', (done) => {
      mergedFs.readdir(join(testFsPath, 'dir1'), (err, res) => {
        expect(res).to.be.an('array');
        expect(res).to.have.length(1);
        expect(res).to.contain('file1-1.txt');
        done(err);
      });
    });

    it('Should return ENOENT error for non-existing directory', (done) => {
      mergedFs.readdir(join(testFsPath, 'dir-not-exist'), (err, res) => {
        expect(err).to.be.an(Error);
        expect(err.code).to.be('ENOENT');
        expect(res).to.be(undefined);
        done();
      });
    });
  });

  describe('#rmdir()', () => {
    it('Should remove existing directory', (done) => {
      mergedFs.rmdir(join(testFsPath, 'dir2'), (err) => {
        expect(err).to.be(null);
        done();
      });
    });

    it('Should return error for non-existing directory', (done) => {
      mergedFs.rmdir(join(testFsPath, 'dir-not-exist'), (err) => {
        expect(err).to.be.an(Error);
        expect(err.code).to.be('ENOENT');
        done();
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
        expect(err).to.be.an(Error);
        expect(err).to.have.key('code');
        expect(err.code).to.be('ENOENT');
        done();
      });
    });
  });

  describe('#lstat()', () => {
    it('Should return lstat for file', (done) => {
      mergedFs.lstat(join(testFsPath, 'file2.txt'), (err, res) => {
        expect(res).to.be.an('object');
        expect(res).to.have.key('atime');
        done(err);
      });
    });

    it('Should return lstat for link', (done) => {
      mergedFs.lstat(join(testFsPath, 'dir3', 'link-file2.txt'), (err, res) => {
        expect(res).to.be.an('object');
        expect(res).to.have.key('atime');
        done(err);
      });
    });

    it('Should return error for non-existion file', (done) => {
      mergedFs.lstat(join(testFsPath, 'file-not-exist.txt'), (err, res) => {
        expect(res).to.be(undefined);
        expect(err).to.be.an(Error);
        expect(err).to.have.key('code');
        expect(err.code).to.be('ENOENT');
        done();
      });
    });
  });

  describe('#readFile()', () => {
    it('Should read existing file', (done) => {
      mergedFs.readFile(join(testFsPath, 'file2.txt'), (err, data) => {
        expect(err).to.be(null);
        expect(data).to.be.a(Buffer);
        expect(data.toString()).to.be('content\n');
        done(err);
      });
    });

    it('Should support enconding parameter', (done) => {
      mergedFs.readFile(join(testFsPath, 'file2.txt'), 'utf8', (err, data) => {
        expect(err).to.be(null);
        expect(data).to.be('content\n');
        done(err);
      });
    });

    it('Should return ENOENT error for non-existing file', (done) => {
      mergedFs.readFile(join(testFsPath, 'file-not-exist.txt'), (err, data) => {
        expect(data).to.be(undefined);
        expect(err).to.be.a(Error);
        expect(err).to.have.key('code');
        expect(err.code).to.be('ENOENT');
        done();
      });
    });
  });

  describe('#unlink()', () => {
    it('Should remove existing file', (done) => {
      const filePath = join(testFsPath, 'file2.txt');
      mergedFs.unlink(filePath, (err) => {
        expect(err).to.be(null);
        mergedFs.readFile(filePath, (err) => {
          expect(err).to.be.a(Error);
          expect(err.code).to.be('ENOENT');
          done();
        });
      });
    });

    it('Should return ENOENT error for non-existing file', (done) => {
      const filePath = join(testFsPath, 'file-not-exist.txt');
      mergedFs.unlink(filePath, (err, res) => {
        expect(err).to.be.a(Error);
        expect(err.code).to.be('ENOENT');
        expect(res).to.be(undefined);
        done();
      });
    });
  });

  describe('#writeFile()', () => {
    it('Should write file to the root', (done) => {
      const content = 'content';
      const newFilePath = join(testFsPath, 'new-file.txt');

      mergedFs.writeFile(newFilePath, content, 'utf8', (err) => {
        expect(err).to.not.be.ok();
        if (err) {
          return done(err);
        }
        mergedFs.readFile(newFilePath, 'utf8', (err, data) => {
          expect(err).to.not.be.ok();
          expect(data).to.be.a('string');
          expect(data).to.be(content);
          done(err);
        });
      });
    });

    it('Should work w/o encoding parameter', (done) => {
      const content = 'content';
      const newFilePath = join(testFsPath, 'new-file.txt');

      mergedFs.writeFile(newFilePath, content, (err) => {
        expect(err).to.not.be.ok();
        done(err);
      });
    });

    it('Should write file to the directory', (done) => {
      const content = 'content';
      const newFilePath = join(testFsPath, 'dir1', 'new-file.txt');

      mergedFs.writeFile(newFilePath, content, 'utf8', (err) => {
        expect(err).to.not.be.ok();
        if (err) {
          return done(err);
        }
        mergedFs.readFile(newFilePath, 'utf8', (err, data) => {
          expect(err).to.not.be.ok();
          expect(data).to.be.a('string');
          expect(data).to.be(content);
          done(err);
        });
      });
    });

    it('Should return ENOENT if destination is a file, not a directory', (done) => {
      const newFilePath = join(testFsPath, 'file1.txt', 'new-file.txt');

      mergedFs.writeFile(newFilePath, '', 'utf8', (err) => {
        expect(err).to.be.an(Error);
        expect(err.code).to.be('EISFILE');
        done();
      });
    });

    it('Should return ENOENT error for non-existing directory', (done) => {
      const newFilePath = join(testFsPath, 'dir-non-existing', 'new-file.txt');

      mergedFs.writeFile(newFilePath, '', 'utf8', (err) => {
        expect(err).to.be.an(Error);
        expect(err.code).to.be('ENOENT');
        done();
      });
    });
  });
});
