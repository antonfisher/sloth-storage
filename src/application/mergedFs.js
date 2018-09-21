const defaultNodeFs = require('fs');
const {join, dirname} = require('path');
const EventEmitter = require('events');
const async = require('async');

const {CODES, createError, createNotExistError} = require('./errorHelpers');

/**
 * @param {DeviceManager} deviceManager           DeviceManager instance
 * @param {WriteInProgressMap} writeInProgressMap WriteInProgressMap instance (RENAME)
 * @param {number}        replicationCount        the number of replications for file write
 * @param {fs}            fs                      link to nodejs fs module
 */
class MergedFs extends EventEmitter {
  constructor({devicesManager, writeInProgressMap, replicationCount, fs = defaultNodeFs} = {}) {
    super();

    if (!devicesManager) {
      throw new Error('No "devicesManager" parameter');
    }

    this.devicesManager = devicesManager;
    this.writeInProgressMap = writeInProgressMap;
    this.replicationCount = replicationCount;
    this.fs = fs;
  }

  setReplicationCount(replicationCount) {
    this.replicationCount = replicationCount;
  }

  _getRelativePath(path) {
    return String(path)
      .replace(this.devicesManager.getDevicesPath(), '')
      .replace(/^\//, '');
  }

  _resolvePath(path, callback) {
    const relativePath = this._getRelativePath(path);

    let stat;
    async.detectSeries(
      this.devicesManager.getDevices(),
      (dev, done) =>
        this.fs.stat(join(dev, relativePath), (err, devStat) => {
          if (
            err ||
            (this.writeInProgressMap && this.writeInProgressMap.isBusy(relativePath, join(dev, relativePath)))
          ) {
            return done(null, false);
          }
          stat = devStat;
          return done(null, true);
        }),
      (err, dev) => {
        if (!err && typeof dev === 'undefined') {
          return callback(createNotExistError(`Failed to resolve path "${relativePath}"`));
        }
        callback(err, join(dev, relativePath), stat);
      }
    );
  }

  _resolvePathSync(path) {
    const relativePath = this._getRelativePath(path);

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
    return this._resolvePath(path, (err, resolvedPath) => callback(Boolean(resolvedPath)));
  }

  stat(path, callback) {
    return this._resolvePath(path, (err, resolvedPath) => {
      if (err) {
        return callback(err);
      }
      this.fs.stat(resolvedPath, callback);
    });
  }

  statSync(path) {
    return this.fs.statSync(this._resolvePathSync(path));
  }

  lstat(path, callback) {
    return this._resolvePath(path, (err, resolvedPath) => {
      if (err) {
        return callback(err);
      }
      this.fs.lstat(resolvedPath, callback);
    });
  }

  mkdir(path, mode, callback) {
    if (!callback) {
      callback = mode;
      mode = 0o777;
    }

    const relativePath = this._getRelativePath(path);

    this._resolvePath(path, (err, resolvedPath) => {
      if (!err) {
        return callback(createError(`Directory already exist: ${resolvedPath}`, CODES.EEXIST));
      }

      this._resolvePath(dirname(path), (parentErr) => {
        if (parentErr) {
          return callback(parentErr);
        }

        this.devicesManager.getDeviceForWrite((devErr, devices) => {
          if (devErr) {
            return callback(devErr);
          }

          //TODO handle multiply devices
          this._mkdirRecursive(join(devices[0], relativePath), mode, (mkdirErr) => {
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
    const relativePath = this._getRelativePath(path);

    let isExist = false;
    async.concat(
      this.devicesManager.getDevices().map((d) => join(d, relativePath)),
      (item, done) =>
        this.fs.readdir(item, (err, res) => {
          if (err && err.code === CODES.ENOENT) {
            return done(null, []);
          }
          isExist = true;
          return done(err, res);
        }),
      (err, contents) => {
        if (!isExist) {
          return callback(createNotExistError(`Cannot read directory: "${relativePath}"`));
        }
        return callback(err, [...new Set(contents)]);
      }
    );
  }

  rename(oldPath, newPath, callback) {
    async.waterfall(
      [
        (done) => this._resolvePath(oldPath, (oldPathErr) => done(oldPathErr)),
        (done) =>
          this._resolvePath(newPath, (newPathErr, newResolverPath, newStat) => {
            if (!newPathErr && newStat.isDirectory()) {
              // path exists
              return done(createError('Rename destination already exist', CODES.ENOTEMPTY));
            }
            return done();
          }),
        (done) => process.nextTick(() => done(null, this._getRelativePath(oldPath), this._getRelativePath(newPath))),
        (oldRelativePath, newRelativePath, done) => {
          let isRenamed = false;
          async.each(
            this.devicesManager.getDevices(),
            (dev, eachRenameDone) =>
              this.fs.rename(join(dev, oldRelativePath), join(dev, newRelativePath), (renameErr) => {
                if (renameErr && renameErr.code === CODES.ENOENT) {
                  return eachRenameDone(null);
                }
                if (!renameErr) {
                  isRenamed = true;
                }
                return eachRenameDone(renameErr);
              }),
            (renameErr) => {
              if (!isRenamed) {
                return done(createNotExistError(`Cannot rename path: "${oldRelativePath}" -> "${newRelativePath}"`));
              }
              return done(renameErr);
            }
          );
        }
      ],
      (err) => callback(err)
    );
  }

  rmdir(path, callback) {
    const relativePath = this._getRelativePath(path);

    let isExist = false;
    async.each(
      this.devicesManager.getDevices().map((d) => join(d, relativePath)),
      (item, done) =>
        this.fs.rmdir(item, (err) => {
          if (err && err.code === CODES.ENOENT) {
            return done(null);
          }
          isExist = true;
          return done(err);
        }),
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

    const relativePath = this._getRelativePath(path);

    async.tryEach(
      this.devicesManager.getDevices().map((dev) => (done) => this.fs.readFile(join(dev, relativePath), options, done)),
      callback
    );
  }

  unlink(path, callback) {
    const relativePath = this._getRelativePath(path);

    let isExist = false;
    async.each(
      this.devicesManager.getDevices().map((dev) => join(dev, relativePath)),
      (item, done) =>
        this.fs.unlink(item, (err) => {
          if (err && err.code === CODES.ENOENT) {
            return done(null);
          }
          isExist = true;
          return done(err);
        }),
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

    const relativePath = this._getRelativePath(path);

    async.waterfall(
      [
        (done) =>
          this.stat(path, (err) => {
            if (!err) {
              return done(createError(`Cannot write file: File already exist: ${relativePath}`, CODES.EEXIST));
            }
            return done(null);
          }),
        (done) =>
          this.stat(dirname(path), (dirErr, dirStat) => {
            if (dirErr) {
              return done(dirErr);
            } else if (!dirStat.isDirectory()) {
              return done(
                createError(
                  `Cannot write file: Failed to resolve path "${relativePath}": path contains a file in the middle`,
                  CODES.EISFILE
                )
              );
            } else {
              return done(null);
            }
          }),
        (done) => this.devicesManager.getDeviceForWrite(done),
        (devices, done) => done(null, devices.slice(0, this.replicationCount).map((dev) => join(dev, relativePath))),
        (resolvedDevicePaths, done) =>
          async.each(
            resolvedDevicePaths,
            (resolvedDevicePath, itemDone) => {
              this._mkdirRecursive(dirname(resolvedDevicePath), (mkdirErr) => {
                // probably this device already contain this directory
                if (mkdirErr && mkdirErr.code !== CODES.EEXIST) {
                  return itemDone(mkdirErr);
                } else {
                  return itemDone(null);
                }
              });
            },
            (eachErr) => done(eachErr, resolvedDevicePaths)
          ),
        (resolvedDevicePaths, done) =>
          async.each(
            resolvedDevicePaths,
            (resolvedDevicePath, itemDone) =>
              this.fs.writeFile(resolvedDevicePath, data, options, (writeErr) => itemDone(writeErr)),
            done
          )
      ],
      (err) => {
        if (err) {
          return callback(err);
        }

        this.emit(MergedFs.EVENTS.FILE_UPDATED, relativePath);
        return callback(null);
      }
    );
  }

  //UNSTABLE (NOT IMPLEMENTED PROPERLY)
  createReadStream(path, options) {
    let resolvedPath;

    try {
      if (!path) {
        throw new Error('path is empty');
      }

      resolvedPath = this._resolvePathSync(path);
      return this.fs.createReadStream(resolvedPath, options);
    } catch (e) {
      throw createNotExistError(`Failed to create read stream for "${resolvedPath || path}": ${e}`);
    }
  }

  //UNSTABLE (NOT IMPLEMENTED PROPERLY)
  createWriteStream(path, options) {
    const relativePath = this._getRelativePath(path);
    const devices = this.devicesManager.getDeviceForWriteSync().slice(0, this.replicationCount);
    const resolvedPaths = devices.map((dev) => join(dev, relativePath));

    if (!path) {
      throw createNotExistError(`Cannot create write stream, path is empty: ${path}`);
    }

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
      resolvedPaths.forEach((resolvedPath) => {
        this._mkdirRecursiveSync(dirname(resolvedPath));
      });
    } catch (e) {
      if (e.code !== CODES.EEXIST) {
        // probably this device already contain this directory
        throw e;
      }
    }

    const [firstResolvedPath, ...restResolvedPaths] = resolvedPaths;
    const firstResolvedFileWriteStream = this.fs.createWriteStream(firstResolvedPath, options);

    //async replicas creation (better ?)
    firstResolvedFileWriteStream.on('finish', () => {
      process.nextTick(() => {
        restResolvedPaths.forEach((resolvedPath) => {
          this.writeInProgressMap && this.writeInProgressMap.add(relativePath, resolvedPath);
          this.fs.createReadStream(firstResolvedPath).pipe(
            this.fs
              .createWriteStream(resolvedPath, options)
              .on('error', () => this.writeInProgressMap && this.writeInProgressMap.remove(relativePath, resolvedPath))
              .on('finish', () => this.writeInProgressMap && this.writeInProgressMap.remove(relativePath, resolvedPath))
          );
        });
      });
    });

    return firstResolvedFileWriteStream;
  }
}

MergedFs.EVENTS = {
  FILE_UPDATED: 'fileUpdated'
};

module.exports = MergedFs;
