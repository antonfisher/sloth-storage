const ip = require('ip');

const PhatDisplayWrapper = require('./drivers/PhatDisplayWrapper');
const SelectorDisplay = require('./SelectorDisplay');

const CLOCK_UPDATE_INTERVAL = 1 * 1000;
const SCROLL_UPDATE_INTERVAL = 500;

class Display extends PhatDisplayWrapper {
  constructor() {
    super();
  }

  setMode(operation) {
    this._stopClock();
    this._stopScrollIp();
    this.clear();

    if (operation === SelectorDisplay.OPTIONS.TIME) {
      this._startClock();
    } else if (operation === SelectorDisplay.OPTIONS.IP) {
      this._startScrollIp();
    } else {
      this.writeString(`DS:${operation}`);
    }
  }

  _printIp() {
    const address = ip.address() || 'unknown';

    this._printIpShift = this._printIpShift || 0;
    if (this._printIpShift > address.length) {
      this._printIpShift = 0;
    }

    this.writeString(address.slice(this._printIpShift));

    this._printIpShift++;
  }

  _startScrollIp() {
    this._stopScrollIp();
    this._printIp();
    this._scrollIpInterval = setInterval(() => this._printIp(), SCROLL_UPDATE_INTERVAL);
  }

  _stopScrollIp() {
    clearInterval(this._scrollIpInterval);
    this._scrollIpInterval = null;
    this._printIpShift = 0;
  }

  _printClock() {
    this.writeString(new Date().toLocaleTimeString('de-DE').replace(/:/g, ''));
  }

  _startClock() {
    this._stopClock();
    this._printClock();
    this._clockInterval = setInterval(() => this._printClock(), CLOCK_UPDATE_INTERVAL);
  }

  _stopClock() {
    clearInterval(this._clockInterval);
    this._clockInterval = null;
  }
}

module.exports = Display;
