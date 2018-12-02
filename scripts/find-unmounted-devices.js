#!/usr/bin/node

const {join} = require('path');
const {execSync} = require('child_process');

function stringify(v) {
  if (v.length === 0) {
    return '-';
  }
  return v
    .map((i) => JSON.stringify(i))
    .join('\n')
    .replace(/^\s/, '');
}

try {
  const mountedDevices = execSync('mount')
    .toString()
    .split('\n')
    .filter((d) => d.startsWith('/'))
    .map((d) => d.replace(/^(\S+).*$/, '$1'));
  console.log(`Mounted devices:\n${stringify(mountedDevices)}\n`);

  const blockDevices = execSync('blkid')
    .toString()
    .split('\n')
    .filter((d) => d.startsWith('/dev/s'))
    .map((d) => ({
      dev: d.replace(/^([^:]*).*$/, '$1'),
      label: d.replace(/^.*LABEL="([^"]*)".*$/, '$1')
    }));
  console.log(`Connected block devices:\n${stringify(blockDevices)}\n`);

  const notMountedDevices = blockDevices.filter(({dev}) => mountedDevices.indexOf(dev) === -1);
  console.log(`Not mounted devices:\n${stringify(notMountedDevices)}\n`);

  const flagMount = process.argv.indexOf('--mount') !== -1;
  const flagUmount = process.argv.indexOf('--umount') !== -1;

  if (notMountedDevices.length === 0) {
    console.log('Nothing to do here.');
    process.exit();
  } else if (!flagMount && flagUmount) {
    console.log(`${notMountedDevices.length} devices found, add --mount flag to mount these devices to /mnt`);
    console.log(`Or add --umount flag to umount ALL devices from /mnt`);
    process.exit();
  }

  if (flagMount) {
    console.log('Do mount:');
    let count = 0;
    notMountedDevices.forEach(({dev, label}) => {
      count++;
      const mountDir = join('/mnt', label);
      const message = `mount ${dev} to ${mountDir}:`;
      try {
        console.log(`${message} mkdir:`, execSync(`mkdir -p ${mountDir}`).toString());
        console.log(`${message} mount:`, execSync(`mount -o sync ${dev} ${mountDir}`).toString());
        console.log(`${message} OK\n--- ${count} of ${notMountedDevices.length} ---`);
      } catch (e) {
        console.log(`ERROR: cannot mount '${dev}' to '${mountDir}':${e}`);
      }
    });
  } else if (flagUmount) {
    //TODO
    console.log('## NOT IMPLEMENTED');
  }
  console.log('Done.');
} catch (e) {
  console.log('ERROR:', e);
}
