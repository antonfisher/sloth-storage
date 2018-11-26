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

    //debug -----
    setInterval(() => {
      this.analogGaugeUtilization.setValue(new Date().getSeconds() / 59);
    }, 1000);
    //-----------

    this.selectorDisplay = new SelectorDisplay();
    this.selectorDisplay.on('select', (operation) => {
      this.display.setMode(operation);
      this.ledError.setValue(operation === SelectorDisplay.OPTIONS.ERROR);
      this.ledIO.setValue(operation === SelectorDisplay.OPTIONS.SYNC_STATUS);
    });

    this.selectorReplications = new SelectorReplications();
    // this.selectorReplications.on('select', (operation) => {
    //   this.display.writeString(`RS:${operation}`); // debug
    // });

    this.switchOnOff = new SwitchOnOff();
    this.switchOnOff.on('switch', (value) => {
      console.log('## switch', value);
    });
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
