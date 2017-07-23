const fs = require('fs');
const {join, dirname} = require('path');
const async = require('async');

class MergedFs {
  constructor(devicesManager) {
    if (!devicesManager) {
      throw new Error('No "devicesManager" parameter');
    }

    this.devicesManager = devicesManager;
  }

  _createNotExistError(message) {
    const err = new Error(`${message}: file/directory not exist`);
    err.code = 'ENOENT';
    return err;
  }

  _getRelativePath(ftpPath) {
    return ftpPath.replace(this.devicesManager.getDevicesPath(), '');
  }

  _resolvePath(ftpPath, callback) {
    const relativePath = this._getRelativePath(ftpPath);
    //console.log(`-- resolvePath: "${ftpPath}", relative: "${relativePath}"`);

    if (!relativePath) {
      return process.nextTick(() => callback(new Error(`Empty relative path parsed from: ${relativePath}`)));
    }

    async.detect(
      this.devicesManager.getDevices(),
      (dev, done) => fs.access(join(dev, relativePath), (err) => done(null, !err)),
      (err, resolvedPath) => {
        if (!err && typeof resolvedPath === 'undefined') {
          err = this._createNotExistError(`Failed to resolve path "${relativePath}"`);
        }
        callback(err, resolvedPath);
      }
    );
  }

  //createReadStream() {
  //  console.log('-- createReadStream', arguments);
  //  throw new Error('Unimplemented');
  //}
  //
  //createWriteStream(filename) {
  //  console.log('-- createWriteStream', arguments);
  //  throw new Error('Unimplemented');
  //}

  exists(path, callback) {
    this._resolvePath(path, (err, resolvedPath) => process.nextTick(() => callback(Boolean(resolvedPath))));
  }

  stat(path, callback) {
    this._resolvePath(path, (err, resolvedPath) => {
      if (err) {
        return process.nextTick(() => callback(err));
      }
      fs.stat(resolvedPath, callback);
    });
  }

  //lstat(relativePath, callback) {
  //  console.log('-- lstat', arguments);
  //  this.stat(relativePath, callback);
  //}

  mkdir(path, ...callbacks) {
    const callback = callbacks.slice(-1)[0];
    const relativePath = this._getRelativePath(path);

    const mkdirRecursive = (p, done, initialP) => {
      initialP = (initialP || p);
      fs.mkdir(p, (err) => {
        if (err && err.code === 'ENOENT') {
          mkdirRecursive(dirname(p), done, initialP);
        } else {
          if (p !== initialP) {
            mkdirRecursive(initialP, done, initialP); //ugly
          } else {
            done(err);
          }
        }
      });
    };

    async.each(
      this.devicesManager.getDevices(),
      (dev, done) => mkdirRecursive(join(dev, relativePath), done),
      callback
    );
  }

  readdir(path, callback) {
    const relativePath = this._getRelativePath(path);
    let isExist = false;

    async.concat(
      this.devicesManager.getDevices().map(d => join(d, relativePath)),
      (item, done) => fs.readdir(
        item,
        (err, res) => {
          if (err && err.code === 'ENOENT') {
            return done(null, []);
          }
          isExist = true;
          return done(err, res);
        }
      ),
      (err, contents) => {
        if (!isExist) {
          return callback(this._createNotExistError(`Cannot read directory: "${relativePath}"`));
        }
        return callback(err, [...new Set(contents)]);
      }
    );
  }

  rmdir(path, callback) {
    const relativePath = this._getRelativePath(path);

    async.each(
      this.devicesManager.getDevices().map(d => join(d, relativePath)),
      (item, done) => fs.rmdir(item, (err) => done(err && err.code === 'ENOENT' ? null : err)),
      callback
    );
  }

  readFile(path, config, callback) {
    if (!callback) {
      callback = config;
      config = {};
    }

    const relativePath = this._getRelativePath(path);

    async.tryEach(
      this.devicesManager.getDevices().map(dev => (done) => fs.readFile(join(dev, relativePath), config, done)),
      callback
    );
  }

  unlink(path, callback) {
    const relativePath = this._getRelativePath(path);
    let isExist = false;

    async.each(
      this.devicesManager.getDevices().map(dev => join(dev, relativePath)),
      (item, done) => fs.unlink(
        item,
        (err) => {
          if (err && err.code === 'ENOENT') {
            return done(null);
          }
          isExist = true;
          return done(err);
        }
      ),
      (err) => {
        if (!isExist) {
          return callback(this._createNotExistError(`Cannot remove file: "${relativePath}"`));
        }
        return callback(err);
      }
    );
  }

  //writeFile(relativePath, data, ...callbacks) {
  //  console.log('-- writeFile', arguments);
  //  callbacks.slice(-1)[0](new Error('Unimplemented'));
  //}
}

module.exports = MergedFs;