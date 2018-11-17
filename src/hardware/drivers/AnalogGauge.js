const rpio = require('rpio');

function AnalogGauge(levelPin) {
  if (typeof levelPin === 'undefined') {
    throw "'levelPin' is required";
  }

  this.levelPin = levelPin;
  this.reset();

  return this;
}

AnalogGauge.prototype.reset = function() {
  rpio.open(this.levelPin, rpio.PWM, rpio.LOW);
  rpio.pwmSetClockDivider(8);
  rpio.pwmSetRange(this.levelPin, 256);
  rpio.pwmSetData(this.levelPin, rpio.LOW);
};

AnalogGauge.prototype.setValue = function(value) {
  const cpuUsagePercent = Math.ceil(value * 100);
  const normalizedValue = Math.min(100, Math.max(0, cpuUsagePercent || 0));
  const pwmValue = Math.round((normalizedValue / 100) * 256);

  rpio.pwmSetData(this.levelPin, pwmValue);

  return this;
};

AnalogGauge.prototype.demo = function(times = 1) {
  console.log(`-- demo ${times}x times`);
  // testing
  let time = 0;
  let value = 0;
  let step = 10;
  let direction = step;

  const intervalId = setInterval(() => {
    value += direction;
    if (value > 100) {
      value = 100;
      direction = -step;
    } else if (value < 0) {
      value = 0;
      direction = step;
    }
    this.setValue(value);
    console.log('-- set value', value);

    if (value === 0) {
      time++;
      if (time === times) {
        clearInterval(intervalId);
        this.reset();
      }
    }
  }, 1000);

  return this;
};

AnalogGauge.prototype.destroy = function() {
  this.reset();
};

module.exports = AnalogGauge;
