const AnalogGauge = require('./drivers/AnalogGauge');

const PIN = 33;
const CORRECTION = 0.9;
const SHIFT = 4.3;

class AnalogGaugeUtilization extends AnalogGauge {
  constructor() {
    super(PIN, CORRECTION, SHIFT);
  }
}

module.exports = AnalogGaugeUtilization;
