const defaultNodeFs = require('fs');
const {join, dirname} = require('path');
const EventEmitter = require('events');
const async = require('async');

const {CODES} = require('./errorHelpers');
const utils = require('./utils');

const DEFAULT_IDLE_TIMEOUT = 100;
const IO_CONCURRENT_READ_OPERATION_COUNT = 3; //TODO TBD
const IO_CONCURRENT_COPY_OPERATION_COUNT = 1; //TODO TBD
const IO_CONCURRENT_REMOVE_OPERATION_COUNT = 1; //TODO TBD

/**
 * @param {DeviceManager} devicesManager    DeviceManager instance
 * @param {MergedFs}      mergedFs          MergedFs instance
 * @param {number}        replicationCount  the number of replications for file write
 * @param {number}        idleTimeout       replication idle timeout
 * @param {fs}            fs                link to nodejs fs module
 */
class Replicator extends EventEmitter {
  constructor({devicesManager, mergedFs, replicationCount, idleTimeout = DEFAULT_IDLE_TIMEOUT, fs = defaultNodeFs}) {
    super();

    if (!devicesManager) {
      throw new Error('No "devicesManager" parameter');
    }

    this.devicesManager = devicesManager;
    this.mergedFs = mergedFs;
    this.replicationCount = replicationCount;
    this.idleTimeout = idleTimeout;
    this.fs = fs;

    this._queue = [];
    this._map = {};
    this._lastQueueLength = 0;

    this._globalIsReady = false;
    this._replicateNextTimeout = null;
    this._replicationInProgress = false;
    this._setReplicationCountNextValue = null;
    this._startReplicateWorker();
  }

  onFileUpdate(updatedDevice, updatedRelativePath) {
    this._addToQueue(updatedDevice, updatedRelativePath);
  }

  // sync for now
  setReplicationCount(value) {
    if (value === this.replicationCount) {
      return;
    } else if (value <= 0) {
      this.emit(Replicator.EVENTS.WARN, `invalid replication count value: '${value}'`);
      return;
    }

    // save new value for later if another replication is in progress
    if (this._replicationInProgress) {
      this._setReplicationCountNextValue = value;
      return;
    } else {
      this._setReplicationCountNextValue = null;
    }

    this._replicationInProgress = true;
    this._stopReplicateWorker();

    const oldValue = this.replicationCount;
    this.replicationCount = value;

    const logMessage = `Change replication count from ${oldValue} to ${value}:`;
    this.emit(Replicator.EVENTS.REPLICATION_STARTED, `${logMessage} start process...`);

    async.waterfall(
      [
        (done) => {
          const filesMap = {
            // {"relativeFilePath": [..."devicePaths"], ...}
          };
          const rootDirectories = this.devicesManager.getDevices().map((dev) => ({device: dev, path: ''}));
          this._getFilesMap(rootDirectories, filesMap, (err) => done(err, filesMap));
        },
        (filesMap, done) => {
          const fileList = Object.entries(filesMap);
          this.emit(Replicator.EVENTS.INFO, `${logMessage} ${fileList.length} file(s) found`);

          async.forEachLimit(
            fileList,
            IO_CONCURRENT_READ_OPERATION_COUNT,
            (file, fileDone) => {
              if (this._setReplicationCountNextValue !== null) {
                return done(new Error(`replication count changed to ${this._setReplicationCountNextValue}`));
              }
              if (this.replicationCount > oldValue) {
                this._copyFile(file, fileDone); // duplicate file for get required replication count
              } else {
                this._removeFile(file, fileDone); // remove redundant file's copies
              }
            },
            (err) => done(err)
          );
        }
      ],
      (err) => {
        if (err) {
          if (this._setReplicationCountNextValue !== null) {
            this.emit(
              Replicator.EVENTS.WARN,
              `${logMessage} warning, desired replication count changed to ${this._setReplicationCountNextValue} ` +
                `during the replication (Error: ${err})`
            );
          } else {
            this.emit(Replicator.EVENTS.ERROR, `${logMessage} error: ${err}`);
          }
        }
        this._replicationInProgress = false;
        this._startReplicateWorker();
        this.emit(Replicator.EVENTS.REPLICATION_FINISHED, `${logMessage} [DONE]`);
        if (this._setReplicationCountNextValue !== null) {
          const nextValue = this._setReplicationCountNextValue;
          this._setReplicationCountNextValue = null;
          setTimeout(() => this.setReplicationCount(nextValue), 10);
        }
      }
    );
  }

