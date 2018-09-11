const expect = require('expect.js');

const parseCliArgs = require('../../src/application/parseCliArgs');

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

    it('"usb" should be false', (done) => {
      parseCliArgs(
        {
          argv: defaultNpmStartArgv
        },
        (options) => {
          expect(options).to.be.an('object');
          expect(options).to.have.key('usb');
          expect(options.rpi).to.be(false);
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

    it('"usb" should be true (short)', (done) => {
      parseCliArgs(
        {
          argv: [...defaultNpmStartArgv, '-U']
        },
        (options) => {
          expect(options).to.be.an('object');
          expect(options).to.have.key('usb');
          expect(options.usb).to.be(true);
          done();
        }
      );
    });

    it('"usb" should be true (long)', (done) => {
      parseCliArgs(
        {
          argv: [...defaultNpmStartArgv, '--usb']
        },
        (options) => {
          expect(options).to.be.an('object');
          expect(options).to.have.key('usb');
          expect(options.usb).to.be(true);
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
  });

  describe('check all params were passed', () => {
    it('"devicePath" should be "/tmp", "usb"/"rpi" should be true', (done) => {
      parseCliArgs(
        {
          argv: [...defaultNpmStartArgv, '--devices-path', '/tmp', '--rpi', '--usb']
        },
        (options) => {
          expect(options).to.be.an('object');
          expect(options).to.have.key('devicesPath');
          expect(options.devicesPath).to.be('/tmp');
          expect(options).to.have.key('usb');
          expect(options.usb).to.be(true);
          expect(options).to.have.key('rpi');
          expect(options.rpi).to.be(true);
          done();
        }
      );
    });
  });
});
