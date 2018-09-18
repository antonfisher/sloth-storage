class WriteInProgressMap {
  constructor() {
    this.map = {};
  }

  add(relativePath, writePath) {
    if (!this.map[relativePath]) {
      this.map[relativePath] = [];
    }
    this.map[relativePath].push(writePath);
  }

  remove(relativePath, writePath) {
    if (this.map[relativePath]) {
      this.map[relativePath] = this.map[relativePath].filter((path) => path !== writePath);
      if (this.map[relativePath].length === 0) {
        delete this.map[relativePath];
      }
    }
  }

  isBusy(relativePath, writePath) {
    if (!this.map[relativePath]) {
      return false;
    }
    return this.map[relativePath].includes(writePath);
  }
}

module.exports = WriteInProgressMap;
