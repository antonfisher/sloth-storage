const fs = require('fs');
const {join, dirname, basename} = require('path');
const async = require('async');

const EEXIST = 'EEXIST';
const ENOENT = 'ENOENT';
const EISFILE = 'EISFILE';

function _createError(message, code = ENOENT) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function _createNotExistError(message) {
  return _createError(`${message}: file/directory not exist`);
}

class MergedFs {
  constructor(devicesManager) {
    if (!devicesManager) {
      throw new Error('No "devicesManager" parameter');
    }

    this.devicesManager = devicesManager;
  }

  _getRelativePath(path) {
    path = String(path);

    const relativePath = path.replace(this.devicesManager.getDevicesPath(), '');

    if (relativePath === path) {
      throw _createNotExistError(`Cannot resolve path "${path}", it is out of device directories`);
    }

    return (relativePath || '/');
  }

  _resolvePath(path, callback) {
    let relativePath;
    try {
      relativePath = this._getRelativePath(path);
    } catch (e) {
      return process.nextTick(() => callback(e));
    }

    // TODO implement random access to devices
    async.detect(
      this.devicesManager.getDevices(),
      (dev, done) => fs.access(
        join(dev, relativePath),
        (err => done(null, !err))
      ),
      (err, dev) => {
        if (!err && typeof dev === 'undefined') {
          return callback(_createNotExistError(`Failed to resolve path "${relativePath}"`));
        }
        callback(err, join(dev, relativePath));
      }
    );
  }

  _resolvePathSync(path) {
    let relativePath;
    try {
      relativePath = this._getRelativePath(path);
    } catch (e) {
      throw _createNotExistError(`Empty relative path parsed from: ${path}`);
    }

    // TODO implement random access to devices
    const resolvedPath = this.devicesManager.getDevices().reduce((acc, dev) => {
      if (acc) {
        return acc;
      }
      const devPath = join(dev, relativePath);
      try {
        fs.accessSync(devPath);
        return devPath;
      } catch (e) {
        return null;
      }
    }, null);

    if (!resolvedPath) {
      throw _createNotExistError(`Failed to resolve path "${relativePath}"`);
    }

    return resolvedPath;
  }

  createReadStream(path, options) {
    let resolvedPath;
    try {
      resolvedPath = this._resolvePathSync(path);
    } catch (e) {
      throw _createNotExistError(`Cannot create read stream for "${path}": ${e}`);
    }

    return fs.createReadStream(resolvedPath, options);
  }

  createWriteStream(path, options) {
    const fileName = basename(path);

    let resolvedDir;
    try {
      resolvedDir = this._resolvePathSync(dirname(path));
    } catch (e) {
      throw _createNotExistError(`Cannot create read stream for "${resolvedDir}": ${e}`);
    }

    const stat = fs.statSync(resolvedDir);

    if (!stat.isDirectory()) {
      throw _createError(
        `Failed to resolve path "${resolvedDir}": path contains a file in the middle`,
        EISFILE
      );
    }

    return fs.createWriteStream(join(resolvedDir, fileName), options);
  }

  exists(path, callback) {
    return this._resolvePath(
      path,
      (err, resolvedPath) => process.nextTick(() => callback(Boolean(resolvedPath)))
    );
  }

  stat(path, callback) {
    return this._resolvePath(
      path,
      (err, resolvedPath) => {
        if (err) {
          return process.nextTick(() => callback(err));
        }
        fs.stat(resolvedPath, callback);
      }
    );
  }

  lstat(path, callback) {
    return this._resolvePath(
      path,
      (err, resolvedPath) => {
        if (err) {
          return process.nextTick(() => callback(err));
        }
        fs.lstat(resolvedPath, callback);
      }
    );
  }

