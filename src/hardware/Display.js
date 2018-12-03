const ip = require('ip');

const PhatDisplayWrapper = require('./drivers/PhatDisplayWrapper');
const SelectorDisplay = require('./SelectorDisplay');

const DISPLAY_UPDATE_INTERVAL = 250;

const CLOCK_UPDATE_INTERVAL = 1000;
const SCROLL_UPDATE_INTERVAL = 500;

class Display extends PhatDisplayWrapper {
  constructor() {
    super();

    this._needToClearError = false;

    this.buffer = {
      [SelectorDisplay.OPTIONS.CAPACITY_FREE]: 'free',
      [SelectorDisplay.OPTIONS.CAPACITY_TOTAL]: 'total',
      [SelectorDisplay.OPTIONS.CAPACITY_USED]: 'used',
      [SelectorDisplay.OPTIONS.TIME]: 'time',
      [SelectorDisplay.OPTIONS.ERROR]: 'no',
      [SelectorDisplay.OPTIONS.SYNC_STATUS]: 'Q:0',
      [SelectorDisplay.OPTIONS.DRIVES]: 'drives',
      [SelectorDisplay.OPTIONS.IP]: 'ip'
    };

    this._startUpdater();
  }

  setMode(operation) {
    this._stopClock();
    this._stopScrollIp();
    this.clear();

    this.selected = operation;
    this._needToClearError = false;
    if (operation === SelectorDisplay.OPTIONS.TIME) {
      this._startClock();
    } else if (operation === SelectorDisplay.OPTIONS.IP) {
      this._startScrollIp();
    }

    if (operation === SelectorDisplay.OPTIONS.ERROR) {
      this._needToClearError = true;
    } else if (this._needToClearError) {
      this._needToClearError = false;
      this.setBufferValue(SelectorDisplay.OPTIONS.ERROR, '');
    }
  }

  setBufferValue(id, value) {
    if (typeof this.buffer[id] !== 'undefined') {
      this.buffer[id] = value || '';
    } else {
      this.emit(Display.EVENTS.WARN, `Display: buffer '${id}' doesn't exist`); //TODO print in the upper layer
    }
  }

  _startUpdater() {
    this._stopUpdater();
    this._updaterInterval = setInterval(() => {
      if (typeof this.buffer[this.selected] !== 'undefined') {
        this.writeString(this.buffer[this.selected]);
      } else {
        this.writeString(`?${this.selected}`);
      }
    }, DISPLAY_UPDATE_INTERVAL);
  }

  _stopUpdater() {
    clearInterval(this._updaterInterval);
  }

  _getIp() {
    const address = ip.address() || 'unknown';

    this._printIpShift = this._printIpShift || 0;
    if (this._printIpShift > address.length) {
      this._printIpShift = 0;
    }

    this.buffer[SelectorDisplay.OPTIONS.IP] = address.slice(this._printIpShift);
    this._printIpShift++;
  }

  _startScrollIp() {
    this._stopScrollIp();
    this._getIp();
    this._scrollIpInterval = setInterval(() => this._getIp(), SCROLL_UPDATE_INTERVAL);
  }

  _stopScrollIp() {
    clearInterval(this._scrollIpInterval);
    this._scrollIpInterval = null;
    this._printIpShift = 0;
  }

  _getTime() {
    this.buffer[SelectorDisplay.OPTIONS.TIME] = new Date().toLocaleTimeString('de-DE').replace(/:/g, '');
  }

  _startClock() {
    this._stopClock();
    this._getTime();
    this._clockInterval = setInterval(() => this._getTime(), CLOCK_UPDATE_INTERVAL);
  }

  _stopClock() {
    clearInterval(this._clockInterval);
    this._clockInterval = null;
  }

  destroy() {
    this._stopClock();
    this._stopScrollIp();
    this._stopUpdater();

    super.destroy();
  }
}

Display.EVENTS = {
  WARN: 'WARN'
};

module.exports = Display;
