const fs = require('fs');
const {join} = require('path');
const async = require('async');
const expect = require('expect.js');
const simple = require('simple-mock');

const {exec} = require('../utils');
const MergedFs = require('../../src/application/mergedFs');
const DevicesManager = require('../../src/application/devicesManager');
const {CODES} = require('../../src/application/errorHelpers');

const testFsDir = 'testfs';
const testFsPath = join(process.cwd(), testFsDir);
const storageDirName = '.sloth-storage';
const defaultMode = (0o777 & ~process.umask()).toString(8);

let devicesManager;
let mergedFs;

function createTestFs() {
  exec(`mkdir -p ./${testFsDir}/dev{1,2}`);
  exec(`mkdir -p ./${testFsDir}/dev1/.sloth-storage/dir{1,2}`);
  exec(`mkdir -p ./${testFsDir}/dev2/.sloth-storage/dir{2,3}`);
  exec(`touch ./${testFsDir}/dev1/.sloth-storage/file1.txt`);
  exec(`touch ./${testFsDir}/dev1/.sloth-storage/dir1/file1-1.txt`);
  exec(`echo 'content' > ./${testFsDir}/dev2/.sloth-storage/file2.txt`);
  exec(`ln -s ../file2.txt ./${testFsDir}/dev2/.sloth-storage/dir3/link-file2.txt`);
}

function removeTestFs() {
  exec(`rm -rf ./${testFsDir}`);
}

