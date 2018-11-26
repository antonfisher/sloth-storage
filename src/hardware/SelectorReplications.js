const rpio = require('rpio');

const Selector = require('./drivers/Selector');

const OPTIONS = {
  REPLICATION_COUNT_1: 1,
  REPLICATION_COUNT_2: 2,
  REPLICATION_COUNT_3: 3,
  REPLICATION_COUNT_4: 4
};

const PIN_MAP = {
  24: OPTIONS.REPLICATION_COUNT_1,
  21: OPTIONS.REPLICATION_COUNT_2,
  23: OPTIONS.REPLICATION_COUNT_3,
  22: OPTIONS.REPLICATION_COUNT_4
};

class SelectorReplications extends Selector {
  constructor() {
    super(PIN_MAP);
  }

  getValue() {
    const pin = super.getSelected();
    return OPTIONS[pin];
  }
}

SelectorReplications.OPTIONS = OPTIONS;

module.exports = SelectorReplications;
