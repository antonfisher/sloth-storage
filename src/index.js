const {join} = require('path');

const {version, description, homepage} = require('../package.json');
const logger = require('./logger');
const parseCliArgs = require('./parseCliArgs');
const Hardware = require('./hardware');
const Application = require('./application');
const {formatBytes} = require('./application/utils');
const CODES = require('./codes');

// software
const Replicator = require('./application/replicator');
const DevicesManager = require('./application/devicesManager');

// hardware
const SelectorDisplay = require('./hardware/SelectorDisplay');

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

    application
      .on(Application.EVENTS.READY, () => {
        if (rpi) {
          if (hardware.switchOnOff.getValue()) {
            application.startFtpServer();
          }
          hardware.ledIO.setBlink(false);
        } else {
          application.startFtpServer();
        }
      })
      .on(CODES.ERROR, (err) => {
        if (rpi) {
          hardware.display.setBufferValue(SelectorDisplay.OPTIONS.ERROR, err);
        }
      });

    if (rpi) {
      application.devicesManager.on(DevicesManager.EVENTS.READY, () =>
        hardware.display.setBufferValue(
          SelectorDisplay.OPTIONS.DRIVES,
          application.devicesManager.getDevices(false).length
        )
      );

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
        .on(Replicator.EVENTS.QUEUE_LENGTH_CHANGED, (l) => {
          if (l === 0) {
            hardware.ledIO.setBlink(false);
          } else {
            hardware.ledIO.setBlink(true, 30 + 300 / l);
          }
          hardware.display.setBufferValue(SelectorDisplay.OPTIONS.SYNC_STATUS, `Q:${l}`);
        })
        .on(Replicator.EVENTS.REPLICATION_STARTED, () => hardware.ledIO.setBlink(true))
        .on(Replicator.EVENTS.REPLICATION_FINISHED, () => hardware.ledIO.setBlink(false));

      application.devicesManager.on(DevicesManager.EVENTS.UTILIZATION_CHANGED, ({total, used, free, usedPercent}) => {
        const r = hardware.selectorReplications.getValue();
        hardware.display.setBufferValue(SelectorDisplay.OPTIONS.CAPACITY_TOTAL, formatBytes(total / r));
        hardware.display.setBufferValue(SelectorDisplay.OPTIONS.CAPACITY_USED, formatBytes(used / r));
        hardware.display.setBufferValue(SelectorDisplay.OPTIONS.CAPACITY_FREE, formatBytes(free / r));
        hardware.analogGaugeUtilization.setValue(usedPercent);
      });

      const updateDevicesCount = () => {
        hardware.display.setBufferValue(
          SelectorDisplay.OPTIONS.DRIVES,
          application.devicesManager.getDevices(false).length
        );
      };
      application.devicesManager
        .on(DevicesManager.EVENTS.DEVICE_ADDED, updateDevicesCount)
        .on(DevicesManager.EVENTS.DEVICE_REMOVED, updateDevicesCount);

      hardware.selectorReplications.on('select', (value) => {
        logger.info(`[USER] changed replication count: ${value}`);
        application.setReplicationCount(value);
      });
    }
  }
);
