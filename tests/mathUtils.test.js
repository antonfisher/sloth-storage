const expect = require('expect.js');

const mathUtils = require('../src/mathUtils');

describe('mathUtils', () => {
  it('#getRandomIntInclusive() should return the same int as defined in one-value range', () => {
    expect(mathUtils.getRandomIntInclusive(0, 0)).to.be.a('number');
    expect(mathUtils.getRandomIntInclusive(0, 0)).to.be(0);
  });

  it('#getRandomIntInclusive() should return random int from range', (done) => {
    const from = 0;
    const to = 2;
    let i = 0;

    while (i < 2) {
      const n = mathUtils.getRandomIntInclusive(from, to);
      if (n === i) {
        i++;
      } else if (n < from || n > to) {
        return done(`#getRandomIntInclusive() generates numbers out of range [${from}, ${to}]: ${n}`);
      }
    }

    done();
  });
});