describe('mergedFs', () => {
  const lookupDevicesInterval = 100;

  beforeEach((done) => {
    createTestFs();
    devicesManager = new DevicesManager({devicesPath: testFsPath, lookupDevicesInterval, storageDirName});
    //devicesManager.on(DevicesManager.EVENTS.WARN, message => console.log(`WARN: ${message}`));
    //devicesManager.on(DevicesManager.EVENTS.ERROR, message => console.log(`ERROR: ${message}`));
    devicesManager.on(DevicesManager.EVENTS.READY, () => {
      mergedFs = new MergedFs({devicesManager});
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
      const path = 'test/test.txt';
      const fullPath = join(devicesManager.getDevicesPath(), path);
      expect(mergedFs._getRelativePath(fullPath)).to.be(path);
    });

    it('should handle path w/o leading "/"', () => {
      const path = 'test/test.txt';
      expect(mergedFs._getRelativePath(path)).to.be(path);
    });

    it('should handle path w/ leading "/"', () => {
      const path = 'test/test.txt';
      expect(mergedFs._getRelativePath(join('/', path))).to.be(path);
    });

    it('should return empty string for devices root path', () => {
      expect(mergedFs._getRelativePath(devicesManager.getDevicesPath())).to.be('');
    });
  });

  describe('#_resolvePath()', () => {
    it('should return path to file on device', (done) => {
      mergedFs._resolvePath('file1.txt', (err, res) => {
        expect(err).to.not.be.ok();
        expect(res).to.be.a('string');
        expect(res).to.be(`${testFsPath}/dev1/.sloth-storage/file1.txt`);
        done(err);
      });
    });

    it('should return an ENOENT error if path is not exist', (done) => {
      mergedFs._resolvePath('file-not-exist.txt', (err, res) => {
        expect(err).to.be.a(Error);
        expect(err).to.have.property('code', CODES.ENOENT);
        expect(res).to.be(undefined);
        done();
      });
    });

    it('should throw an ENOENT error if path is undefined', (done) => {
      mergedFs._resolvePath(null, (err, res) => {
        expect(err).to.be.a(Error);
        expect(err).to.have.property('code', CODES.ENOENT);
        expect(res).to.be(undefined);
        done();
      });
    });
  });

  describe('#_resolvePathSync()', () => {
    it('should return path to file on device', () => {
      const resolvedPath = mergedFs._resolvePathSync('file1.txt');

      expect(resolvedPath).to.be(`${testFsPath}/dev1/.sloth-storage/file1.txt`);
    });

    it('should throw an ENOENT error if path is not exist', () => {
      expect(mergedFs._resolvePathSync.bind(mergedFs))
        .withArgs('file-not-exist.txt')
        .to.throwException((e) => {
          expect(e).to.be.a(Error);
          expect(e).to.have.property('code', CODES.ENOENT);
        });
    });

    it('should throw an ENOENT error if path is undefined', () => {
      expect(mergedFs._resolvePathSync.bind(mergedFs)).to.throwException((e) => {
        expect(e).to.be.a(Error);
        expect(e).to.have.property('code', CODES.ENOENT);
      });
    });
  });

  describe('#_mkdirRecursive()', () => {
    it('should create 1-level directory', (done) => {
      const path = join(testFsPath, 'dev1', '.sloth-storage', 'a');
      mergedFs._mkdirRecursive(path, (err) => {
        expect(err).to.not.be.ok();
        try {
          const stat = fs.statSync(path);
          expect(stat.isDirectory()).to.be(true);
          expect(stat.mode.toString(8)).to.contain(defaultMode);
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it('should create 2-level directory', (done) => {
      const path = join(testFsPath, 'dev1', '.sloth-storage', 'b', 'bb');

      mergedFs._mkdirRecursive(path, (err) => {
        expect(err).to.not.be.ok();
        try {
          const stat = fs.statSync(path);
          expect(stat.isDirectory()).to.be(true);
          expect(stat.mode.toString(8)).to.contain(defaultMode);
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it('should create 3-level directory with mode', (done) => {
      const path = join(testFsPath, 'dev1', '.sloth-storage', 'c', 'cc', 'ccc');
      const mode = 0o775;

      mergedFs._mkdirRecursive(path, mode, (err) => {
        expect(err).to.not.be.ok();
        try {
          const stat = fs.statSync(path);
          expect(stat.isDirectory()).to.be(true);
          expect(stat.mode.toString(8)).to.contain((mode & ~process.umask()).toString(8));
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it('should return EEXIST error for an existing path', (done) => {
      const path = join(testFsPath, 'dev1');

      mergedFs._mkdirRecursive(path, (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', CODES.EEXIST);
        done();
      });
    });

    it('should return error if failed to create new directory', (done) => {
      const path = join(testFsPath, 'dev1', '.sloth-storage', 'd', 'dd', 'ddd');

      const enoentError = new Error();
      enoentError.code = 'ENOENT';

      const internalError = new Error();
      internalError.code = 'lol-code';

      const mockFs = require('fs'); //eslint-disable-line global-require
      simple
        .mock(mockFs, 'mkdir')
        .callbackWith(enoentError)
        .callbackWith(internalError);

      const localMergedFs = new MergedFs({devicesManager, fs: mockFs});
      localMergedFs._mkdirRecursive(path, (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', internalError.code);
        simple.restore();
        done();
      });
    });
  });

  describe('#_mkdirRecursiveSync()', () => {
    it('should create 1-level directory', () => {
      const path = join(testFsPath, 'dev1', '.sloth-storage', 'a');

      mergedFs._mkdirRecursiveSync(path);

      const stat = fs.statSync(path);
      expect(stat.isDirectory()).to.be(true);
      expect(stat.mode.toString(8)).to.contain(defaultMode);
    });

    it('should create 2-level directory', () => {
      const path = join(testFsPath, 'dev1', '.sloth-storage', 'b', 'bb');

      mergedFs._mkdirRecursiveSync(path);

      const stat = fs.statSync(path);
      expect(stat.isDirectory()).to.be(true);
      expect(stat.mode.toString(8)).to.contain(defaultMode);
    });

    it('should create 3-level directory with mode', () => {
      const path = join(testFsPath, 'dev1', '.sloth-storage', 'c', 'cc', 'ccc');
      const mode = 0o775;

      mergedFs._mkdirRecursiveSync(path, mode);

      const stat = fs.statSync(path);
      expect(stat.isDirectory()).to.be(true);
      expect(stat.mode.toString(8)).to.contain((mode & ~process.umask()).toString(8));
    });

    it('should throw EEXIST error for an existing path', (done) => {
      const path = join(testFsPath, 'dev1');

      try {
        mergedFs._mkdirRecursiveSync(path);
        done('Exception was not thrown');
      } catch (e) {
        expect(e).to.be.an(Error);
        expect(e).to.have.property('code', CODES.EEXIST);
        done();
      }
    });

    it('should throw error if failed to create new directory', (done) => {
      const path = join(testFsPath, 'dev1', '.sloth-storage', 'd', 'dd', 'ddd');

      const enoentError = new Error();
      enoentError.code = 'ENOENT';

      const internalError = new Error();
      internalError.code = 'lol-code';

      const mockFs = require('fs'); //eslint-disable-line global-require
      simple
        .mock(mockFs, 'mkdirSync')
        .throwWith(enoentError)
        .throwWith(internalError);

      const localMergedFs = new MergedFs({devicesManager, fs: mockFs});
      try {
        localMergedFs._mkdirRecursiveSync(path);
        simple.restore();
        done('Exception was not thrown');
      } catch (e) {
        expect(e).to.be.an(Error);
        expect(e).to.have.property('code', internalError.code);
        simple.restore();
        done();
      }
    });
  });

  describe('#mkdir()', () => {
    it('should create new directory in the storage directory on any device', (done) => {
      const dir = 'dir-new-1';
      const devices = devicesManager.getDevices();

      mergedFs.mkdir(dir, (errMkdir) => {
        if (errMkdir) {
          return done(errMkdir);
        }

        async.detect(
          devices,
          (dev, callback) => fs.stat(join(dev, dir), (err, stat) => callback(null, !err && stat.isDirectory())),
          (err, result) => {
            if (err) {
              return done(err);
            }
            return done(result ? null : `New directory was not found on any device: ${dir}`);
          }
        );
      });
    });

    it('should create new directory in the storage directory on any device (2-level)', (done) => {
      const dir = 'dir-new-2';
      const subDir = 'dir1';
      const devices = devicesManager.getDevices();

      mergedFs.mkdir(join(subDir, dir), (errMkdir) => {
        if (errMkdir) {
          return done(errMkdir);
        }

        async.detect(
          devices,
          (dev, callback) => fs.stat(join(dev, subDir, dir), (err, stat) => callback(null, !err && stat.isDirectory())),
          (err, result) => {
            if (err) {
              return done(err);
            }
            return done(result ? null : `New directory was not found on any device: ${join(subDir, dir)}`);
          }
        );
      });
    });

    it('should create new directory with specified mode in the storage directory on any device', (done) => {
      const mode = 0o775;
      const dir = 'dir-new-3';
      const devices = devicesManager.getDevices();

      mergedFs.mkdir(dir, mode, (errMkdir) => {
        if (errMkdir) {
          return done(errMkdir);
        }

        async.detect(
          devices,
          (dev, callback) => fs.stat(join(dev, dir), (err, stat) => callback(null, !err && stat.isDirectory())),
          (err, result) => {
            if (err) {
              return done(err);
            } else if (result) {
              const stat = fs.statSync(join(result, dir));
              expect(stat.mode.toString(8)).to.contain((mode & ~process.umask()).toString(8));
              return done();
            }

            return done(`New directory was not found on any device: ${dir}`);
          }
        );
      });
    });

    it("should return ENOENT if parent of second level directory doesn't exist", (done) => {
      mergedFs.mkdir(join('dir-not-exist', 'dir-new-4'), (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', CODES.ENOENT);
        done();
      });
    });

    it('should return an error if there is no device for write', (done) => {
      const internalError = new Error();
      internalError.code = 'lol-error';
      simple.mock(devicesManager, 'getDeviceForWrite').callbackWith(internalError);
      mergedFs.mkdir('dir-new', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', internalError.code);
        simple.restore();
        done();
      });
    });

    it('should return an error if error happened during creating recursive repository', (done) => {
      const internalError = new Error();
      internalError.code = 'lol-error';

      simple.mock(mergedFs, '_mkdirRecursive').callbackWith(internalError);

      mergedFs.mkdir('dir-new', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', internalError.code);
        simple.restore();
        done();
      });
    });

    it('should return EEXIST if directory already exist', (done) => {
      mergedFs.mkdir('dir1', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', CODES.EEXIST);
        done();
      });
    });
  });

  describe('#readdir()', () => {
    it('should return list of files in directory', (done) => {
      mergedFs.readdir('', (err, res) => {
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
      mergedFs.readdir('dir1', (err, res) => {
        expect(res).to.be.an('array');
        expect(res).to.have.length(1);
        expect(res).to.contain('file1-1.txt');
        done(err);
      });
    });

    it('should return ENOENT error for non-existing directory', (done) => {
      mergedFs.readdir('dir-not-exist', (err, res) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', CODES.ENOENT);
        expect(res).to.be(undefined);
        done();
      });
    });

    it('should return list of files in directory with leading "/"', (done) => {
      mergedFs.readdir('dir1', (err, res) => {
        expect(res).to.be.an('array');
        expect(res).to.have.length(1);
        expect(res).to.contain('file1-1.txt');
        done(err);
      });
    });

    it('should return ENOENT for non-existing path', (done) => {
      mergedFs.readdir('/path-not-exist', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', CODES.ENOENT);
        done();
      });
    });
  });

  describe('#rename()', () => {
    it('should rename an existing directory to non-existing directory', (done) => {
      const oldName = 'dir3';
      const newName = 'dir3-new';

      mergedFs.rename(oldName, newName, (err) => {
        expect(err).to.not.be.ok();
        if (err) {
          return done(err);
        }

        mergedFs.readdir('', (errReaddir, res) => {
          expect(res).to.be.an('array');
          expect(res).to.contain(newName);
          expect(res).to.not.contain(oldName);
          done(errReaddir);
        });
      });
    });

    it('should rename an existing file to non-existing file', (done) => {
      const oldDir = 'dir1';
      const oldName = 'file1-1.txt';
      const newName = 'file1-1-new.txt';

      mergedFs.rename(join(oldDir, oldName), join(oldDir, newName), (err) => {
        expect(err).to.not.be.ok();
        if (err) {
          return done(err);
        }

        mergedFs.readdir(oldDir, (errReaddir, res) => {
          expect(res).to.be.an('array');
          expect(res).to.contain(newName);
          expect(res).to.not.contain(oldName);
          done(errReaddir);
        });
      });
    });

    it('should rename an existing file to existing file', (done) => {
      const oldName = 'file1.txt';
      const newName = 'file2.txt';

      mergedFs.rename(oldName, newName, (err) => {
        expect(err).to.not.be.ok();
        if (err) {
          return done(err);
        }

        mergedFs.readdir('', (errReaddir, res) => {
          expect(res).to.be.an('array');
          expect(res).to.contain(newName);
          expect(res).to.not.contain(oldName);
          done(errReaddir);
        });
      });
    });

    it('should return an error if all renames failed', (done) => {
      const enoentError = new Error();
      enoentError.code = CODES.ENOENT;
      const mockFs = require('fs'); //eslint-disable-line global-require
      simple.mock(mockFs, 'rename').callbackWith(enoentError);
      const localMergedFs = new MergedFs({devicesManager, fs: mockFs});

      localMergedFs.rename('dir3', 'dir3-new', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', CODES.ENOENT);
        expect(err).to.have.property('message');
        expect(err.message).to.contain('->');
        simple.restore();
        done();
      });
    });

    it('should return ENOTEMPTY error if new directory path not empty', (done) => {
      mergedFs.rename('dir1', 'dir2', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', CODES.ENOTEMPTY);
        done();
      });
    });

    it('should return ENOENT error for non-existing path', (done) => {
      mergedFs.rename('dir-not-exist', 'dir-not-exist-new', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', CODES.ENOENT);
        done();
      });
    });

    it('should return ENOENT for out of scope path', (done) => {
      mergedFs.rename('/path-out-of-scope', '/path-out-of-scope-new', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', CODES.ENOENT);
        done();
      });
    });
  });

  describe('#rmdir()', () => {
    it('should remove existing directory', (done) => {
      mergedFs.rmdir('dir2', (err) => {
        expect(err).to.be(null);
        done();
      });
    });

    it('should return error for non-existing directory', (done) => {
      mergedFs.rmdir('dir-not-exist', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', CODES.ENOENT);
        done();
      });
    });

    it('should return ENOENT for out of scope path', (done) => {
      mergedFs.rmdir('/path-out-of-scope', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', CODES.ENOENT);
        done();
      });
    });
  });

  describe('#exists()', () => {
    // this method is deprecated in node v8
    it('should return TRUE for existing file', (done) => {
      mergedFs.exists('file1.txt', (res) => {
        expect(res).to.be.an('boolean');
        expect(res).to.be(true);
        done();
      });
    });

    it('should return FALSE for not existing file', (done) => {
      mergedFs.exists('file-not-exist.txt', (res) => {
        expect(res).to.be.an('boolean');
        expect(res).to.be(false);
        done();
      });
    });
  });

  describe('#stat()', () => {
    it('should return stat for file', (done) => {
      mergedFs.stat('file1.txt', (err, res) => {
        expect(res).to.be.an('object');
        expect(res).to.have.key('atime');
        done(err);
      });
    });

    it('should return error for non-existion file', (done) => {
      mergedFs.stat('file-not-exist.txt', (err, res) => {
        expect(res).to.be(undefined);
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', CODES.ENOENT);
        done();
      });
    });
  });

  describe('#statSync()', () => {
    it('should return stat for file', (done) => {
      try {
        const stat = mergedFs.statSync('file1.txt');
        expect(stat).to.be.an('object');
        expect(stat).to.have.key('atime');
        done();
      } catch (e) {
        done(e);
      }
    });

    it('should return error for non-existion file', (done) => {
      try {
        mergedFs.statSync('file-not-exist.txt');
        done('did not throw an exception');
      } catch (e) {
        expect(e).to.be.an(Error);
        expect(e).to.have.property('code', CODES.ENOENT);
        done();
      }
    });
  });

  describe('#lstat()', () => {
    it('should return lstat for file', (done) => {
      mergedFs.lstat('file2.txt', (err, res) => {
        expect(res).to.be.an('object');
        expect(res).to.have.key('atime');
        done(err);
      });
    });

    it('should return lstat for link', (done) => {
      mergedFs.lstat(join('dir3', 'link-file2.txt'), (err, res) => {
        expect(res).to.be.an('object');
        expect(res).to.have.key('atime');
        done(err);
      });
    });

    it('should return error for non-existion file', (done) => {
      mergedFs.lstat('file-not-exist.txt', (err, res) => {
        expect(res).to.be(undefined);
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', CODES.ENOENT);
        done();
      });
    });
  });

  describe('#readFile()', () => {
    it('should read existing file', (done) => {
      mergedFs.readFile('file2.txt', (err, data) => {
        expect(err).to.be(null);
        expect(data).to.be.a(Buffer);
        expect(data.toString()).to.be('content\n');
        done(err);
      });
    });

    it('should support enconding parameter', (done) => {
      mergedFs.readFile('file2.txt', 'utf8', (err, data) => {
        expect(err).to.be(null);
        expect(data).to.be('content\n');
        done(err);
      });
    });

    it('should return ENOENT error for non-existing file', (done) => {
      mergedFs.readFile('file-not-exist.txt', (err, data) => {
        expect(data).to.be(undefined);
        expect(err).to.be.a(Error);
        expect(err).to.have.property('code', CODES.ENOENT);
        done();
      });
    });

    it('should return ENOENT for out of scope path', (done) => {
      mergedFs.readFile('/path-out-of-scope', (err, data) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', CODES.ENOENT);
        expect(data).to.be(undefined);
        done();
      });
    });
  });

  describe('#unlink()', () => {
    it('should remove existing file', (done) => {
      const filePath = 'file2.txt';
      mergedFs.unlink(filePath, (errUnlink) => {
        expect(errUnlink).to.be(null);
        mergedFs.readFile(filePath, (errRead) => {
          expect(errRead).to.be.a(Error);
          expect(errRead).to.have.property('code', CODES.ENOENT);
          done();
        });
      });
    });

    it('should return ENOENT error for non-existing file', (done) => {
      const filePath = 'file-not-exist.txt';
      mergedFs.unlink(filePath, (err, res) => {
        expect(err).to.be.a(Error);
        expect(err).to.have.property('code', CODES.ENOENT);
        expect(res).to.be(undefined);
        done();
      });
    });

    it('should return ENOENT for out of scope path', (done) => {
      mergedFs.unlink('/path-out-of-scope', (err, res) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', CODES.ENOENT);
        expect(res).to.be(undefined);
        done();
      });
    });
  });

  describe('#writeFile()', () => {
    it('should write file to the root', (done) => {
      const content = 'content';
      const newFilePath = 'new-file.txt';

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
      const newFilePath = 'new-file.txt';

      mergedFs.writeFile(newFilePath, content, (err) => {
        expect(err).to.not.be.ok();
        done(err);
      });
    });

    it('should write file to the directory', (done) => {
      const content = 'content';
      const newFilePath = join('dir1', 'new-file.txt');

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
      const newFilePath = join('file1.txt', 'new-file.txt');

      mergedFs.writeFile(newFilePath, '', 'utf8', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', 'EISFILE');
        done();
      });
    });

    it('should return ENOENT error for non-existing directory', (done) => {
      const newFilePath = join('dir-non-existing', 'new-file.txt');

      mergedFs.writeFile(newFilePath, '', 'utf8', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', CODES.ENOENT);
        done();
      });
    });

    it('should return ENOENT error for non-existing sub-directories', (done) => {
      const newFilePath = join('dir-non-existing', 'dir-non-existing', 'new-file.txt');

      mergedFs.writeFile(newFilePath, '', 'utf8', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', CODES.ENOENT);
        done();
      });
    });

    it('should return EEXIST error if file alredy exist', (done) => {
      mergedFs.writeFile('file1.txt', '', 'utf8', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', CODES.EEXIST);
        done();
      });
    });

    it('should return an error if there are no devices', (done) => {
      const internalError = new Error();
      internalError.code = 'lol-error';
      simple.mock(devicesManager, 'getDeviceForWrite').callbackWith(internalError);

      mergedFs.writeFile('new-file-2.txt', '', 'utf8', (err) => {
        expect(err).to.be.a(Error);
        expect(err.code).to.be(internalError.code);
        done();
      });
    });

    it('should return an error if error happened during creating recursive repository', (done) => {
      const internalError = new Error();
      internalError.code = 'lol-error';
      simple.mock(mergedFs, '_mkdirRecursive').callbackWith(internalError);

      mergedFs.writeFile('new-file-2.txt', '', 'utf8', (err) => {
        expect(err).to.be.an(Error);
        expect(err).to.have.property('code', internalError.code);
        simple.restore();
        done();
      });
    });

    it('should emit "fileUpdated" event', (done) => {
      const content = 'content';
      const newFilePath = 'new-file-3.txt';

      mergedFs.on(MergedFs.EVENTS.FILE_UPDATED, (device, path) => {
        expect(device).to.contain(storageDirName);
        expect(path).to.be(newFilePath);
        done();
      });

      mergedFs.writeFile(newFilePath, content, 'utf8', (errWrite) => {
        expect(errWrite).to.not.be.ok();
      });
    });
  });

  describe('#createReadStream()', () => {
    it('should read existing file', (done) => {
      let stream;

      try {
        stream = mergedFs.createReadStream('file2.txt');
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
        const stream = mergedFs.createReadStream('file2.txt', {encoding: 'utf8'});
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
        .withArgs('file-not-exist.txt')
        .to.throwException((err) => {
          expect(err).to.be.a(Error);
          expect(err).to.have.property('code', CODES.ENOENT);
          done();
        });
    });

    it('should return ENOENT error for empty path', (done) => {
      expect(mergedFs.createReadStream.bind(mergedFs))
        .withArgs('')
        .to.throwException((err) => {
          expect(err).to.be.a(Error);
          expect(err).to.have.property('code', CODES.ENOENT);
          done();
        });
    });
  });

  describe('#createWriteStream()', () => {
    it('should create write stream to the root', (done) => {
      const content = 'content';
      const newFilePath = 'new-file.txt';

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

    it('should emit an FILE_UPDATED event after writing', (done) => {
      const newFilePath = 'new-file.txt';

      try {
        const stream = mergedFs.createWriteStream(newFilePath, {defaultEncoding: 'utf8'});
        mergedFs.on(MergedFs.EVENTS.FILE_UPDATED, (device, path) => {
          expect(device).to.contain(storageDirName);
          expect(path).to.be(newFilePath);
          done();
        });
        stream.end('');
        //stream.on('finish', () => {
        //  mergedFs.readFile(newFilePath, 'utf8', (err, data) => {
        //    expect(err).to.not.be.ok();
        //    expect(data).to.be.a('string');
        //    expect(data).to.be(content);
        //    done(err);
        //  });
        //});
      } catch (e) {
        return done(`createWriteStream() should not throw an exception: ${e}`);
      }
    });

    it('should work w/o encoding parameter', (done) => {
      const content = 'content';
      const newFilePath = 'new-file-1.txt';

      try {
        const stream = mergedFs.createWriteStream(newFilePath);
        stream.end(Buffer.from(content));
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

    it('should create write stream to the file in sub-directory', (done) => {
      const content = 'content';
      const newFilePath = join('dir2', 'new-file-in-directory.txt');

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

    it('should return EISFILE if destination contains a file in the path', (done) => {
      expect(mergedFs.createWriteStream.bind(mergedFs))
        .withArgs(join('file2.txt', 'file-not-exist.txt'))
        .to.throwException((err) => {
          expect(err).to.be.a(Error);
          expect(err).to.have.property('code', 'EISFILE');
          done();
        });
    });

    it('should return ENOENT error for non-existing directory', (done) => {
      expect(mergedFs.createWriteStream.bind(mergedFs))
        .withArgs(join('dir-not-exist', 'file-not-exist.txt'))
        .to.throwException((err) => {
          expect(err).to.be.a(Error);
          expect(err).to.have.property('code', CODES.ENOENT);
          done();
        });
    });

    it('should return ENOENT error for non-existing sub-directories', (done) => {
      expect(mergedFs.createWriteStream.bind(mergedFs))
        .withArgs(join('dir-not-exist', 'dir-not-exist', 'file-not-exist.txt'))
        .to.throwException((err) => {
          expect(err).to.be.a(Error);
          expect(err).to.have.property('code', CODES.ENOENT);
          done();
        });
    });

    it('should return ENOENT error for empty path', (done) => {
      expect(mergedFs.createWriteStream.bind(mergedFs))
        .withArgs('')
        .to.throwException((err) => {
          expect(err).to.be.a(Error);
          expect(err).to.have.property('code', CODES.ENOENT);
          done();
        });
    });

    it('should return EEXITS error if file already exist', (done) => {
      expect(mergedFs.createWriteStream.bind(mergedFs))
        .withArgs('file1.txt')
        .to.throwException((err) => {
          expect(err).to.be.a(Error);
          expect(err).to.have.property('code', CODES.EEXIST);
          done();
        });
    });

    it('should throw an error if no devices for write', () => {
      const internalError = new Error();
      internalError.code = 'lol-error';
      simple.mock(devicesManager, 'getDeviceForWriteSync').throwWith(internalError);

      expect(mergedFs.createWriteStream.bind(mergedFs))
        .withArgs('new-file-2.txt')
        .to.throwException((err) => {
          expect(err).to.be.a(Error);
          expect(err.code).to.be(internalError.code);
        });
    });

    it('should throw an error if faild to create recursive directories on device', () => {
      const internalError = new Error();
      internalError.code = 'lol-error';
      simple.mock(mergedFs, '_mkdirRecursiveSync').throwWith(internalError);

      expect(mergedFs.createWriteStream.bind(mergedFs))
        .withArgs('new-file-3.txt')
        .to.throwException((err) => {
          expect(err).to.be.a(Error);
          expect(err.code).to.be(internalError.code);
        });
    });
  });
});
