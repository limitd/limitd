const fs = require('fs');
const yaml = require('js-yaml');
const assert = require('assert');

const MISSING_BUCKET_CONFIG = new Error('missing bucket configuration');

class FileStore {
  constructor(config) {
    assert(config.path, 'FileStore: path required');

    this.path = config.path;
  }

  fetch(cb) {
    fs.readFile(this.path, 'utf-8', (err, file) => {
      if (err) {
        return cb(err);
      }
      let data;
      try {
        data = yaml.load(file);
      } catch(err) {
        return cb(err);
      }
      if (data.buckets == null) {
        return cb(MISSING_BUCKET_CONFIG);
      }
      return cb(null, data.buckets);
    });
  }
}

module.exports = FileStore;
