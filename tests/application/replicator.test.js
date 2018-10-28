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
        idleTimeout: 10000,
        devicesManager: true // replace by mock?
      });
    });

    afterEach(() => {
      replicator.destroy();
      replicator = null;
    });

    it('should mark only added device/relativePath as ready to read', () => {
      replicator._addToQueue('a', 'a1');
      expect(replicator.isReady('a', 'a1')).to.be(true);
      expect(replicator.isReady('b', 'a1')).to.be(false);
      expect(replicator.isReady('b', 'b1')).to.be(true);
      replicator._popFromQueue('a', 'a1');
      expect(replicator.isReady('b', 'a1')).to.be(true);
    });

    it('should mark added items as busy ones (multi)', () => {
      replicator._addToQueue('a', 'a1');
      replicator._addToQueue('a', 'a2');
      expect(replicator.isReady('a', 'a1')).to.be(true);
      expect(replicator.isReady('b', 'a1')).to.be(false);
      expect(replicator.isReady('a', 'a2')).to.be(true);
      expect(replicator.isReady('b', 'a2')).to.be(false);

      const [dev1, path1] = replicator._popFromQueue();
      expect(dev1).to.be('a');
      expect(path1).to.be('a1');
      expect(replicator.isReady('a', 'a1')).to.be(true);
      expect(replicator.isReady('b', 'a1')).to.be(true);
      expect(replicator.isReady('a', 'a2')).to.be(true);
      expect(replicator.isReady('b', 'a2')).to.be(false);

      const [dev2, path2] = replicator._popFromQueue();
      expect(dev2).to.be('a');
      expect(path2).to.be('a2');
      expect(replicator.isReady('a', 'a1')).to.be(true);
      expect(replicator.isReady('b', 'a1')).to.be(true);
      expect(replicator.isReady('a', 'a2')).to.be(true);
      expect(replicator.isReady('b', 'a2')).to.be(true);

      const [dev3, path3] = replicator._popFromQueue();
      expect(dev3).to.be(null);
      expect(path3).to.be(null);
      expect(replicator.isReady('a', 'a1')).to.be(true);
      expect(replicator.isReady('b', 'a1')).to.be(true);
      expect(replicator.isReady('a', 'a2')).to.be(true);
      expect(replicator.isReady('b', 'a2')).to.be(true);
    });
  });
});
