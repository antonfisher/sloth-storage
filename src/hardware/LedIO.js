const Led = require('./drivers/Led');

const PIN = 38;

class LedIO extends Led {
  constructor() {
    super(PIN);
  }
}

module.exports = LedIO;
