const assert = require('chai').assert;
const CStore = require('../../lib/configurator/stores/credstash');

describe('CredstashStore', function() {
  describe('#constructor', function() {
    it('should throw when .table is missing', function() {
      assert.throws(function() {
        new CStore({});
      }, 'CredstashStore: table required');
    });
    it('should throw when .key is missing', function() {
      assert.throws(function() {
        new CStore({table: 'test'});
      }, 'CredstashStore: key required');
    });
  });

  describe('#fetch', function() {
    it('should callback with error', function(done) {
      const c = new CStore({ table: 'test', key: 'test' });
      c.store = {
        getSecret: (params, cb) => {
          return cb(new Error());
        }
      };
      c.fetch((err) => {
        assert.exists(err);
        done();
      });
    });
    it('should callback with value', function(done) {
      const c = new CStore({ table: 'test', key: 'test' });
      c.store = {
        getSecret: (params, cb) => {
          return cb(null, {'test': 'value'});
        }
      };
      c.fetch((err, data) => {
        assert.isNull(err);
        assert.equal(data, 'value');
        done();
      });
    });
  });
});
