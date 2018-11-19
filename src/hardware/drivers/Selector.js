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
    if (typeof pinsMap === 'undefined') {
      throw "'pinsMap' is required";
    }

    this.pinsMap = pinsMap;

    this.setup();
  }

  setup() {
    Object.keys(this.pinsMap).forEach((pin) => {
      rpio.open(pin, rpio.INPUT, rpio.PULL_DOWN);
      rpio.poll(pin, () => this._onSelect(pin), rpio.POLL_LOW);
    });
  }

  _onSelect(pin) {
    this.emit(this.pinsMap[pin]);
  }

  destroy() {
    Object.keys(this.pinsMap).forEach((pin) => {
      rpio.poll(pin, null);
      rpio.close(pin);
    });
  }
}

module.exports = Selector;