  mkdir(path, ...callbacks) {
    const callback = callbacks.slice(-1)[0];

    let relativePath;
    try {
      relativePath = this._getRelativePath(path);
    } catch (e) {
      return process.nextTick(() => callback(e));
    }

    const mkdirRecursive = (p, done, initialP) => {
      initialP = (initialP || p);
      fs.mkdir(p, (err) => {
        if (err && err.code === ENOENT) {
          mkdirRecursive(dirname(p), done, initialP);
        } else if (p !== initialP) {
          mkdirRecursive(initialP, done, initialP); //ugly
        } else {
          done(err);
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
    let isExist = false;

    let relativePath;
    try {
      relativePath = this._getRelativePath(path);
    } catch (e) {
      return process.nextTick(() => callback(e));
    }

    async.concat(
      this.devicesManager.getDevices().map(d => join(d, relativePath)),
      (item, done) => fs.readdir(
        item,
        (err, res) => {
          if (err && err.code === ENOENT) {
            return done(null, []);
          }
          isExist = true;
          return done(err, res);
        }
      ),
      (err, contents) => {
        if (!isExist) {
          return callback(_createNotExistError(`Cannot read directory: "${relativePath}"`));
        }
        return callback(err, [...new Set(contents)]);
      }
    );
  }

  rmdir(path, callback) {
    let isExist = false;

    let relativePath;
    try {
      relativePath = this._getRelativePath(path);
    } catch (e) {
      return process.nextTick(() => callback(e));
    }

    async.each(
      this.devicesManager.getDevices().map(d => join(d, relativePath)),
      (item, done) => fs.rmdir(
        item,
        (err) => {
          if (err && err.code === ENOENT) {
            return done(null);
          }
          isExist = true;
          return done(err);
        }
      ),
      (err) => {
        if (!isExist) {
          return callback(_createNotExistError(`Cannot read directory: "${relativePath}"`));
        }
        return callback(err);
      }
    );
  }

  readFile(path, options, callback) {
    if (!callback) {
      callback = options;
      options = {};
    }

    let relativePath;
    try {
      relativePath = this._getRelativePath(path);
    } catch (e) {
      return process.nextTick(() => callback(e));
    }

    async.tryEach(
      this.devicesManager.getDevices().map(dev => (done => fs.readFile(join(dev, relativePath), options, done))),
      callback
    );
  }

  unlink(path, callback) {
    let isExist = false;

    let relativePath;
    try {
      relativePath = this._getRelativePath(path);
    } catch (e) {
      return process.nextTick(() => callback(e));
    }

    async.each(
      this.devicesManager.getDevices().map(dev => join(dev, relativePath)),
      (item, done) => fs.unlink(
        item,
        (err) => {
          if (err && err.code === ENOENT) {
            return done(null);
          }
          isExist = true;
          return done(err);
        }
      ),
      (err) => {
        if (!isExist) {
          return callback(_createNotExistError(`Cannot remove file: "${relativePath}"`));
        }
        return callback(err);
      }
    );
  }

  writeFile(path, data, options, callback) {
    if (!callback) {
      callback = options;
      options = {};
    }

    const dirPath = dirname(path);

    this.stat(dirPath, (errStat, stat) => {
      if (errStat) { // if not exist on any device
        return callback(errStat);
      } else if (!stat.isDirectory()) {
        return callback(
          _createError(`Failed to resolve path "${dirPath}": path contains a file in the middle`, EISFILE)
        );
      }

      this.devicesManager.getDeviceForWrite((err, device) => { // select device to write
        if (err) {
          return process.nextTick(() => callback(err));
        }

        this.mkdir(dirPath, (errMkdir) => { // make dir if it isn't exist on the selected device
          if (errMkdir && errMkdir.code !== EEXIST) {
            return callback(errMkdir);
          }

          let relativePath;
          try {
            relativePath = this._getRelativePath(path);
          } catch (e) {
            return process.nextTick(() => callback(e));
          }

          fs.writeFile(join(device, relativePath), data, options, callback);
        });
      });
    });
  }
}

module.exports = {
  MergedFs,
  _createError,
  _createNotExistError
};
