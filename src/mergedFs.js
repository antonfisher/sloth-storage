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

  statSync(path) {
    return fs.statSync(this._resolvePathSync(path));
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

    //const mkdirRecursive = (p, done, initialP) => {
    //  initialP = (initialP || p);
    //  fs.mkdir(p, (err) => {
    //    if (err && err.code === CODES.ENOENT) {
    //      mkdirRecursive(dirname(p), done, initialP);
    //    } else if (p !== initialP) {
    //      mkdirRecursive(initialP, done, initialP); //ugly
    //    } else {
    //      done(err);
    //    }
    //  });
    //};

    async.each(
      this.devicesManager.getDevices(),
      (dev, done) => fs.mkdir(join(dev, relativePath), done),
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

    this.devicesManager.getDeviceForWrite((err, device) => {
      if (err) {
        return process.nextTick(() => callback(err));
      }

      const resolvedPath = join(device, relativePath);

      this.stat(dirname(path), (errStat, stat) => {
        if (errStat) {
          return callback(errStat);
        } else if (!stat.isDirectory()) {
          return callback(
            createError(`Failed to resolve path "${relativePath}": path contains a file in the middle`, CODES.EISFILE)
          );
        }

        //TODO have to create directory if not exist
        fs.writeFile(resolvedPath, data, options, callback);
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
    const resolvedPath = join(this.devicesManager.getDeviceForWriteSync(), relativePath);

    const stat = this.statSync(dirname(path));
    if (!stat.isDirectory()) {
      throw createError(`Failed to resolve path "${relativePath}": path contains a file in the middle`, CODES.EISFILE);
    }

    try {
      //TODO have to create directory if not exist
      return fs.createWriteStream(resolvedPath, options);
    } catch (e) {
      throw new Error(`Failed to create write stream for "${relativePath || path}": ${e}`);
    }
  }
}

module.exports = MergedFs;
