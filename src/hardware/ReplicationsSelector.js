const Selector = require('./drivers/Selector');

const OPTIONS = {
  REPLICATION_COUNT_1: 1,
  REPLICATION_COUNT_2: 2,
  REPLICATION_COUNT_3: 3,
  REPLICATION_COUNT_4: 4
};

const PIN_MAP = {
  10: OPTIONS.REPLICATION_COUNT_1,
  9: OPTIONS.REPLICATION_COUNT_2,
  11: OPTIONS.REPLICATION_COUNT_3,
  25: OPTIONS.REPLICATION_COUNT_4
};

class ReplicationsSelector extends Selector {
  constructor() {
    super(PIN_MAP);
  }
}

ReplicationsSelector.OPTIONS = OPTIONS;

module.exports = ReplicationsSelector;
