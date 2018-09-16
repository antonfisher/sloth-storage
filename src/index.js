const {join} = require('path');
const {FtpServer} = require('ftpd');

const {version, description, homepage} = require('../package.json');
const logger = require('./application/logger');
const DevicesManager = require('./application/devicesManager');
const MergedFs = require('./application/mergedFs');
const parseCliArgs = require('./application/parseCliArgs');

const ftpServerOptions = {
  host: process.env.IP || '127.0.0.1',
  port: process.env.PORT || 7002,
  tls: null
};

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

    const devicesManager = new DevicesManager({devicesPath})
      .on(DevicesManager.EVENTS.ERROR, (message) => {
        logger.error(`[DevicesManager] ${message}`);
      })
      .on(DevicesManager.EVENTS.WARN, (message) => {
        logger.warn(`[DevicesManager] ${message}`);
      })
      .on(DevicesManager.EVENTS.INFO, (message) => {
        logger.info(`[DevicesManager] ${message}`);
      })
      .on(DevicesManager.EVENTS.VERBOSE, (message) => {
        logger.verbose(`[DevicesManager] ${message}`);
      })
      .on(DevicesManager.EVENTS.USED_CAPACITY_PERCENT_CHANGED, (percent) => {
        logger.info(`[DevicesManager] Storage utilization changed: ${(percent * 100).toFixed(1)}%`);
      });

    const mergedFs = new MergedFs({devicesManager, replicationCount: 2});

    logger.info('Starting FTP server...');
    const server = new FtpServer(ftpServerOptions.host, {
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

    server.on('error', (error) => {
      logger.error('FTP Server error:', error);
    });

    server.on('client:connected', (connection) => {
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

    server.debugging = 4;
    server.listen(ftpServerOptions.port);

    logger.info(`FTP server is listening on port ${ftpServerOptions.port}`);
  }
);
