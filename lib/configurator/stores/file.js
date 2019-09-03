const fs = require('fs');
const yaml = require('js-yaml');
const assert = require('assert');
const configValidator = require('../../config_validator');

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
      let error = configValidator(data);
      if (error) {
        return cb(new Error(error));
      }
      return cb(null, data.buckets);
    });
  }
}

module.exports = FileStore;
