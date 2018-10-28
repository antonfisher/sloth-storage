const {join} = require('path');
const {FtpServer} = require('ftpd');

const {version, description, homepage} = require('../package.json');
const logger = require('./application/logger');
const DevicesManager = require('./application/devicesManager');
const MergedFs = require('./application/mergedFs');
const Replicator = require('./application/replicator');
const parseCliArgs = require('./application/parseCliArgs');

let ftpServer;
let devicesManager;
let replicator;

const REPLICATION_COUNT = 2;

const ftpServerOptions = {
  host: process.env.IP || '127.0.0.1',
  port: process.env.PORT || 7002,
  tls: null
};

function cleanUp() {
  if (ftpServer) {
    try {
      ftpServer.close();
    } catch (e) {
      logger.error(e);
    }
  }
  if (devicesManager) {
    try {
      devicesManager.destroy();
    } catch (e) {
      logger.error(e);
    }
  }
  if (replicator) {
    try {
      replicator.destroy();
    } catch (e) {
      logger.error(e);
    }
  }
}

function onUnhandledError(err) {
  try {
    cleanUp();
    logger.error(err);
  } catch (e) {
    console.log('LOGGER ERROR', e); //eslint-disable-line no-console
    console.log('ERROR', err); //eslint-disable-line no-console
  }
  process.exit(1);
}

process.on('unhandledRejection', onUnhandledError);
process.on('uncaughtException', onUnhandledError);

process.on('SIGINT', function() {
  logger.info('Exit...');
  cleanUp();
  process.exit();
});

parseCliArgs(
  {
    argv: process.argv,
    description,
    homepage,
    version
  },
  (cliOptions) => {
    let devicesPath = null;

    if (cliOptions.devicesPath) {
      devicesPath =
        cliOptions.devicesPath[0] === '/' ? cliOptions.devicesPath : join(process.cwd(), cliOptions.devicesPath);
      logger.info(`Lookup for storage devices in this path: ${devicesPath}`);
    } else {
      //TODO to separated method
      devicesPath = join('/media', process.env.USER); // default ubuntu path for mount media devices
      logger.info(`Lookup for storage devices in this path: ${devicesPath} (auto discovered Ubuntu media folder)`);
    }

    devicesManager = new DevicesManager({devicesPath})
      .on(DevicesManager.EVENTS.ERROR, (message) => logger.error(`[DevicesManager] ${message}`))
      .on(DevicesManager.EVENTS.WARN, (message) => logger.warn(`[DevicesManager] ${message}`))
      .on(DevicesManager.EVENTS.INFO, (message) => logger.info(`[DevicesManager] ${message}`))
      .on(DevicesManager.EVENTS.VERBOSE, (message) => logger.verbose(`[DevicesManager] ${message}`))
      .on(DevicesManager.EVENTS.USED_CAPACITY_PERCENT_CHANGED, (percent) =>
        logger.info(`[DevicesManager] Storage utilization changed: ${(percent * 100).toFixed(1)}%`)
      );

    const mergedFs = new MergedFs({
      devicesManager,
      isFileReady: (dev, relativePath) => replicator.isReady(dev, relativePath)
    });

    replicator = new Replicator({devicesManager, mergedFs, replicationCount: REPLICATION_COUNT})
      .on(Replicator.EVENTS.ERROR, (message) => logger.error(`[Replicator] ${message}`))
      .on(Replicator.EVENTS.WARN, (message) => logger.warn(`[Replicator] ${message}`))
      .on(Replicator.EVENTS.INFO, (message) => logger.info(`[Replicator] ${message}`))
      .on(Replicator.EVENTS.VERBOSE, (message) => logger.verbose(`[Replicator] ${message}`))
      .on(Replicator.EVENTS.QUEUE_LENGTH_CHANGED, (value) => logger.info(`[Replicator] queue length: ${value}`));

    mergedFs.on(MergedFs.EVENTS.FILE_UPDATED, (dev, relativePath) => replicator.onFileUpdate(dev, relativePath));

    logger.info('Starting FTP server...');
    ftpServer = new FtpServer(ftpServerOptions.host, {
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

    ftpServer.on('error', (error) => {
      logger.error('FTP Server error:', error);
    });

    ftpServer.on('client:connected', (connection) => {
      let username = null;

      logger.info(`client connected: ${connection.remoteAddress}`);
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
          success(username, mergedFs);
        } else {
          failure();
        }
      });
    });

    ftpServer.debugging = 4;
    ftpServer.listen(ftpServerOptions.port);

    logger.info(`FTP server is listening on port ${ftpServerOptions.port}`);
  }
);
