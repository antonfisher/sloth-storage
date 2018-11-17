const defaultNodeFs = require('fs');
const {join, dirname} = require('path');
const EventEmitter = require('events');
const async = require('async');

const {CODES} = require('./errorHelpers');
const utils = require('./utils');

const DEFAULT_IDLE_TIMEOUT = 100;

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
    this._startReplicateWorker();
  }

  onFileUpdate(updatedDevice, updatedRelativePath) {
    this._addToQueue(updatedDevice, updatedRelativePath);
  }

  // sync for now
  setReplicationCount(value) {
    if (value === this.replicationCount) {
      return;
    }

    this._stopReplicateWorker();

    const oldValue = this.replicationCount;
    this.replicationCount = value;

    const logMessage = `Change replication count from ${oldValue} to ${value}:`;
    this.emit(Replicator.EVENTS.REPLICATION_STARTED, `${logMessage} start process...`);

    const fileMap = {
      //"relativeFilePath": [..."devicePaths"]
    };
    const devices = this.devicesManager.getDevices();
    let directoryList = devices.map((dev) => ({device: dev, path: ''}));

    // find all files in all directories :0
    while (directoryList.length > 0) {
      const length = directoryList.length;
      directoryList.forEach((dir) => this._traverseDirectory(dir, directoryList, fileMap, logMessage));
      directoryList = directoryList.slice(length); // cut out traversed directories
    }

    const fileList = Object.entries(fileMap);
    this.emit(Replicator.EVENTS.INFO, `${logMessage} ${fileList.length} file(s) found`);

    fileList.forEach((file) => {
      const [relativePath, devs] = file;
      if (this.replicationCount > oldValue) {
        // duplicate file for get required replication count
        const devicesToUse = utils.shuffleArray(devices.filter((dev) => !devs.includes(dev)));
        for (let i = 0; i < this.replicationCount - devs.length && i < devicesToUse.length; i++) {
          const sourceFile = join(devs[utils.getRandomIntInclusive(0, devs.length - 1)], relativePath);
          const destinationFile = join(devicesToUse[i], relativePath);
          try {
            this.fs.copyFileSync(sourceFile, destinationFile);
          } catch (e) {
            this.emit(
              Replicator.EVENTS.ERROR,
              `${logMessage} failed to copy from "${sourceFile}" to "${destinationFile}": ${e}`
            );
          }
        }
      } else {
        // remove redundant file's copies
        const devicesToUse = utils.shuffleArray([...devs]);
        for (let i = 0; i < devs.length - this.replicationCount && i < devicesToUse.length; i++) {
          const deleteFile = join(devs[i], relativePath);
          try {
            this.fs.unlinkSync(deleteFile);
          } catch (e) {
            this.emit(Replicator.EVENTS.ERROR, `${logMessage} failed to delete file from device "${deleteFile}: ${e}`);
          }
        }
      }
    });

    this._startReplicateWorker();
    this.emit(Replicator.EVENTS.REPLICATION_FINISHED, `${logMessage} [DONE]`);
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

  _traverseDirectory(dir, directoryList, filesMap, logMessage = '_traverseDirectory()') {
    const fileDirFullPath = join(dir.device, dir.path);
    try {
      this.fs.readdirSync(fileDirFullPath).forEach((file) => {
        const fileFullPath = join(fileDirFullPath, file);
        try {
          if (this.fs.statSync(fileFullPath).isDirectory()) {
            directoryList.push({device: dir.device, path: join(dir.path, file)});
          } else {
            const relativeFilePath = join(dir.path, file);
            if (typeof filesMap[relativeFilePath] === 'undefined') {
              filesMap[relativeFilePath] = [dir.device];
            } else {
              filesMap[relativeFilePath].push(dir.device);
            }
          }
        } catch (e) {
          this.emit(Replicator.EVENTS.ERROR, `${logMessage} failed to get "${fileFullPath}" file stats: ${e}`);
        }
      });
    } catch (e) {
      this.emit(Replicator.EVENTS.ERROR, `${logMessage} failed to read directory ${fileDirFullPath}: ${e}`);
    }
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
            this.emit(Replicator.EVENTS.INFO, `${sourcePath} replications is completed`);
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
