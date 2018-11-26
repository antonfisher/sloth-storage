const rpio = require('rpio');

class AnalogGauge {
  constructor(pin, correction, shift) {
    if (typeof pin === 'undefined') {
      throw "'pin' is required";
    }

    this.pin = pin; // PWM pin (for RPIv3 it's GPIO12 and GPIO13 only)
    this.correction = correction || 1; // value correction coefficient (changes scale to adjust 100%)
    this.shift = shift || 0; // shifts arrow right/left to adjust 0%

    this.setup();
  }

  setup() {
    rpio.open(this.pin, rpio.PWM, rpio.LOW);
    rpio.pwmSetClockDivider(8);
    rpio.pwmSetRange(this.pin, 256);
    rpio.pwmSetData(this.pin, rpio.LOW);
  }

  setValue(value) {
    const cpuUsagePercent = Math.ceil(value * 100);
    const normalizedValue = Math.min(100, Math.max(0, (cpuUsagePercent || 0) * this.correction) + this.shift);
    const pwmValue = Math.round((normalizedValue / 100) * 256);

    rpio.pwmSetData(this.pin, pwmValue);
  }

  destroy() {
    this.setValue(0);
    rpio.close(this.pin);
  }
}

module.exports = AnalogGauge;
