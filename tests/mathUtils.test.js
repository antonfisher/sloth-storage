const mathUtils = require('../src/mathUtils');

describe('mathUtils', () => {
  it('Should return random int from range', (done) => {
    const from = 0;
    const to = 2;
    let i = 0;

    while (i < 2) {
      const n = mathUtils.getRandomIntInclusive(from, to);
      if (n === i) {
        i++;
      } else if (n < from || n > to) {
        return done(`getRandomIntInclusive() generates numbers out of range [${from}, ${to}]: ${n}`);
      }
    }

    done();
  });
});