  _startReplicateWorker() {
    this._replicateNextTimeout = setTimeout(() => this._replicateNext(), this.idleTimeout);
    this._globalIsReady = true;
    this.emit(Replicator.EVENTS.INFO, `replication worker started`);
  }

  _stopReplicateWorker() {
    this._globalIsReady = false;
    clearTimeout(this._replicateNextTimeout);
    this._replicateNextTimeout = null;
    this.emit(Replicator.EVENTS.INFO, `replication worker stopped`);
  }

  /**
   * Find all files in all directories :0
   *
   * @param {Array}   directoryList array of objects: [{device: '...', path: '...'}, ...]
   * @param {Object}  filesMap      object of files: {"relativeFilePath": [..."devicePaths"], ...}
   * @returns {Object} {"relativeFilePath": [..."devicePaths"], ...}
   */
  _getFilesMap(directoryList, filesMap, callback) {
    async.concatLimit(
      directoryList,
      IO_CONCURRENT_READ_OPERATION_COUNT,
      (dir, done) => this._traverseDirectory(dir, filesMap, done),
      (err, childrenDirectoryList) => {
        if (this._setReplicationCountNextValue !== null) {
          return callback(`desired replication count changed to ${this._setReplicationCountNextValue}`);
        }
        if (childrenDirectoryList.length > 0) {
          return this._getFilesMap(childrenDirectoryList, filesMap, callback);
        }
        return callback(err);
      }
    );
  }

  /**
   * @param {String} dir
   * @param {Object} filesMap - object to mutate
   * @param {Function} callback(err, childrenDirectoryList)
   */
  _traverseDirectory(dir, filesMap, callback) {
    const fileDirFullPath = join(dir.device, dir.path);
    const childrenDirectoryList = [];

    this.fs.readdir(fileDirFullPath, (err, files) => {
      if (err) {
        this.emit(Replicator.EVENTS.ERROR, `replication: failed to read directory ${fileDirFullPath}: ${err}`);
        return callback(null, childrenDirectoryList);
      }

      async.forEachLimit(
        files,
        IO_CONCURRENT_READ_OPERATION_COUNT,
        (file, done) => {
          const fileFullPath = join(fileDirFullPath, file);
          this.fs.stat(fileFullPath, (err, stat) => {
            if (err) {
              this.emit(Replicator.EVENTS.ERROR, `replication: failed to get "${fileFullPath}" file stats: ${err}`);
            } else if (stat.isDirectory()) {
              childrenDirectoryList.push({device: dir.device, path: join(dir.path, file)});
            } else {
              const relativeFilePath = join(dir.path, file);
              if (typeof filesMap[relativeFilePath] === 'undefined') {
                filesMap[relativeFilePath] = [dir.device];
              } else {
                filesMap[relativeFilePath].push(dir.device);
              }
            }
            return done(null);
          });
        },
        (err) => callback(err, childrenDirectoryList)
      );
    });
  }

  // duplicate file for get required replication count
  _copyFile(file, done) {
    const [relativePath, devsFileAlreadyExist] = file;
    const devs = this.devicesManager.getDevices();
    let devsToUse = utils.shuffleArray(devs.filter((dev) => !devsFileAlreadyExist.includes(dev)));
    devsToUse = devsToUse.slice(0, this.replicationCount - devsFileAlreadyExist.length);
    async.forEachLimit(
      devsToUse,
      IO_CONCURRENT_COPY_OPERATION_COUNT,
      (dev, copyDone) => {
        const randomFileToCopyFrom = utils.getRandomIntInclusive(0, devsFileAlreadyExist.length - 1);
        const sourceFile = join(devsFileAlreadyExist[randomFileToCopyFrom], relativePath);
        const destinationFile = join(dev, relativePath);
        this.fs.copyFile(sourceFile, destinationFile, (err) => {
          if (err) {
            this.emit(
              Replicator.EVENTS.ERROR,
              `replication: failed to copy from "${sourceFile}" to "${destinationFile}": ${e}`
            );
          }
          return copyDone(null); // ignore copy errors
        });
      },
      done
    );
  }

