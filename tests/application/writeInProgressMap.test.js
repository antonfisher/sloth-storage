const expect = require('expect.js');

const WriteInProgress = require('../../src/application/writeInProgressMap');

let writeInProgressMap;

describe('writeInProgressMap', () => {
  beforeEach(() => {
    writeInProgressMap = new WriteInProgress();
  });

  afterEach(() => {
    writeInProgressMap = null;
  });

  it('should mark added items as busy ones', () => {
    writeInProgressMap.add('a', 'a1');
    expect(writeInProgressMap.isBusy('a', 'a1')).to.be(true);
    expect(writeInProgressMap.isBusy('a', 'a2')).to.be(false);
    expect(writeInProgressMap.isBusy('b', 'b1')).to.be(false);
    writeInProgressMap.remove('a', 'a1');
    expect(writeInProgressMap.isBusy('a', 'a1')).to.be(false);
  });

  it('should mark added items as busy ones (multi)', () => {
    writeInProgressMap.add('a', 'a1');
    writeInProgressMap.add('a', 'a2');
    expect(writeInProgressMap.isBusy('a', 'a1')).to.be(true);
    expect(writeInProgressMap.isBusy('a', 'a2')).to.be(true);
    expect(writeInProgressMap.isBusy('a', 'a3')).to.be(false);
    expect(writeInProgressMap.isBusy('b', 'b1')).to.be(false);
    writeInProgressMap.remove('a', 'a1');
    expect(writeInProgressMap.isBusy('a', 'a1')).to.be(false);
    expect(writeInProgressMap.isBusy('a', 'a2')).to.be(true);
    writeInProgressMap.remove('a', 'a2');
    expect(writeInProgressMap.isBusy('a', 'a1')).to.be(false);
    expect(writeInProgressMap.isBusy('a', 'a2')).to.be(false);
  });
});
