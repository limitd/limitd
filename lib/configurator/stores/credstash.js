const assert = require('assert');
const Credstash = require('nodecredstash');

class CredstashStore {
  constructor(config) {
    assert(config.table, 'CredstashStore: table required');
    assert(config.key, 'CredstashStore: key required');

    this.key = config.key;
    this.store = new Credstash({
      table: config.table
    });
  }

  fetch(cb) {
    return this.store.getSecret({ name: this.key }, (err, val) => {
      if (err) {
        return cb(err);
      }

      return cb(err, val[this.key]);
    });
  }
}

module.exports = CredstashStore;
