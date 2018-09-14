const path = require('path');
const {homedir} = require('os');
const winston = require('winston');
const jsonStringify = require('fast-safe-stringify');

const LOG_FILE_NAME = '.application.log';
const LOG_FILE_PATH =
  process.env.NODE_ENV === 'production'
    ? path.join(homedir(), LOG_FILE_NAME)
    : path.join(__dirname, '..', '..', LOG_FILE_NAME);

const defaultFormats = [
  winston.format.timestamp(),
  winston.format.printf(
    ({timestamp, level, message}) =>
      `${timestamp} ${level}: ${typeof message === 'string' ? message : '\n' + jsonStringify(message, null, 4)}`
  )
];

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), ...defaultFormats),
      level: 'verbose', //process.env.LOG_LEVEL_CONSOLE, //TODO add option
      handleExceptions: true
    }),
    new winston.transports.File({
      format: winston.format.combine(winston.format.uncolorize(), ...defaultFormats),
      level: process.env.LOG_LEVEL_FILE,
      filename: LOG_FILE_PATH,
      handleExceptions: true,
      tailable: true,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    })
  ]
});

logger.info(`Application logs file: ${LOG_FILE_PATH}`);

module.exports = logger;
