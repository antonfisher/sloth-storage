const Selector = require('./drivers/Selector');

const OPTIONS = {
  CAPACITY_USED: 'CAPACITY_USED',
  CAPACITY_TOTAL: 'CAPACITY_TOTAL',
  CAPACITY_FREE: 'CAPACITY_FREE',
  TIME: 'TIME',
  ERROR: 'ERROR',
  SYNC_STATUS: 'SYNC_STATUS',
  DRIVES: 'DRIVES',
  IP: 'IP'
};

const PIN_MAP = {
  7: OPTIONS.CAPACITY_USED,
  19: OPTIONS.CAPACITY_TOTAL,
  12: OPTIONS.CAPACITY_FREE,
  11: OPTIONS.TIME,
  13: OPTIONS.ERROR,
  15: OPTIONS.SYNC_STATUS,
  16: OPTIONS.DRIVES,
  18: OPTIONS.IP
};

class SelectorDisplay extends Selector {
  constructor() {
    super(PIN_MAP);
  }
}

SelectorDisplay.OPTIONS = OPTIONS;

module.exports = SelectorDisplay;