  // remove redundant file's copies
  _removeFile(file, done) {
    const [relativePath, devsFileAlreadyExist] = file;
    let devsToUse = utils.shuffleArray([...devsFileAlreadyExist]);
    devsToUse = devsToUse.slice(0, devsFileAlreadyExist.length - this.replicationCount);
    async.forEachLimit(
      devsToUse,
      IO_CONCURRENT_REMOVE_OPERATION_COUNT,
      (dev, rmDone) => {
        const deleteFile = join(dev, relativePath);
        this.fs.unlink(deleteFile, (err) => {
          if (err) {
            this.emit(Replicator.EVENTS.ERROR, `replication: failed to delete file from device "${deleteFile}: ${e}`);
          }
          return rmDone(null); // ignore remove error
        });
      },
      done
    );
  }

  _replicateNext() {
    if (this._lastQueueLength !== this._queue.length) {
      this.emit(Replicator.EVENTS.QUEUE_LENGTH_CHANGED, this._queue.length);
      this._lastQueueLength = this._queue.length;
    }

    const relativePath = this._queue[0];

    if (relativePath) {
      const device = this._map[relativePath];
      const sourcePath = join(device, relativePath);
      async.waterfall(
        [
          (done) => this.devicesManager.getDeviceForWrite(done),
          (devices, done) => {
            let replicateToDevices = [];
            for (let i = 0; i < devices.length, replicateToDevices.length < this.replicationCount - 1; i++) {
              if (devices[i] !== device) {
                replicateToDevices.push(devices[i]);
              }
            }
            done(null, replicateToDevices);
          },
          (replicateToDevices, done) => {
            if (replicateToDevices.length < this.replicationCount - 1) {
              this.emit(Replicator.EVENTS.WARN, 'Device count is less than desired replication count');
            }
            done(null, replicateToDevices);
          },
          (replicateToDevices, done) =>
            async.concatSeries(
              replicateToDevices,
              (replicateToDevice, writeDone) => {
                const destinationPath = join(replicateToDevice, relativePath);
                const logMessage = `Replicate '${sourcePath}' to '${destinationPath}'`;
                this.emit(Replicator.EVENTS.INFO, `${logMessage}...`);
                this.mergedFs._mkdirRecursive(dirname(destinationPath), (err) => {
                  // device may already has this directory created
                  if (err && err.code !== CODES.EEXIST) {
                    return writeDone(err);
                  }
                  try {
                    this.fs.createReadStream(sourcePath).pipe(
                      this.fs
                        .createWriteStream(destinationPath)
                        .on('error', () => {
                          this.emit(Replicator.EVENTS.VERBOSE, `${logMessage} [ERROR] ${err}`);
                          writeDone(err);
                        })
                        .on('finish', () => {
                          this.emit(Replicator.EVENTS.VERBOSE, `${logMessage} [DONE]`);
                          writeDone(null);
                        })
                    );
                  } catch (e) {
                    this.emit(Replicator.EVENTS.VERBOSE, `${logMessage} [ERROR] ${err}`);
                  }
                });
              },
              (err) => done(err)
            )
        ],
        (err) => {
          const [device, relativePath] = this._popFromQueue();
          if (err) {
            this.emit(Replicator.EVENTS.ERROR, `Cannot replicate file ${sourcePath}: ${err}`);
            this._addToQueue(device, relativePath); // try to replicate this file later?
          } else {
            this.emit(Replicator.EVENTS.INFO, `${sourcePath} replication is completed`);
          }
          this._replicateNextTimeout = setTimeout(() => this._replicateNext(), this.idleTimeout);
        }
      );
    } else {
      this._replicateNextTimeout = setTimeout(() => this._replicateNext(), this.idleTimeout);
    }
  }

  _addToQueue(device, relativePath) {
    this._queue.push(relativePath);
    this._map[relativePath] = device;
  }

  _popFromQueue() {
    const relativePath = this._queue.shift();

    if (relativePath) {
      const device = this._map[relativePath];
      const anotherExistingIndex = this._queue.indexOf(relativePath);
      if (anotherExistingIndex === -1) {
        delete this._map[relativePath];
      }
      return [device, relativePath];
    }

    return [null, null];
  }

  isReady(device, relativePath) {
    if (!this._globalIsReady) {
      return false;
    } else if (this._map[relativePath]) {
      return this._map[relativePath] === device;
    }
    return true;
  }

  destroy() {
    this._stopReplicateWorker();
    delete this._map;
    delete this._queue;
  }
}

Replicator.EVENTS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  VERBOSE: 'VERBOSE',
  QUEUE_LENGTH_CHANGED: 'QUEUE_LENGTH_CHANGED',
  REPLICATION_STARTED: 'REPLICATION_STARTED',
  REPLICATION_FINISHED: 'REPLICATION_FINISHED'
};

module.exports = Replicator;
