const assert = require('assert');
const fs = require('fs');

class FileStore {
  constructor(config) {
    assert(config.path, 'FileStore: path required');

    this.path = config.path;
  }

  fetch(cb) {
    return fs.readFile(this.path, 'utf-8', cb);
  }
}

module.exports = FileStore;
