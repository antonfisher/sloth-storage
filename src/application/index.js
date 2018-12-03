const EventEmitter = require('events');

const {FtpServer} = require('ftpd');

const DevicesManager = require('./devicesManager');
const MergedFs = require('./mergedFs');
const Replicator = require('./replicator');
const CODES = require('../codes');

const DEFAULT_REPLICATION_COUNT = 2;

const ftpServerOptions = {
  host: process.env.IP || '127.0.0.1',
  port: process.env.PORT || 7002,
  tls: null
};

class Application extends EventEmitter {
  constructor({logger, replicationCount = DEFAULT_REPLICATION_COUNT, devicesPath}) {
    super();

    if (!logger) {
      throw '"logger" in required';
    } else if (!devicesPath) {
      throw '"devicesPath" in required';
    }

    this.logger = logger;
    this.replicationCount = replicationCount;
    this.devicesPath = devicesPath;

    this.ftpServer = null;
    this.devicesManager = null;
    this.replicator = null;

    this.logger.info(`replication count: ${this.replicationCount}`);

    this.run();
  }

  setReplicationCount(value) {
    this.replicationCount = value;
    if (this.replicator) {
      this.replicator.setReplicationCount(this.replicationCount);
    }
  }

  run() {
    this.devicesManager = new DevicesManager({devicesPath: this.devicesPath})
      .on(DevicesManager.EVENTS.ERROR, (message) => this.emit(CODES.ERROR, `[DevicesManager] ${message}`))
      .on(DevicesManager.EVENTS.WARN, (message) => this.logger.warn(`[DevicesManager] ${message}`))
      .on(DevicesManager.EVENTS.INFO, (message) => this.logger.info(`[DevicesManager] ${message}`))
      .on(DevicesManager.EVENTS.VERBOSE, (message) => this.logger.verbose(`[DevicesManager] ${message}`))
      .on(DevicesManager.EVENTS.UTILIZATION_CHANGED, ({usedPercent}) =>
        this.logger.info(`[DevicesManager] Storage utilization changed: ${(usedPercent * 100).toFixed(1)}%`)
      );

    this.mergedFs = new MergedFs({
      devicesManager: this.devicesManager,
      isFileReady: (dev, relativePath) => this.replicator.isReady(dev, relativePath)
    });

    this.replicator = new Replicator({
      devicesManager: this.devicesManager,
      mergedFs: this.mergedFs,
      replicationCount: this.replicationCount
    })
      .on(Replicator.EVENTS.ERROR, (message) => this.logger.error(`[Replicator] ${message}`))
      .on(Replicator.EVENTS.WARN, (message) => this.logger.warn(`[Replicator] ${message}`))
      .on(Replicator.EVENTS.INFO, (message) => this.logger.info(`[Replicator] ${message}`))
      .on(Replicator.EVENTS.VERBOSE, (message) => this.logger.verbose(`[Replicator] ${message}`))
      .on(Replicator.EVENTS.REPLICATION_STARTED, (message) => this.logger.info(`[Replicator] ${message}`))
      .on(Replicator.EVENTS.REPLICATION_FINISHED, (message) => this.logger.info(`[Replicator] ${message}`))
      .on(Replicator.EVENTS.QUEUE_LENGTH_CHANGED, (value) => this.logger.info(`[Replicator] queue length: ${value}`));

    this.mergedFs.on(MergedFs.EVENTS.FILE_UPDATED, (dev, relativePath) =>
      this.replicator.onFileUpdate(dev, relativePath)
    );

    setTimeout(() => {
      this.logger.info('application is ready');
      this.emit(Application.EVENTS.READY);
      //this.startFtpServer();
    }, 100);
  }

  startFtpServer() {
    this.logger.info('starting FTP server...');
    this.ftpServer = new FtpServer(ftpServerOptions.host, {
      pasvPortRangeStart: 1025,
      pasvPortRangeEnd: 1050,
      tlsOptions: ftpServerOptions.tls,
      allowUnauthorizedTls: true,
      useWriteFile: false, // unstable
      useReadFile: false, // unstable
      //useWriteFile: true, // trouble with big files
      //useReadFile: true, // trouble with big files
      uploadMaxSlurpSize: 32 * 1024 * 1024 * 1024, // N/A unless 'useWriteFile' is true.
      getInitialCwd: () => '/',
      getRoot: () => '/'
    });

    this.ftpServer.on('error', (error, a, b) => {
      this.logger.error('FTP Server error:', error, a, b);
    });

    this.ftpServer.on('client:connected', (connection) => {
      let username = null;

      this.logger.info(`client connected: ${connection.remoteAddress}`);
      connection.on('command:user', (user, success, failure) => {
        if (user) {
          username = user;
          success();
        } else {
          failure();
        }
      });

      connection.on('command:pass', (pass, success, failure) => {
        if (pass) {
          success(username, this.mergedFs);
        } else {
          failure();
        }
      });
    });

    this.ftpServer.debugging = 4;
    this.ftpServer.listen(ftpServerOptions.port);

    this.logger.info(`FTP server is listening on port ${ftpServerOptions.port}`);
  }

  stopFtpServer() {
    this.logger.info('stopping FTP server...');
    try {
      this.ftpServer.close();
      this.ftpServer = null;
    } catch (e) {
      this.logger.warn('cannot close FTP server');
    }
  }

  destroy() {
    if (this.ftpServer) {
      this.ftpServer.close();
    }
    if (this.devicesManager) {
      try {
        this.devicesManager.destroy();
      } catch (e) {
        this.logger.error(e);
      }
    }
    if (this.replicator) {
      try {
        this.replicator.destroy();
      } catch (e) {
        this.logger.error(e);
      }
    }
  }
}

Application.EVENTS = {
  READY: 'READY'
};

module.exports = Application;
