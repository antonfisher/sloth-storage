const expect = require('expect.js');

const {CODES, createError, createNotExistError} = require('../src/errorHelpers');

describe('errorHelpers', () => {
  it('#createError() should return default error with code ENOENT', () => {
    const err = createError('lol', 'LOLCODE');
    expect(err).to.be.an(Error);
    expect(err).to.have.property('code', 'LOLCODE');
    expect(err.toString()).to.contain('lol');
  });

  it('#createNotExistError() should return default error with code ENOENT', () => {
    const err = createNotExistError('lol');
    expect(err).to.be.an(Error);
    expect(err).to.have.property('code', CODES.ENOENT);
    expect(err.toString()).to.contain('lol');
  });
});
