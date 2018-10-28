const defaultNodeFs = require('fs');
const {join, dirname} = require('path');
const EventEmitter = require('events');
const async = require('async');

const {CODES} = require('./errorHelpers');

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

    this._replicateNextTimeout = setTimeout(() => this._replicateNext(), this.idleTimeout);
  }

  onFileUpdate(updatedDevice, updatedRelativePath) {
    this._addToQueue(updatedDevice, updatedRelativePath);
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
          // get all existing devices
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
          if (err) {
            this.emit(Replicator.EVENTS.ERROR, `Cannot replicate file ${sourcePath}: ${err}`);
          } else {
            this.emit(Replicator.EVENTS.INFO, `${sourcePath} replications is completed`);
          }
          this._popFromQueue();
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
    if (this._map[relativePath]) {
      return this._map[relativePath] === device;
    }
    return true;
  }

  destroy() {
    clearTimeout(this._replicateNextTimeout);
    delete this._map;
    delete this._queue;
  }
}

Replicator.EVENTS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  VERBOSE: 'VERBOSE',
  QUEUE_LENGTH_CHANGED: 'QUEUE_LENGTH_CHANGED'
};

module.exports = Replicator;
