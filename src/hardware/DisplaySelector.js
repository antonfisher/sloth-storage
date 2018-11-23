const Selector = require('./drivers/Selector');

const OPTIONS = {
  CAPACITY_TOTAL: 'CAPACITY_TOTAL',
  CAPACITY_USED: 'CAPACITY_USED',
  CAPACITY_FREE: 'CAPACITY_FREE',
  TIME: 'TIME',
  ERROR: 'ERROR',
  SYNC_STATUS: 'SYNC_STATUS',
  DRIVES: 'DRIVES',
  IP: 'IP'
};

const PIN_MAP = {
  14: OPTIONS.CAPACITY_USED,
  15: OPTIONS.CAPACITY_TOTAL,
  18: OPTIONS.CAPACITY_FREE,
  17: OPTIONS.TIME,
  27: OPTIONS.ERROR,
  22: OPTIONS.SYNC_STATUS,
  23: OPTIONS.DRIVES,
  24: OPTIONS.IP
};

class DisplaySelector extends Selector {
  constructor() {
    super(PIN_MAP);
  }
}

DisplaySelector.OPTIONS = OPTIONS;

module.exports = DisplaySelector;
