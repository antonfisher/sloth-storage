// the maximum is inclusive and the minimum is inclusive
function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const SIZE_UNITS = ['B', 'Kb', 'Mb', 'Gb', 'Tb', 'Pb', 'Eb', 'Zb', 'Yb'];

function formatBytes(bytes) {
  if (bytes === null) {
    return 'N/A';
  }

  let d = 0;
  let result = bytes;

  while (result >= 1024) {
    result /= 1024;
    d++;
  }

  if (SIZE_UNITS[d]) {
    if (result === 0) {
      return `0${SIZE_UNITS[d]}`;
    } else if (result < 10) {
      return `${result.toFixed(4 - SIZE_UNITS[d].length)}${SIZE_UNITS[d]}`;
    } else if (result < 100) {
      return `${result.toFixed(3 - SIZE_UNITS[d].length)}${SIZE_UNITS[d]}`;
    } else {
      return `${result.toFixed(0)}${SIZE_UNITS[d]}`;
    }
  } else {
    return 'N/A';
  }
}

module.exports = {
  getRandomIntInclusive,
  shuffleArray,
  formatBytes
};
