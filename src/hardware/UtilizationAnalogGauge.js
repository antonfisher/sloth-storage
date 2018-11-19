const AnalogGauge = require('./drivers/AnalogGauge');

const ANALOG_GAUGE_PIN = 13;
const ANALOG_GAUGE_CORRECTION = 0.9;
const ANALOG_GAUGE_SHIFT = 4.3;

class UtilizationAnalogGauge extends AnalogGauge {
  constructor() {
    super(ANALOG_GAUGE_PIN, ANALOG_GAUGE_CORRECTION, ANALOG_GAUGE_SHIFT);
  }
}

module.exports = UtilizationAnalogGauge;
