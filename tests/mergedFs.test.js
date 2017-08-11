const fs = require('fs');
const {join} = require('path');
const async = require('async');
const expect = require('expect.js');

const {exec} = require('./utils');
const MergedFs = require('../src/mergedFs');
const DevicesManager = require('../src/devicesManager');

const testFsDir = 'testfs';
const testFsPath = join(process.cwd(), testFsDir);
const storageDirName = '.slug-storage';

let devicesManager;
let mergedFs;

function createTestFs() {
  exec(`mkdir -p ./${testFsDir}/dev{1,2}`);
  exec(`mkdir -p ./${testFsDir}/dev1/.slug-storage/dir{1,2,3}`);
  exec(`mkdir -p ./${testFsDir}/dev2/.slug-storage/dir{1,2,3}`);
  exec(`touch ./${testFsDir}/dev1/.slug-storage/file1.txt`);
  exec(`touch ./${testFsDir}/dev1/.slug-storage/dir1/file1-1.txt`);
  exec(`echo 'content' > ./${testFsDir}/dev2/.slug-storage/file2.txt`);
  exec(`ln -s ../file2.txt ./${testFsDir}/dev2/.slug-storage/dir3/link-file2.txt`);
}

function removeTestFs() {
  exec(`rm -rf ./${testFsDir}`);
}

