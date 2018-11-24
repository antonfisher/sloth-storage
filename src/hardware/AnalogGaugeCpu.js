const osUtils = require('os-utils');

const AnalogGauge = require('./drivers/AnalogGauge');

const UPDATE_INTERVAL = 1 * 1000;
const PIN = 32;
const CORRECTION = 0.9;

class AnalogGaugeCpu extends AnalogGauge {
  constructor() {
    super(PIN, CORRECTION);

    this._taskInterval = null;
    this._startTask();
  }

  _startTask() {
    this._taskInterval = setInterval(() => this._updateValue(), UPDATE_INTERVAL);
  }

  _stopTask() {
    clearInterval(this._taskInterval);
    this._taskInterval = null;
  }

  _updateValue() {
    osUtils.cpuUsage((cpuUsage) => this.setValue(cpuUsage));
  }

  destroy() {
    this._stopTask();
    super.destroy();
  }
}

module.exports = AnalogGaugeCpu;
