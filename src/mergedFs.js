const defaultNodeFs = require('fs');
const {join, dirname} = require('path');
const async = require('async');

const {CODES, createError, createNotExistError} = require('./errorHelpers');

class MergedFs {
  constructor({devicesManager, fs = defaultNodeFs} = {}) {
    if (!devicesManager) {
      throw new Error('No "devicesManager" parameter');
    }

    this.devicesManager = devicesManager;
    this.fs = fs;
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

    let stat;
    async.detectSeries(
      this.devicesManager.getDevices(), // TODO implement random access to devices
      (dev, done) => this.fs.stat(
        join(dev, relativePath),
        (err, devStat) => {
          if (err) {
            return done(null, false);
          }
          stat = devStat;
          return done(null, true);
        }
      ),
      (err, dev) => {
        if (!err && typeof dev === 'undefined') {
          return callback(createNotExistError(`Failed to resolve path "${relativePath}"`));
        }
        callback(err, join(dev, relativePath), stat);
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
        this.fs.accessSync(devPath);
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

    this.fs.mkdir(path, mode, (err) => {
      if (err && err.code === CODES.ENOENT) {
        return this._mkdirRecursive(dirname(path), mode, (subErr) => {
          if (subErr) {
            return callback(subErr);
          }
          this._mkdirRecursive(path, mode, callback);
        });
      }

      return callback(err);
    });
  }

  _mkdirRecursiveSync(path, mode) {
    try {
      return this.fs.mkdirSync(path, mode);
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
        this.fs.stat(resolvedPath, callback);
      }
    );
  }

  statSync(path) {
    return this.fs.statSync(this._resolvePathSync(path));
  }

  lstat(path, callback) {
    return this._resolvePath(
      path,
      (err, resolvedPath) => {
        if (err) {
          return callback(err);
        }
        this.fs.lstat(resolvedPath, callback);
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
      (item, done) => this.fs.readdir(
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

  rename(oldPath, newPath, callback) {
    async.waterfall([
      done => this._resolvePath(oldPath, oldPathErr => done(oldPathErr)),
      done => this._resolvePath(newPath, (newPathErr, newResolverPath, newStat) => {
        if (!newPathErr && newStat.isDirectory()) { // path exists
          return done(createError('Rename destination already exist', CODES.ENOTEMPTY));
        }
        return done();
      }),
      done => process.nextTick(() => {
        try {
          return done(null, this._getRelativePath(oldPath), this._getRelativePath(newPath));
        } catch (e) {
          return done(e);
        }
      }),
      (oldRelativePath, newRelativePath, done) => {
        let isRenamed = false;
        async.each(
          this.devicesManager.getDevices(),
          (dev, eachRenameDone) => this.fs.rename(
            join(dev, oldRelativePath),
            join(dev, newRelativePath),
            (renameErr) => {
              if (renameErr && renameErr.code === CODES.ENOENT) {
                return eachRenameDone(null);
              } else if (!renameErr) {
                isRenamed = true;
              }
              return eachRenameDone(renameErr);
            }
          ),
          (renameErr) => {
            if (!isRenamed) {
              return done(createNotExistError(`Cannot rename path: "${oldRelativePath}" -> "${newRelativePath}"`));
            }
            return done(renameErr);
          }
        );
      }
    ], err => callback(err));
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
      (item, done) => this.fs.rmdir(
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
      this.devicesManager.getDevices().map(dev => (done => this.fs.readFile(join(dev, relativePath), options, done))),
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
      (item, done) => this.fs.unlink(
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

            return this.fs.writeFile(resolvedPath, data, options, callback);
          });
        });
      });
    });
  }

  createReadStream(path, options) {
    let resolvedPath;

    try {
      resolvedPath = this._resolvePathSync(path);
      return this.fs.createReadStream(resolvedPath, options);
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

    return this.fs.createWriteStream(resolvedPath, options);
  }
}

module.exports = MergedFs;
