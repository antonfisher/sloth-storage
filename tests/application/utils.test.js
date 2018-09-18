const expect = require('expect.js');

const utils = require('../../src/application/utils');

describe('Utils', () => {
  it('#getRandomIntInclusive() should return the same int as defined in one-value range', () => {
    expect(utils.getRandomIntInclusive(0, 0)).to.be.a('number');
    expect(utils.getRandomIntInclusive(0, 0)).to.be(0);
  });

  it('#getRandomIntInclusive() should return random int from range', (done) => {
    const from = 0;
    const to = 2;
    let i = 0;

    while (i < 2) {
      const n = utils.getRandomIntInclusive(from, to);
      if (n === i) {
        i++;
      } else if (n < from || n > to) {
        return done(`#getRandomIntInclusive() generates numbers out of range [${from}, ${to}]: ${n}`);
      }
    }

    done();
  });

  it('#shuffleArray() should shuffle an array', (done) => {
    const arr = [1, 2, 3, 4, 5];
    const res = utils.shuffleArray(arr);

    expect(res).to.be.an('array');
    expect(res).to.have.length(arr.length);
    expect(res.filter((i) => arr.includes(i))).to.have.length(arr.length);
    expect(res.filter((i) => !arr.includes(i))).to.have.length(0);

    done();
  });

  it('#formatBytes() should return human readable value', (done) => {
    expect(utils.formatBytes(0)).to.be('0B');
    expect(utils.formatBytes(1)).to.be('1.000B');
    expect(utils.formatBytes(1023)).to.be('1023B');
    expect(utils.formatBytes(1024)).to.be('1.00Kb');
    expect(utils.formatBytes(1024 + 512)).to.be('1.50Kb');
    expect(utils.formatBytes(1024 + 100)).to.be('1.10Kb');
    expect(utils.formatBytes(1024 * 1024)).to.be('1.00Mb');
    expect(utils.formatBytes(1024 * 1024 * 1024)).to.be('1.00Gb');
    expect(utils.formatBytes(1024 * 1024 * 1024 * 1024)).to.be('1.00Tb');
    expect(utils.formatBytes(1024 ** 10)).to.be('N/A');
    expect(utils.formatBytes(null)).to.be('N/A');

    done();
  });
});
