const assert = require('chai').assert;
const FileStore = require('../../lib/configurator/stores/file');

describe('FileStore', function() {
  describe('#constructor', function() {
    it('should throw when .path is missing', function() {
      assert.throws(function() {
        new FileStore({});
      }, 'FileStore: path required');
    });
  });

  describe('#fetch', function() {
    it('should callback with error', function(done) {
      const c = new FileStore({ path: './test.txt' });
      c.fetch((err) => {
        assert.exists(err);
        done();
      });
    });
    it('should callback with value', function(done) {
      const c = new FileStore({ path: `${__dirname}/../fixture/fixture-configurator.yml` });
      c.fetch((err, data) => {
        assert.isNull(err);
        done();
      });
    });
  });
});
