const AnalogGauge = require('./drivers/AnalogGauge');

const ANALOG_GAUGE_PIN = 12;
const ANALOG_GAUGE_CORRECTION = 0.9;

class CpuAnalogGauge extends AnalogGauge {
  constructor() {
    super(ANALOG_GAUGE_PIN, ANALOG_GAUGE_CORRECTION);
  }
}

module.exports = CpuAnalogGauge;
