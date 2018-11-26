const {join} = require('path');

const {version, description, homepage} = require('../package.json');
const logger = require('./logger');
const Hardware = require('./hardware');
const Application = require('./application');
const Replicator = require('./application/replicator');
const parseCliArgs = require('./parseCliArgs');

let hardware;
let application;

function onUnhandledError(err) {
  try {
    hardware.display.writeString('panic');
  } catch (e) {
    const message = 'WARN: cannot use display:';
    try {
      logger.warn(message, e);
    } catch (loggerE) {
      console.log(message, e);
    }
  }
  try {
    cleanUp();
    logger.error(err);
  } catch (e) {
    console.log('LOGGER ERROR', e); //eslint-disable-line no-console
    console.log('ERROR', err); //eslint-disable-line no-console
  }
  setTimeout(() => {
    process.exit(1);
  }, 1000);
}

process.on('unhandledRejection', onUnhandledError);
process.on('uncaughtException', onUnhandledError);
process.on('SIGINT', function() {
  logger.info('Exit...');
  cleanUp();
  setTimeout(() => {
    process.exit();
  }, 1000);
});

function cleanUp() {
  try {
    application.destroy();
  } catch (e) {
    logger.warn(`cannot destroy application class: ${e}`);
  }
  try {
    hardware.destroy();
  } catch (e) {
    logger.warn(`cannot destroy hardware class: ${e}`);
  }
}

parseCliArgs(
  {
    argv: process.argv,
    description,
    homepage,
    version
  },
  (cliOptions) => {
    const rpi = Boolean(cliOptions.rpi);

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

    let replicationCount;
    if (rpi) {
      hardware = new Hardware();
      hardware.ledIO.setBlink(true);
      hardware.display.setMode(hardware.selectorDisplay.getValue());
      replicationCount = hardware.selectorReplications.getValue();
    }

    application = new Application({
      logger,
      replicationCount,
      devicesPath
    });
    application.on(Application.EVENTS.READY, () => {
      if (rpi) {
        if (hardware.switchOnOff.getValue()) {
          application.startFtpServer();
        }
        hardware.ledIO.setBlink(false);
      } else {
        application.startFtpServer();
      }
    });

    if (rpi) {
      // on/off switch
      hardware.switchOnOff.on('switch', (value) => {
        logger.info(`on/off switch triggered: ${value}`);
        if (value) {
          application.startFtpServer();
          hardware.ledIO.blinkOnce();
        } else {
          application.stopFtpServer();
          hardware.ledIO.blinkOnce();
          setTimeout(() => {
            hardware.ledIO.blinkOnce();
          }, 1000);
        }
      });

      application.replicator
        .on(Replicator.EVENTS.REPLICATION_STARTED, () => hardware.ledIO.setBlink(true))
        .on(Replicator.EVENTS.REPLICATION_STARTED, () => hardware.ledIO.setBlink(false));

      hardware.selectorReplications.on('select', (value) => {
        logger.info(`[USER] changed replication count: ${value}`);
        application.setReplicationCount(value);
      });
    }
  }
);
