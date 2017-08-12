const fs = require('fs');
const {join, dirname} = require('path');
const async = require('async');

const {CODES, createError, createNotExistError} = require('./errorHelpers');

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
      throw createNotExistError(`Cannot resolve path "${path}", it is out of device directories`);
    }

    return (relativePath || '/');
  }

  //TODO return stat
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
          return callback(createNotExistError(`Failed to resolve path "${relativePath}"`));
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
      throw createNotExistError(`Empty relative path parsed from: ${path}`);
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
      throw createNotExistError(`Failed to resolve path "${relativePath}"`);
    }

    return resolvedPath;
  }

  _mkdirRecursive(path, mode, callback) {
    if (!callback) {
      callback = mode;
      mode = 0o777;
    }

    fs.mkdir(path, mode, (err) => {
      if (err && err.code === CODES.ENOENT) {
        this._mkdirRecursive(dirname(path), mode, (subErr) => {
          if (subErr) {
            return callback(subErr);
          }
          this._mkdirRecursive(path, mode, callback);
        });
      } else {
        callback(err);
      }
    });
  }

  _mkdirRecursiveSync(path, mode) {
    try {
      return fs.mkdirSync(path, mode);
    } catch (e) {
      if (e.code === CODES.ENOENT) {
        this._mkdirRecursiveSync(dirname(path), mode);
        return this._mkdirRecursiveSync(path, mode);
      }
      throw e;
    }
  }

  exists(path, callback) {
    return this._resolvePath(
      path,
      (err, resolvedPath) => callback(Boolean(resolvedPath))
    );
  }

  stat(path, callback) {
    return this._resolvePath(
      path,
      (err, resolvedPath) => {
        if (err) {
          return callback(err);
        }
        fs.stat(resolvedPath, callback);
      }
    );
  }

  statSync(path) {
    return fs.statSync(this._resolvePathSync(path));
  }

  lstat(path, callback) {
    return this._resolvePath(
      path,
      (err, resolvedPath) => {
        if (err) {
          return callback(err);
        }
        fs.lstat(resolvedPath, callback);
      }
    );
  }

  mkdir(path, mode, callback) {
    if (!callback) {
      callback = mode;
      mode = 0o777;
    }

    let relativePath;
    try {
      relativePath = this._getRelativePath(path);
    } catch (e) {
      return process.nextTick(() => callback(e));
    }

    this._resolvePath(path, (err, resolvedPath) => {
      if (!err) {
        return callback(createError(`Directory already exist: ${resolvedPath}`, CODES.EEXIST));
      }

      this._resolvePath(dirname(path), (parentErr) => {
        if (parentErr) {
          return callback(parentErr);
        }

        this.devicesManager.getDeviceForWrite((devErr, device) => {
          if (devErr) {
            return callback(devErr);
          }

          this._mkdirRecursive(join(device, relativePath), mode, (mkdirErr) => {
            if (mkdirErr) {
              return callback(mkdirErr);
            }
            return callback();
          });
        });
      });
    });
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
          if (err && err.code === CODES.ENOENT) {
            return done(null, []);
          }
          isExist = true;
          return done(err, res);
        }
      ),
      (err, contents) => {
        if (!isExist) {
          return callback(createNotExistError(`Cannot read directory: "${relativePath}"`));
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
          if (err && err.code === CODES.ENOENT) {
            return done(null);
          }
          isExist = true;
          return done(err);
        }
      ),
      (err) => {
        if (!isExist) {
          return callback(createNotExistError(`Cannot read directory: "${relativePath}"`));
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
          if (err && err.code === CODES.ENOENT) {
            return done(null);
          }
          isExist = true;
          return done(err);
        }
      ),
      (err) => {
        if (!isExist) {
          return callback(createNotExistError(`Cannot remove file: "${relativePath}"`));
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

    let relativePath;
    try {
      relativePath = this._getRelativePath(path);
    } catch (e) {
      return process.nextTick(() => callback(e));
    }

    this.devicesManager.getDeviceForWrite((deviceErr, device) => {
      if (deviceErr) {
        return callback(deviceErr);
      }

      const resolvedPath = join(device, relativePath);
      this.stat(path, (err) => {
        if (!err) {
          return callback(createError(`File already exist: ${relativePath}`, CODES.EEXIST));
        }

        this.stat(dirname(path), (dirErr, dirStat) => {
          if (dirErr) {
            return callback(dirErr);
          } else if (!dirStat.isDirectory()) {
            return callback(
              createError(`Failed to resolve path "${relativePath}": path contains a file in the middle`, CODES.EISFILE)
            );
          }


          this._mkdirRecursive(dirname(resolvedPath), (mkdirErr) => {
            if (mkdirErr && mkdirErr.code !== CODES.EEXIST) { // probably this device already contain this directory
              return callback(mkdirErr);
            }

            return fs.writeFile(resolvedPath, data, options, callback);
          });
        });
      });
    });
  }

  createReadStream(path, options) {
    let resolvedPath;

    try {
      resolvedPath = this._resolvePathSync(path);
      return fs.createReadStream(resolvedPath, options);
    } catch (e) {
      throw createNotExistError(`Failed to create read stream for "${resolvedPath || path}": ${e}`);
    }
  }

  createWriteStream(path, options) {
    const relativePath = this._getRelativePath(path);
    const device = this.devicesManager.getDeviceForWriteSync();
    const resolvedPath = join(device, relativePath);

    let stat;
    try {
      stat = this.statSync(path);
    } catch (e) {
      // file doesn't exist
    }

    if (stat) {
      throw createError(`File already exist: ${relativePath}`, CODES.EEXIST);
    }

    const dirStat = this.statSync(dirname(path));
    if (!dirStat.isDirectory()) {
      throw createError(`Failed to resolve path "${relativePath}": path contains a file in the middle`, CODES.EISFILE);
    }

    try {
      this._mkdirRecursiveSync(dirname(resolvedPath));
    } catch (e) {
      if (e.code !== CODES.EEXIST) { // probably this device already contain this directory
        throw e;
      }
    }

    return fs.createWriteStream(resolvedPath, options);
  }
}

module.exports = MergedFs;
