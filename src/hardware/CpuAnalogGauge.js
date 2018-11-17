const AnalogGauge = require('./drivers/AnalogGauge');

const CPU_ANALOG_GAUGE_PIN = 12;

function CpuAnalogGauge() {
  this.analogGauge = new AnalogGauge(CPU_ANALOG_GAUGE_PIN);
  return this;
}

CpuAnalogGauge.prototype.setValue = function(value) {
  return this.analogGauge.setValue(value);
};

CpuAnalogGauge.prototype.destroy = function() {
  this.analogGauge.destroy();
  delete this.analogGauge;
};

module.exports = CpuAnalogGauge;
