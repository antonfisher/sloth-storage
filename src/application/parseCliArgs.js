const commander = require('commander');

const DEFAULT_OPTION = {
  DEVICES_PATH: null,
  RPI: false
};

function parseCliArgs({argv, version, description, homepage}, callback) {
  commander
    .description(`${description} (${homepage})`)
    .usage('[options]')
    .option(
      '-D, --devices-path <path>',
      'use folders in this path as devices, if null usb drives will be used',
      (path) => (path ? String(path) : null),
      DEFAULT_OPTION.DEVICES_PATH
    )
    .option('-R, --rpi', 'run on RaspberryPi with hardware controls')
    .version(version, '-v, --version')
    .on('--help', () => {
      console.log('');
      console.log('  Examples:');
      console.log('');
      console.log('    $ sloth-storage                                   # run and discover usb devices');
      console.log('    $ sloth-storage -d /tmp/my-demo-dir-with-subdirs  # run folders demo');
      console.log('');
    });

  commander.parse(argv);

  callback({
    devicesPath: commander.devicesPath,
    rpi: commander.rpi || DEFAULT_OPTION.RPI
  });
}

module.exports = parseCliArgs;
