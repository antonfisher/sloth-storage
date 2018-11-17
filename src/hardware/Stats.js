const osUtils = require('os-utils');

function Stats(pauseBetweenUpdates = 500) {
  this._updateTimeout = null;

  const update = () => {
    osUtils.cpuUsage((cpuUsage) => {
      //const cpuUsage = Math.ceil(value * 100);
      const memUsage = osUtils.freememPercentage();
      console.log('-- cpu stats', cpuUsage, memUsage);
      this.onUpdateHandler({cpuUsage, memUsage});
      this._updateTimeout = setTimeout(() => update(), pauseBetweenUpdates);
    });
  };

  update();
}

Stats.prototype.onUpdate = function(callback) {
  this.onUpdateHandler = callback;
};

Stats.prototype.destroy = function() {
  clearTimeout(this._updateTimeout);
};

module.exports = Stats;
