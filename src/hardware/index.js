const osUtils = require('os-utils');
const rpio = require('rpio');

const Display = require('./Display');
const CpuAnalogGauge = require('./CpuAnalogGauge');
const UtilizationAnalogGauge = require('./UtilizationAnalogGauge');

const UPDATE_INTERVAL = 1 * 1000;

class Hardware {
  constructor() {
    // timers
    this._taskUpdateCpuUsageInterval = null;

    this.setup();
    this.startStats();
  }

  setup() {
    rpio.init({
      gpiomem: false,
      mapping: 'gpio'
    });

    this.display = new Display();
    this.cpuAnalogGauge = new CpuAnalogGauge();
    this.utilizationAnalogGauge = new UtilizationAnalogGauge();
  }

  startStats() {
    this._taskUpdateCpuUsageInterval = setInterval(this._taskUpdateCpuUsage, UPDATE_INTERVAL);
  }

  stopStats() {
    clearInterval(this._taskUpdateCpuUsageInterval);
    this._taskUpdateCpuUsageInterval = null;
  }

  _taskUpdateCpuUsage() {
    osUtils.cpuUsage((cpuUsage) => {
      display.setValue(`${String(Math.ceil(cpuUsage * 100)).padStart(5, ' ')}%`);
      cpuAnalogGauge.setValue(cpuUsage);
      if (Math.random() > 0.33) {
        utilizationAnalogGauge.setValue(0);
      } else if (Math.random() > 0.5) {
        utilizationAnalogGauge.setValue(0.5);
      } else {
        utilizationAnalogGauge.setValue(1);
      }
    });
  }

  destroy() {
    this.display.destroy();
    this.cpuAnalogGauge.destroy();
    this.utilizationAnalogGauge.destroy();
  }
}

//test
const h = new Hardware();
