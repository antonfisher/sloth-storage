const rpio = require('rpio');

const BLINK_ONCE_DURATION = 500;

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

  blinkOnce() {
    const currentState = rpio.read(this.pin);

    this._clearTimeouts();
    this.setValue(!currentState);
    this._blinkOnceTimeout = setTimeout(() => {
      this.setValue(this.currentState);
    }, BLINK_ONCE_DURATION);
  }

  setValue(value) {
    this._clearTimeouts();
    rpio.write(this.pin, Boolean(value) ? rpio.HIGH : rpio.LOW);
  }

  setBlink(value) {
    this._clearTimeouts();
    if (value) {
      this._blinkInterval = setInterval(() => {
        rpio.write(this.pin, rpio.HIGH);
        clearTimeout(this._blinkTimeout);
        this._blinkTimeout = setTimeout(() => {
          rpio.write(this.pin, rpio.LOW);
        }, 0);
      }, 10);
    } else {
      rpio.write(this.pin, rpio.LOW);
    }
  }

  _clearTimeouts() {
    clearInterval(this._blinkInterval);
    clearInterval(this._blinkTimeout);
    clearTimeout(this._blinkOnceTimeout);
  }

  destroy() {
    this.setValue(false);
    rpio.close(this.pin);
  }
}

module.exports = Led;
