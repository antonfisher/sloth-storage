const {join} = require('path');

const {version, description, homepage} = require('../package.json');
const logger = require('./logger');
const Hardware = require('./hardware');
const Application = require('./application');
const parseCliArgs = require('./parseCliArgs');

let hardware;
let application;

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
      hardware.ledIO.setValue(true);
      replicationCount = hardware.selectorReplications.getValue();
    }

    application = new Application({
      logger,
      replicationCount,
      devicesPath
    });
    application.on(Application.EVENTS.READY, () => {
      if (rpi) {
        hardware.ledIO.setValue(false);
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
    }
  }
);
