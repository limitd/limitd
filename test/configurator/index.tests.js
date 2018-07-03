const sinon = require('sinon');
const assert = require('chai').assert;
const Configurator = require('../../lib/configurator');

describe('Configurator', function() {
  describe('#constructor', function() {
    it('should throw if type is not supported', function() {
      assert.throws(function() {
        new Configurator({});
      }, 'Unsupported Configurator Store Type');
    });
    it('should store currentHash', function() {
      const c = new Configurator({ store: {}, currentVal: 'test' });
      assert.exists(c.currentHash);
    });
  });

  describe('#checkForChanges', function() {
    it('should log on error', function(done) {
      const errSpy = sinon.spy();
      const c = new Configurator({
        store: {
          fetch: (cb) => {
            return cb(new Error());
          }
        }, currentVal: 'test',
        logger: {
          error: errSpy,
          info: (msg) => {
            assert.equal(msg, 'Configurator: fetching config');
          }
        }
      });
      c.checkForChanges();
      process.nextTick(() => {
        assert(errSpy.calledOnce);
        done();
      });
    });
    it('should emit and update on new hash', function(done) {
      const c = new Configurator({
        store: {
          fetch: (cb) => {
            return cb(null, 'testnew');
          }
        }, currentVal: 'test',
        logger: {
          info: (msg) => {
            assert.equal(msg, 'Configurator: fetching config');
          }
        },
        metrics: {
          histogram: (key, val) => {
            assert.equal(key, 'configurator.fetch');
            assert.isNumber(val);
          }
        }
      });
      c.once('changed', (hash) => {
        assert.exists(hash);
        done();
      });
      c.checkForChanges();
    });
  });

  describe('#startPolling', function() {
    it('should call #checkForChanges', function(done) {
      const c = new Configurator({ store: {}, currentVal: 'test' });
      c.pollInterval = 30;
      c.checkForChanges = function() {
        clearInterval(c.scheduledInterval);
        done();
      };
      c.startPolling();
    });
  });
});
