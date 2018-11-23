const osUtils = require('os-utils');
const rpio = require('rpio');

const Display = require('./Display');
const CpuAnalogGauge = require('./CpuAnalogGauge');
const UtilizationAnalogGauge = require('./UtilizationAnalogGauge');
const DisplaySelector = require('./DisplaySelector');
const ReplicationsSelector = require('./ReplicationsSelector');

const UPDATE_INTERVAL = 1 * 1000;

class Hardware {
  constructor() {
    // timers
    this._taskUpdateCpuUsageInterval = null;

    this.setup();
    this.startCPUStatsTask();
  }

  setup() {
    rpio.init({
      gpiomem: false,
      mapping: 'gpio'
    });

    this.display = new Display();
    this.cpuAnalogGauge = new CpuAnalogGauge();
    this.utilizationAnalogGauge = new UtilizationAnalogGauge();

    this.displaySelector = new DisplaySelector();
    this.displaySelector.on('select', (operation) => {
      this.display.writeString(`DS: ${operation}`, true); // debug
    });

    this.replicationsSelector = new ReplicationsSelector();
    this.replicationsSelector.on('select', (operation) => {
      this.display.writeString(`RS: ${operation}`, true); // debug
    });
  }

  startCPUStatsTask() {
    this._taskUpdateCpuUsageInterval = setInterval(this._taskUpdateCpuUsage, UPDATE_INTERVAL);
  }

  stopCPUStatsTask() {
    clearInterval(this._taskUpdateCpuUsageInterval);
    this._taskUpdateCpuUsageInterval = null;
  }

  _taskUpdateCpuUsage() {
    osUtils.cpuUsage((cpuUsage) => {
      display.writeString(`${String(Math.ceil(cpuUsage * 100)).padStart(5, ' ')}%`); //debug
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
    this.displaySelector.destroy();
    this.replicationsSelector.destroy();
    this.display.destroy();
    this.cpuAnalogGauge.destroy();
    this.utilizationAnalogGauge.destroy();
  }
}

//test
const h = new Hardware();
