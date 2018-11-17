const PhatDisplayWrapper = require('./drivers/PhatDisplayWrapper');

const DEFAULT_PAUSE_BETWEEN_UPDATES = 500;

function Display() {
  this.phatDisplayWrapper = new PhatDisplayWrapper();
  return this;
}

UsageDisplay.prototype.setValue = function({cpuUsage, memUsage}) {
  const cpuUsageText = String(Math.ceil(cpuUsage * 100)).padStart(2, '0');
  const memUsageText = String(Math.ceil((1 - memUsage) * 100)).padStart(2, '0');
  this.phatDisplayWrapper.writeString(`${cpuUsageText}%${memUsageText}m`);
};

UsageDisplay.prototype.destroy = function() {
  this.phatDisplayWrapper.destroy();
  delete this.phatDisplayWrapper;
};

module.exports = UsageDisplay;
