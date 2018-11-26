const EventEmitter = require('events');

const rpio = require('rpio');

class Switch extends EventEmitter {
  /**
   *  @argument {Number} pin      - pin to read state
   *  @argument {Number} powerPin - pin to power switch (if needed)
   */
  constructor(pin, powerPin = null) {
    super();

    if (typeof pin === 'undefined') {
      throw "'pin' is required";
    }

    this.pin = pin;
    this.powerPin = powerPin;
    this.isOn = null;

    this.setup();
  }

  setup() {
    if (this.powerPin) {
      rpio.open(this.powerPin, rpio.OUTPUT, rpio.HIGH);
    }
    rpio.open(this.pin, rpio.INPUT, rpio.PULL_DOWN);
    rpio.poll(this.pin, () => this._onSwitch(), rpio.POLL_BOTH);
    this.isOn = rpio.read(this.pin);
  }

  getValue() {
    return this.isOn;
  }

  _onSwitch() {
    const isOn = Boolean(rpio.read(this.pin));
    if (this.isOn !== isOn) {
      this.isOn = isOn;
      this.emit('switch', isOn);
    }
  }

  destroy() {
    rpio.poll(this.pin, null);
    rpio.close(this.pin);
    if (this.powerPin) {
      rpio.close(this.powerPin);
    }
  }
}

module.exports = Switch;
