const rpio = require('rpio');

const Switch = require('./drivers/Switch');

const PIN = 35;
const POWER_PIN = 37;

class SwitchOnOff extends Switch {
  constructor() {
    super(PIN, POWER_PIN);
  }
}

module.exports = SwitchOnOff;
