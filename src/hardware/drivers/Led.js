const rpio = require('rpio');

class Led {
  constructor(pin) {
    if (typeof pin === 'undefined') {
      throw "'pin' is required";
    }

    this.pin = pin; // PRI GPIO pin

    this.setup();
  }

  setup() {
    rpio.open(this.pin, rpio.OUTPUT, rpio.LOW);
    this.setValue(false);
  }

  setValue(value) {
    rpio.write(this.pin, Boolean(value));
  }

  destroy() {
    rpio.close(this.pin);
  }
}

module.exports = Led;
