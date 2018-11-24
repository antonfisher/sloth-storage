const EventEmitter = require('events');

const rpio = require('rpio');

class Selector extends EventEmitter {
  /**
   *  @argument {String} pinsMap - key: "PRI_GPIO_pin", value: "even_name"
   *    Example:
   *    {
   *      10: "EVENT_1_NAME"
   *      11: "EVENT_2_NAME"
   *    }
   */
  constructor(pinsMap) {
    super();

    if (typeof pinsMap === 'undefined') {
      throw "'pinsMap' is required";
    }

    this.pinsMap = pinsMap;
    this.selectedPin = null;

    this.setup();
  }

  setup() {
    Object.keys(this.pinsMap).forEach((pin) => {
      rpio.open(pin, rpio.INPUT, rpio.PULL_DOWN);
      rpio.poll(pin, () => this._onSelect(pin), rpio.POLL_HIGH);
      if (rpio.read(pin)) {
        setTimeout(() => this._onSelect(pin), 10);
      }
    });
  }

  getSelected() {
    return this.selectedPin;
  }

  _onSelect(pin) {
    if (this.selectedPin !== pin) {
      console.log('## SELECT', pin);
      this.selectedPin = pin;
      this.emit('select', this.pinsMap[pin]);
    }
  }

  destroy() {
    Object.keys(this.pinsMap).forEach((pin) => {
      rpio.poll(pin, null);
      rpio.close(pin);
    });
  }
}

module.exports = Selector;
