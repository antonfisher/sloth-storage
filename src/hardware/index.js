const EventEmitter = require('events');

const rpio = require('rpio');

const LedIO = require('./LedIO');
const LedError = require('./LedError');
const Display = require('./Display');
const SwitchOnOff = require('./SwitchOnOff');
const AnalogGaugeCpu = require('./AnalogGaugeCpu');
const AnalogGaugeUtilization = require('./AnalogGaugeUtilization');
const SelectorDisplay = require('./SelectorDisplay');
const SelectorReplications = require('./SelectorReplications');

class Hardware extends EventEmitter {
  constructor() {
    super();

    this._taskUpdateCpuUsageInterval = null;

    this.setup();
  }

  setup() {
    rpio.init({
      gpiomem: false,
      mapping: 'physical'
    });

    this.display = new Display();

    this.ledIO = new LedIO();
    this.ledError = new LedError();

    this.analogGaugeCpu = new AnalogGaugeCpu();
    this.analogGaugeUtilization = new AnalogGaugeUtilization();

    this.selectorDisplay = new SelectorDisplay();
    this.selectorDisplay.on('select', (operation) => {
      this.display.setMode(operation);
      this.ledError.setValue(operation === SelectorDisplay.OPTIONS.ERROR);
    });

    this.selectorReplications = new SelectorReplications();

    this.switchOnOff = new SwitchOnOff();
  }

  destroy() {
    this.ledIO.destroy();
    this.ledError.destroy();
    this.selectorDisplay.destroy();
    this.selectorReplications.destroy();
    this.analogGaugeCpu.destroy();
    this.analogGaugeUtilization.destroy();
    this.display.destroy();
  }
}

module.exports = Hardware;
