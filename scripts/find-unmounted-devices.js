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

  const devicesToUnmount = mountedDevices.filter((d) => d.startsWith('/dev/s'));

  const flagMount = process.argv.indexOf('--mount') !== -1;
  const flagUmount = process.argv.indexOf('--umount') !== -1;

  if (!flagMount && !flagUmount) {
    if (notMountedDevices.length === 0) {
      console.log(`No unmounted USB devices found.`);
    } else {
      console.log(
        `${notMountedDevices.length} unmounted USB devices found, add --mount flag to mount these devices to /mnt`
      );
    }
    if (devicesToUnmount.length > 0) {
      console.log(
        `${devicesToUnmount.length} mounted USB devices found, add --umount flag to unmount these device and delete ` +
          `mount point from /mnt`
      );
    }
    process.exit();
  }

  if (flagMount) {
    if (notMountedDevices.length === 0) {
      console.log('Nothing to do there.');
      process.exit();
    }

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
        console.log(`ERROR: cannot mount '${dev}' to '${mountDir}': ${e}`);
      }
    });
  } else if (flagUmount) {
    if (devicesToUnmount.length === 0) {
      console.log('No USB devices found to unmount');
      process.exit();
    }
    let count = 0;
    devicesToUnmount.forEach((dev) => {
      count++;
      const message = `umount ${dev}:`;
      try {
        console.log(`${message} umount:`, execSync(`umount ${dev}`).toString());
        console.log(`${message} rm dir:`, execSync(`rm -r ${dev}`).toString());
        console.log(`${message} OK\n--- ${count} of ${devicesToUnmount.length} ---`);
      } catch (e) {
        console.log(`ERROR: cannot umount '${dev}': ${e}`);
      }
    });
  }
  console.log('Done.');
} catch (e) {
  console.log('ERROR:', e);
}
