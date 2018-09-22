const EventEmitter = require('events');

/**
 * @param {DeviceManager} devicesManager    DeviceManager instance
 * @param {number}        replicationCount  the number of replications for file write
 */
class Replicator extends EventEmitter {
  constructor({devicesManager, replicationCount}) {
    super();

    if (!devicesManager) {
      throw new Error('No "devicesManager" parameter');
    }

    this.devicesManager = devicesManager;
    this.replicationCount = replicationCount;

    this.map = {};
  }

  replicate(updatedFilePath) {
    console.log('## replicate', updatedFilePath);
    // 1. find all devices with this file
    // 2. add all file except original to write queue based on replication count
    // 3. mark there files as NOT_REARY paths

    // handle in replicator
    //process.nextTick(() => {
    //  restResolvedPaths.forEach((resolvedPath) => {
    //    this.writeInProgressMap && this.writeInProgressMap.add(relativePath, resolvedPath);
    //    this.fs.createReadStream(firstResolvedPath).pipe(
    //      this.fs
    //        .createWriteStream(resolvedPath, options)
    //        .on('error', () => this.writeInProgressMap && this.writeInProgressMap.remove(relativePath, resolvedPath))
    //        .on('finish', () => this.writeInProgressMap && this.writeInProgressMap.remove(relativePath, resolvedPath))
    //    );
    //  });
    //});
  }

  addToQueue(relativePath, writePath) {
    if (!this.map[relativePath]) {
      this.map[relativePath] = [];
    }
    this.map[relativePath].push(writePath);
  }

  removeFromQueue(relativePath, writePath) {
    if (this.map[relativePath]) {
      this.map[relativePath] = this.map[relativePath].filter((path) => path !== writePath);
      if (this.map[relativePath].length === 0) {
        delete this.map[relativePath];
      }
    }
  }

  isBusy(relativePath, writePath) {
    if (!this.map[relativePath]) {
      return false;
    }
    return this.map[relativePath].includes(writePath);
  }

  destroy() {
    delete this.map;
  }
}

module.exports = Replicator;