describe('mergedFs', () => {
  beforeEach((done) => {
    createTestFs();
    devicesManager = new DevicesManager(testFsPath, 1000, storageDirName);
    devicesManager.on(DevicesManager.EVENTS.WARN, message => console.log(`WARN: ${message}`));
    devicesManager.on(DevicesManager.EVENTS.ERROR, message => console.log(`ERROR: ${message}`));
    devicesManager.on(DevicesManager.EVENTS.READY, () => {
      mergedFs = new MergedFs(devicesManager);
      done();
    });
  });

  afterEach(() => {
    devicesManager.destroy();
    devicesManager = null;
    mergedFs = null;
    removeTestFs();
  });

  describe('#constructor', () => {
    it('should require devicesManager parameter', () => {
      expect(() => new MergedFs()).to.throwException((e) => {
        expect(e.message).to.contain('devicesManager');
      });
    });
  });

  describe('#_getRelativePath()', () => {
    it('should return path w/o base path', () => {
      const path = '/test/test.txt';
      const fullPath = join(devicesManager.getDevicesPath(), path);
      expect(mergedFs._getRelativePath(fullPath)).to.be(path);
    });

    it('should not resolve wrong paths', () => {
      const path = '/test/test.txt';
      expect(mergedFs._getRelativePath.bind(mergedFs))
        .withArgs(path)
        .to
        .throwException((err) => {
          expect(err).to.be.a(Error);
          expect(err).to.have.property('code', 'ENOENT');
        });
    });

    it('should return "/" for devices root path', () => {
      expect(mergedFs._getRelativePath(devicesManager.getDevicesPath())).to.be('/');
    });
  });

  describe('#_resolvePath()', () => {
    it('should return path to file on device', (done) => {
      mergedFs._resolvePath(join(testFsPath, 'file1.txt'), (err, res) => {
        expect(err).to.not.be.ok();
        expect(res).to.be.a('string');
        expect(res).to.be(`${testFsPath}/dev1/.slug-storage/file1.txt`);
        done(err);
      });
    });

    it('should return an ENOENT error if path is not exist', (done) => {
      mergedFs._resolvePath(join(testFsPath, 'file-not-exist.txt'), (err, res) => {
        expect(err).to.be.a(Error);
        expect(err).to.have.property('code', 'ENOENT');
        expect(res).to.be(undefined);
        done();
      });
    });

    it('should throw an ENOENT error if path is undefined', (done) => {
      mergedFs._resolvePath(null, (err, res) => {
        expect(err).to.be.a(Error);
        expect(err).to.have.property('code', 'ENOENT');
        expect(res).to.be(undefined);
        done();
      });
    });
  });

  describe('#_resolvePathSync()', () => {
    it('should return path to file on device', () => {
      const resolvedPath = mergedFs._resolvePathSync(join(testFsPath, 'file1.txt'));

      expect(resolvedPath).to.be(`${testFsPath}/dev1/.slug-storage/file1.txt`);
    });

    it('should throw an ENOENT error if path is not exist', () => {
      expect(mergedFs._resolvePathSync.bind(mergedFs))
        .withArgs(join(testFsPath, '.slug-storage/file-not-exist.txt'))
        .to
        .throwException((e) => {
          expect(e).to.be.a(Error);
          expect(e).to.have.property('code', 'ENOENT');
        });
    });

    it('should throw an ENOENT error if path is undefined', () => {
      expect(mergedFs._resolvePathSync).to.throwException((e) => {
        expect(e).to.be.a(Error);
        expect(e).to.have.property('code', 'ENOENT');
      });
    });
  });

  describe('#mkdir()', () => {
    it('should create new directory in the storage directory on a device', (done) => {
      const dir = 'dir-new-1';
      const devices = devicesManager.getDevices();

      mergedFs.mkdir(join(testFsPath, dir), (errMkdir) => {
        if (errMkdir) {
          return done(errMkdir);
        }

        fs.readdir(devices[0], (errReaddir, files) => {
          expect(files).to.contain(dir);
          expect(devices[0]).to.contain(storageDirName);
          done(errReaddir);
        });
      });
    });

    it('should create directory on each device (1 level)', (done) => {
      const dir = 'dir-new-2';
      const devices = devicesManager.getDevices();

      mergedFs.mkdir(join(testFsPath, dir), (errMkdir) => {
        if (errMkdir) {
          return done(errMkdir);
        }

        async.concat(
          devices,
          (dev, devDone) => fs.readdir(dev, devDone),
          (errReaddir, res) => {
            expect(res).to.be.an('array');
            res = res.filter(i => (i === dir));
            expect(res).to.have.length(devices.length);
            done(errReaddir);
          }
        );
      });
    });

    it('should create directory on each device (2 level)', (done) => {
      const dir = 'dir-new-3';
      const subDir = 'dir1';
      const devices = devicesManager.getDevices();
      mergedFs.mkdir(join(testFsPath, subDir, dir), (errMkdir) => {
        if (errMkdir) {
          return done(errMkdir);
        }

        async.concat(
          devices,
          (dev, devDone) => fs.readdir(join(dev, subDir), devDone),
          (errReaddir, res) => {
            expect(res).to.be.an('array');
            res = res.filter(i => (i === dir));
            expect(res).to.have.length(devices.length);
            done(errReaddir);
          }
        );
      });
    });

    it('should return ENOENT if second level directory doesn\'t exist', (done) => {
      mergedFs.mkdir(join(testFsPath, 'dir-not-exist', 'dir-new-4'), (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', 'ENOENT');
        done();
      });
    });

    it('should return ENOENT for out of scope path', (done) => {
      mergedFs.mkdir('/path-out-of-scope', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', 'ENOENT');
        done();
      });
    });
  });

  describe('#readdir()', () => {
    it('should return list of files in directory', (done) => {
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

    it('should return list of files in sub-directory', (done) => {
      mergedFs.readdir(join(testFsPath, 'dir1'), (err, res) => {
        expect(res).to.be.an('array');
        expect(res).to.have.length(1);
        expect(res).to.contain('file1-1.txt');
        done(err);
      });
    });

    it('should return ENOENT error for non-existing directory', (done) => {
      mergedFs.readdir(join(testFsPath, 'dir-not-exist'), (err, res) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', 'ENOENT');
        expect(res).to.be(undefined);
        done();
      });
    });

    it('should return ENOENT for out of scope path', (done) => {
      mergedFs.readdir('/path-out-of-scope', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', 'ENOENT');
        done();
      });
    });
  });

  describe('#rmdir()', () => {
    it('should remove existing directory', (done) => {
      mergedFs.rmdir(join(testFsPath, 'dir2'), (err) => {
        expect(err).to.be(null);
        done();
      });
    });

    it('should return error for non-existing directory', (done) => {
      mergedFs.rmdir(join(testFsPath, 'dir-not-exist'), (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', 'ENOENT');
        done();
      });
    });

    it('should return ENOENT for out of scope path', (done) => {
      mergedFs.rmdir('/path-out-of-scope', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', 'ENOENT');
        done();
      });
    });
  });

  describe('#exists()', () => { // this method is deprecated in node v8
    it('should return TRUE for existing file', (done) => {
      mergedFs.exists(join(testFsPath, 'file1.txt'), (res) => {
        expect(res).to.be.an('boolean');
        expect(res).to.be(true);
        done();
      });
    });

    it('should return FALSE for not existing file', (done) => {
      mergedFs.exists(join(testFsPath, 'file-not-exist.txt'), (res) => {
        expect(res).to.be.an('boolean');
        expect(res).to.be(false);
        done();
      });
    });
  });

  describe('#stat()', () => {
    it('should return stat for file', (done) => {
      mergedFs.stat(join(testFsPath, 'file1.txt'), (err, res) => {
        expect(res).to.be.an('object');
        expect(res).to.have.key('atime');
        done(err);
      });
    });

    it('should return error for non-existion file', (done) => {
      mergedFs.stat(join(testFsPath, 'file-not-exist.txt'), (err, res) => {
        expect(res).to.be(undefined);
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', 'ENOENT');
        done();
      });
    });
  });

  describe('#statSync()', () => {
    it('should return stat for file', (done) => {
      try {
        const stat = mergedFs.statSync(join(testFsPath, 'file1.txt'));
        expect(stat).to.be.an('object');
        expect(stat).to.have.key('atime');
        done();
      } catch (e) {
        done(e);
      }
    });

    it('should return error for non-existion file', (done) => {
      try {
        mergedFs.statSync(join(testFsPath, 'file-not-exist.txt'));
        done('did not throw an exception');
      } catch (e) {
        expect(e).to.be.an(Error);
        expect(e).to.have.property('code', 'ENOENT');
        done();
      }
    });
  });

  describe('#lstat()', () => {
    it('should return lstat for file', (done) => {
      mergedFs.lstat(join(testFsPath, 'file2.txt'), (err, res) => {
        expect(res).to.be.an('object');
        expect(res).to.have.key('atime');
        done(err);
      });
    });

    it('should return lstat for link', (done) => {
      mergedFs.lstat(join(testFsPath, 'dir3', 'link-file2.txt'), (err, res) => {
        expect(res).to.be.an('object');
        expect(res).to.have.key('atime');
        done(err);
      });
    });

    it('should return error for non-existion file', (done) => {
      mergedFs.lstat(join(testFsPath, 'file-not-exist.txt'), (err, res) => {
        expect(res).to.be(undefined);
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', 'ENOENT');
        done();
      });
    });
  });

  describe('#readFile()', () => {
    it('should read existing file', (done) => {
      mergedFs.readFile(join(testFsPath, 'file2.txt'), (err, data) => {
        expect(err).to.be(null);
        expect(data).to.be.a(Buffer);
        expect(data.toString()).to.be('content\n');
        done(err);
      });
    });

    it('should support enconding parameter', (done) => {
      mergedFs.readFile(join(testFsPath, 'file2.txt'), 'utf8', (err, data) => {
        expect(err).to.be(null);
        expect(data).to.be('content\n');
        done(err);
      });
    });

    it('should return ENOENT error for non-existing file', (done) => {
      mergedFs.readFile(join(testFsPath, 'file-not-exist.txt'), (err, data) => {
        expect(data).to.be(undefined);
        expect(err).to.be.a(Error);
        expect(err).to.have.property('code', 'ENOENT');
        done();
      });
    });

    it('should return ENOENT for out of scope path', (done) => {
      mergedFs.readFile('/path-out-of-scope', (err, data) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', 'ENOENT');
        expect(data).to.be(undefined);
        done();
      });
    });
  });

  describe('#unlink()', () => {
    it('should remove existing file', (done) => {
      const filePath = join(testFsPath, 'file2.txt');
      mergedFs.unlink(filePath, (errUnlink) => {
        expect(errUnlink).to.be(null);
        mergedFs.readFile(filePath, (errRead) => {
          expect(errRead).to.be.a(Error);
          expect(errRead).to.have.property('code', 'ENOENT');
          done();
        });
      });
    });

    it('should return ENOENT error for non-existing file', (done) => {
      const filePath = join(testFsPath, 'file-not-exist.txt');
      mergedFs.unlink(filePath, (err, res) => {
        expect(err).to.be.a(Error);
        expect(err).to.have.property('code', 'ENOENT');
        expect(res).to.be(undefined);
        done();
      });
    });

    it('should return ENOENT for out of scope path', (done) => {
      mergedFs.unlink('/path-out-of-scope', (err, res) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', 'ENOENT');
        expect(res).to.be(undefined);
        done();
      });
    });
  });

  describe('#writeFile()', () => {
    it('should write file to the root', (done) => {
      const content = 'content';
      const newFilePath = join(testFsPath, 'new-file.txt');

      mergedFs.writeFile(newFilePath, content, 'utf8', (errWrite) => {
        expect(errWrite).to.not.be.ok();
        if (errWrite) {
          return done(errWrite);
        }
        mergedFs.readFile(newFilePath, 'utf8', (errRead, data) => {
          expect(errRead).to.not.be.ok();
          expect(data).to.be.a('string');
          expect(data).to.be(content);
          done(errRead);
        });
      });
    });

    it('should work w/o encoding parameter', (done) => {
      const content = 'content';
      const newFilePath = join(testFsPath, 'new-file.txt');

      mergedFs.writeFile(newFilePath, content, (err) => {
        expect(err).to.not.be.ok();
        done(err);
      });
    });

    it('should write file to the directory', (done) => {
      const content = 'content';
      const newFilePath = join(testFsPath, 'dir1', 'new-file.txt');

      mergedFs.writeFile(newFilePath, content, 'utf8', (errWrite) => {
        expect(errWrite).to.not.be.ok();
        if (errWrite) {
          return done(errWrite);
        }
        mergedFs.readFile(newFilePath, 'utf8', (errRead, data) => {
          expect(errRead).to.not.be.ok();
          expect(data).to.be.a('string');
          expect(data).to.be(content);
          done(errRead);
        });
      });
    });

    it('should return EISFILE if destination is a file, not a directory', (done) => {
      const newFilePath = join(testFsPath, 'file1.txt', 'new-file.txt');

      mergedFs.writeFile(newFilePath, '', 'utf8', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', 'EISFILE');
        done();
      });
    });

    it('should return ENOENT error for non-existing directory', (done) => {
      const newFilePath = join(testFsPath, 'dir-non-existing', 'new-file.txt');

      mergedFs.writeFile(newFilePath, '', 'utf8', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', 'ENOENT');
        done();
      });
    });

    it('should return ENOENT error for non-existing sub-directories', (done) => {
      const newFilePath = join(testFsPath, 'dir-non-existing', 'dir-non-existing', 'new-file.txt');

      mergedFs.writeFile(newFilePath, '', 'utf8', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', 'ENOENT');
        done();
      });
    });

    it('should return ENOENT for out of scope path', (done) => {
      mergedFs.writeFile('/path-out-of-scope', '', 'utf8', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', 'ENOENT');
        done();
      });
    });
  });

  describe('#createReadStream()', () => {
    it('should read existing file', (done) => {
      let stream;

      try {
        stream = mergedFs.createReadStream(join(testFsPath, 'file2.txt'));
      } catch (e) {
        return done(`createReadStream() should not throw an exception: ${e}`);
      }

      stream.on('data', (data) => {
        expect(data).to.be.a(Buffer);
        expect(data.toString()).to.be('content\n');
        done();
      });
    });

    it('should support enconding parameter', (done) => {
      try {
        const stream = mergedFs.createReadStream(join(testFsPath, 'file2.txt'), {encoding: 'utf8'});
        stream.on('data', (data) => {
          expect(data).to.be.a('string');
          expect(data).to.be('content\n');
          done();
        });
      } catch (e) {
        done(`createReadStream() should not throw an exception: ${e}`);
      }
    });

    it('should return ENOENT error for non-existing file', (done) => {
      expect(mergedFs.createReadStream.bind(mergedFs))
        .withArgs(join(testFsPath, 'file-not-exist.txt'))
        .to
        .throwException((err) => {
          expect(err).to.be.a(Error);
          expect(err).to.have.property('code', 'ENOENT');
          done();
        });
    });

    it('should return ENOENT error for empty path', (done) => {
      expect(mergedFs.createReadStream.bind(mergedFs))
        .withArgs('')
        .to
        .throwException((err) => {
          expect(err).to.be.a(Error);
          expect(err).to.have.property('code', 'ENOENT');
          done();
        });
    });
  });

  describe('#createWriteStream()', () => {
    it('should create write stream to the root', (done) => {
      const content = 'content';
      const newFilePath = join(testFsPath, 'new-file.txt');

      try {
        const stream = mergedFs.createWriteStream(newFilePath, {defaultEncoding: 'utf8'});
        stream.end(content);
        stream.on('finish', () => {
          mergedFs.readFile(newFilePath, 'utf8', (err, data) => {
            expect(err).to.not.be.ok();
            expect(data).to.be.a('string');
            expect(data).to.be(content);
            done(err);
          });
        });
      } catch (e) {
        return done(`createWriteStream() should not throw an exception: ${e}`);
      }
    });

    it('should work w/o encoding parameter', (done) => {
      const content = 'content';
      const newFilePath = join(testFsPath, 'new-file-1.txt');

      try {
        const stream = mergedFs.createWriteStream(newFilePath);
        stream.end(Buffer(content));
        stream.on('finish', () => {
          mergedFs.readFile(newFilePath, 'utf8', (err, data) => {
            expect(err).to.not.be.ok();
            expect(data).to.be.a('string');
            expect(data).to.be(content);
            done(err);
          });
        });
      } catch (e) {
        return done(`createWriteStream() should not throw an exception: ${e}`);
      }
    });

    it('should create write stream to the directory', (done) => {
      const content = 'content';
      const newFilePath = join(testFsPath, 'dir2', 'new-file-in-directory.txt');

      try {
        const stream = mergedFs.createWriteStream(newFilePath, {defaultEncoding: 'utf8'});
        stream.end(content);
        stream.on('finish', () => {
          mergedFs.readFile(newFilePath, 'utf8', (err, data) => {
            expect(err).to.not.be.ok();
            expect(data).to.be.a('string');
            expect(data).to.be(content);
            done(err);
          });
        });
      } catch (e) {
        return done(`createWriteStream() should not throw an exception: ${e}`);
      }
    });

    it('should return EISFILE if destination is a file, not a directory', (done) => {
      expect(mergedFs.createWriteStream.bind(mergedFs))
        .withArgs(join(testFsPath, 'file2.txt', 'file-not-exist.txt'))
        .to
        .throwException((err) => {
          expect(err).to.be.a(Error);
          expect(err).to.have.property('code', 'EISFILE');
          done();
        });
    });

    it('should return ENOENT error for non-existing directory', (done) => {
      expect(mergedFs.createWriteStream.bind(mergedFs))
        .withArgs(join(testFsPath, 'dir-not-exist', 'file-not-exist.txt'))
        .to
        .throwException((err) => {
          expect(err).to.be.a(Error);
          expect(err).to.have.property('code', 'ENOENT');
          done();
        });
    });

    it('should return ENOENT error for non-existing sub-directories', (done) => {
      expect(mergedFs.createWriteStream.bind(mergedFs))
        .withArgs(join(testFsPath, 'dir-not-exist', 'dir-not-exist', 'file-not-exist.txt'))
        .to
        .throwException((err) => {
          expect(err).to.be.a(Error);
          expect(err).to.have.property('code', 'ENOENT');
          done();
        });
    });

    it('should return ENOENT error for empty path', (done) => {
      expect(mergedFs.createWriteStream.bind(mergedFs))
        .withArgs('')
        .to
        .throwException((err) => {
          expect(err).to.be.a(Error);
          expect(err).to.have.property('code', 'ENOENT');
          done();
        });
    });
  });
});
