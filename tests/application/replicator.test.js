const expect = require('expect.js');

const Replicator = require('../../src/application/replicator');

let replicator;

describe('replicator', () => {
  describe('#constructor', () => {
    it('should require devicesManager parameter', () => {
      expect(() => new Replicator()).to.throwException((e) => {
        expect(e.message).to.contain('devicesManager');
      });
    });
  });

  describe('queue methods', () => {
    beforeEach(() => {
      replicator = new Replicator({
        devicesManager: true // replace by mock?
      });
    });

    afterEach(() => {
      replicator.destroy();
      replicator = null;
    });

    it('should mark added items as busy ones', () => {
      replicator.addToQueue('a', 'a1');
      expect(replicator.isBusy('a', 'a1')).to.be(true);
      expect(replicator.isBusy('a', 'a2')).to.be(false);
      expect(replicator.isBusy('b', 'b1')).to.be(false);
      replicator.removeFromQueue('a', 'a1');
      expect(replicator.isBusy('a', 'a1')).to.be(false);
    });

    it('should mark added items as busy ones (multi)', () => {
      replicator.addToQueue('a', 'a1');
      replicator.addToQueue('a', 'a2');
      expect(replicator.isBusy('a', 'a1')).to.be(true);
      expect(replicator.isBusy('a', 'a2')).to.be(true);
      expect(replicator.isBusy('a', 'a3')).to.be(false);
      expect(replicator.isBusy('b', 'b1')).to.be(false);
      replicator.removeFromQueue('a', 'a1');
      expect(replicator.isBusy('a', 'a1')).to.be(false);
      expect(replicator.isBusy('a', 'a2')).to.be(true);
      replicator.removeFromQueue('a', 'a2');
      expect(replicator.isBusy('a', 'a1')).to.be(false);
      expect(replicator.isBusy('a', 'a2')).to.be(false);
    });
  });
});
