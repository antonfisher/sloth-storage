const expect = require('expect.js');
const {exec} = require('./utils');

const parseCliArgs = require('../src/parseCliArgs');

const defaultNpmStartArgv = ['/usr/local/bin/node', '/home/af/js/sloth-storage/src/index.js'];

describe('#parseCliArgs()', () => {
  describe('check default params', () => {
    it('"devicePath" should be null', (done) => {
      parseCliArgs(
        {
          argv: defaultNpmStartArgv
        },
        (options) => {
          expect(options).to.be.an('object');
          expect(options).to.have.key('devicesPath');
          expect(options.devicesPath).to.be(null);
          done();
        }
      );
    });

    it('"rpi" should be false', (done) => {
      parseCliArgs(
        {
          argv: defaultNpmStartArgv
        },
        (options) => {
          expect(options).to.be.an('object');
          expect(options).to.have.key('rpi');
          expect(options.rpi).to.be(false);
          done();
        }
      );
    });
  });

  describe('check passed params', () => {
    it('"devicePath" should be "/tmp" (short)', (done) => {
      parseCliArgs(
        {
          argv: [...defaultNpmStartArgv, '-D', '/tmp']
        },
        (options) => {
          expect(options).to.be.an('object');
          expect(options).to.have.key('devicesPath');
          expect(options.devicesPath).to.be('/tmp');
          done();
        }
      );
    });

    it('"devicePath" should be "/tmp" (long)', (done) => {
      parseCliArgs(
        {
          argv: [...defaultNpmStartArgv, '--devices-path', '/tmp']
        },
        (options) => {
          expect(options).to.be.an('object');
          expect(options).to.have.key('devicesPath');
          expect(options.devicesPath).to.be('/tmp');
          done();
        }
      );
    });

    it('"rpi" should be true (short)', (done) => {
      parseCliArgs(
        {
          argv: [...defaultNpmStartArgv, '-R']
        },
        (options) => {
          expect(options).to.be.an('object');
          expect(options).to.have.key('rpi');
          expect(options.rpi).to.be(true);
          done();
        }
      );
    });

    it('"rpi" should be true (long)', (done) => {
      parseCliArgs(
        {
          argv: [...defaultNpmStartArgv, '--rpi']
        },
        (options) => {
          expect(options).to.be.an('object');
          expect(options).to.have.key('rpi');
          expect(options.rpi).to.be(true);
          done();
        }
      );
    });

    //TODO fails on TravisCI
    xit('"--help" should show help and exit', (done) => {
      try {
        const result = exec('npm start -- --help').toString();
        expect(result).to.contain('Examples:');
        done();
      } catch (e) {
        done(e);
      }
    });
  });

  describe('check all params were passed', () => {
    it('"devicePath" should be "/tmp", "rpi" should be true', (done) => {
      parseCliArgs(
        {
          argv: [...defaultNpmStartArgv, '--devices-path', '/tmp', '--rpi']
        },
        (options) => {
          expect(options).to.be.an('object');
          expect(options).to.have.key('devicesPath');
          expect(options.devicesPath).to.be('/tmp');
          expect(options).to.have.key('rpi');
          expect(options.rpi).to.be(true);
          done();
        }
      );
    });
  });
});
