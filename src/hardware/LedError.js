const Led = require('./drivers/Led');

const PIN = 40;

class LedError extends Led {
  constructor() {
    super(PIN);
  }
}

module.exports = LedError;
