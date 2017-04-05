const LimitdServer = require('..').Server;
const LimitdClient = require('limitd-client');

const assert   = require('chai').assert;
const expect   = require('chai').expect;
const rimraf   = require('rimraf');
const path     = require('path');
const async    = require('async');
const _        = require('lodash');
const MockDate = require('mockdate');

var client;
describe('limitd server', function () {
  var db_file = path.join(__dirname, 'dbs', 'server.tests.db');

  try{
    rimraf.sync(db_file);
  } catch(err){}

  const db_options = { db: db_file };

  var server;

  before(function (done) {
    server = new LimitdServer(_.extend(db_options, require('./fixture')));

    server.start(function (err, address) {
      if (err) return done(err);
      client = new LimitdClient(`limitd://localhost:${address.port}`);
      client.once('connect', done);
    });
  });

  after(function () {
    server.stop();
  });

  afterEach(function () {
    MockDate.reset();
  });

  describe('TAKE', function () {
    it('should work with a simple request', function (done) {
      var now = 1425920267;
      MockDate.set(now * 1000);
      client.take('ip', '211.123.12.12', function (err, response) {
        if (err) return done(err);
        assert.ok(response.conformant);
        assert.equal(response.remaining, 9);
        assert.equal(response.reset, now + 1);
        assert.equal(response.limit, 10);
        done();
      });
    });

    it('should work with a fixed bucket', function (done) {
      async.map(_.range(0, 3), function (i, cb) {
        client.take('wrong_password', 'tito', cb);
      }, function (err, results) {
        if (err) return done(err);
        assert.ok(results.every(function (r) {
          return r.conformant;
        }));
        client.take('wrong_password', 'tito', function (err, response) {
          assert.notOk(response.conformant);
          done();
        });
      });
    });

    it('should work with an override on a fixed bucket', function (done) {
      async.map(_.range(2), function (i, cb) {
        client.take('wrong_password', 'dudu', cb);
      }, function (err, results) {
        if (err) return done(err);
        assert.ok(results.every(function (r) {
          return r.conformant;
        }));
        client.take('wrong_password', 'dudu', function (err, response) {
          assert.notOk(response.conformant);
          done();
        });
      });
    });

    it('should return false when traffic is not conformant', function (done) {
      async.map(_.range(0, 10), function (i, cb) {
        client.take('ip', '211.123.12.24', cb);
      }, function (err, responses) {
        if (err) return done(err);
        assert.ok(responses.every(function (r) { return r.conformant; }));
        client.take('ip', '211.123.12.24', function (err, response) {
          assert.notOk(response.conformant);
          done();
        });
      });
    });

    it('should be conformant if an override allows it', function (done) {
      async.each(_.range(0, 10), function (i, cb) {
        client.take('ip', '127.0.0.1', cb);
      }, function (err) {
        if (err) return done(err);
        client.take('ip', '127.0.0.1', function (err, response) {
          assert.ok(response.conformant);
          done();
        });
      });
    });

    it('should be conformant if an override with regex allows it', function (done) {
      async.each(_.range(0, 10), function (i, cb) {
        client.take('ip', '127.4.4.4', cb);
      }, function (err) {
        if (err) return done(err);
        client.take('ip', '127.4.4.4', function (err, response) {
          assert.ok(response.conformant);
          done();
        });
      });
    });

    it('can expire an override', function (done) {
      async.each(_.range(0, 10), function (i, cb) {
        client.take('ip', '10.0.0.123', cb);
      }, function (err) {
        if (err) return done(err);
        client.take('ip', '10.0.0.123', function (err, response) {
          assert.notOk(response.conformant);
          done();
        });
      });
    });

    it('should use seconds ceiling for next reset', function (done) {
      // it takes ~1790 msec to fill the bucket with this test
      var now = 1425920267;
      MockDate.set(now * 1000);
      var requests = _.map(_.range(0, 9), function(){
        return function (cb) {
          client.take('ip', '211.123.12.36', cb);
        };
      });
      async.series(requests, function (err, results) {
        if (err) return done(err);
        var lastResponse = results[results.length -1];
        assert.ok(lastResponse.conformant);
        assert.equal(lastResponse.remaining, 1);
        assert.equal(lastResponse.reset, now + 2);
        assert.equal(lastResponse.limit, 10);
        done();
      });
    });

    it('should set reset to UNIX timestamp regardless of period', function(done){
      var now = 1425920267;
      MockDate.set(now * 1000);
      client.take('ip', '10.0.0.1', function (err, response) {
        if (err) { return done(err); }
        assert.ok(response.conformant);
        assert.equal(response.remaining, 0);
        assert.equal(response.reset, now + 1800);
        assert.equal(response.limit, 1);
        done();
      });
    });

    it('should work for unlimited', function (done) {
      var now = 1425920267;
      MockDate.set(now * 1000);
      client.take('ip', '0.0.0.0', function (err, response) {
        if (err) return done(err);
        assert.ok(response.conformant);
        assert.equal(response.remaining, 100);
        assert.equal(response.reset, now);
        assert.equal(response.limit, 100);
        done();
      });
    });

  });

  describe('WAIT', function () {
    it('should work with a simple request', function (done) {
      var now = 1425920267;
      MockDate.set(now * 1000);
      client.wait('ip', '211.76.23.4', function (err, response) {
        if (err) return done(err);
        assert.ok(response.conformant);
        assert.notOk(response.delayed);


        assert.equal(response.remaining, 9);
        assert.equal(response.reset, now + 1);

        done();
      });
    });


    it('should be delayed when traffic is non conformant', function (done) {
      client.take('ip', '211.76.23.5', 10, function (err) {
        if (err) return done(err);
        var waitingSince = Date.now();
        client.wait('ip', '211.76.23.5', 3, function (err, response) {
          var waited = Date.now() - waitingSince;
          assert.ok(response.conformant);
          assert.ok(response.delayed);
          expect(waited).to.be.closeTo(600, 100);
          done();
        });
      });
    });

  });

  it('should fail when the bucket type doesnt exist', function (done) {
    client.take('blabla', '211.123.12.12', function (err) {
      assert.equal(err.message, 'Invalid bucket type');
      done();
    });
  });

  it('should autoremove unused buckets', function (done) {
    client.take('ip', '211.45.66.1', function (err) {
      if (err) return done(err);
      setTimeout(function () {
        server._db._types['ip'].db.get('211.45.66.1', function (err, result) {
          assert.isUndefined(result);
          done();
        });
      }, 2200);
    });
  });


  describe('PUT', function () {
    it('should restore the bucket when reseting', function (done) {
      client.take('ip', '211.123.12.12', function (err) {
        if (err) return done(err);
        client.put('ip', '211.123.12.12', function (err, result) {
          if (err) return done(err);
          client.take('ip', '211.123.12.12', function (err, response) {
            if (err) return done(err);
            assert.equal(response.remaining, 9);
            done();
          });
        });
      });
    });

    it('should be able to reset without callback', function (done) {
      client.take('ip', '211.123.5.12', function (err, response) {
        if (err) return done(err);

        client.put('ip', '211.123.5.12', 1);

        setTimeout(function (){
          client.take('ip', '211.123.5.12', function (err, response) {
            if (err) return done(err);
            assert.equal(response.remaining, 9);
            done();
          });
        }, 100);
      });
    });

    it('should be able to fully reset the bucket', function (done) {
      client.take('ip', '211.1.1.12', 5, function (err, response) {
        if (err) return done(err);
        assert.equal(response.remaining, 5);

        client.put('ip', '211.1.1.12', function (err, response) {
          if (err) return done(err);
          assert.equal(response.remaining, 10);

          client.take('ip', '211.1.1.12', function (err, response) {
            if (err) return done(err);
            assert.equal(response.remaining, 9);
            done();
          });
        });
      });
    });

    it('should work for a fixed bucket', function (done) {
      client.take('wrong_password', 'calocalaccc', function (err, response) {
        assert.ok(response.conformant);
        client.reset('wrong_password', 'calocalaccc', function (err, response) {
          if (err) return done(err);
          assert.equal(response.remaining, 3);
          done();
        });
      });
    });

    it('should work for a fixed bucket (override)', function (done) {
      client.take('wrong_password', 'dudu2', function (err, response) {
        assert.ok(response.conformant);
        client.reset('wrong_password', 'dudu2', function (err, response) {
          if (err) return done(err);
          assert.equal(response.remaining, 2);
          done();
        });
      });
    });
  });

  describe('ping', function () {

    it('should work', function (done) {
      client.ping(function (err) {
        if (err) return done(err);
        done();
      });
    });

  });

  describe('STATUS', function () {

    it('should work', function (done) {
      var ip = '211.11.84.12';

      client.take('ip', ip, function (err) {
        if (err) return done(err);
        client.status('ip', ip, function (err, response) {
          if (err) return done(err);
          assert.equal(response.items[0].remaining, 9);
          done();
        });
      });
    });

    it('should work for unlimited', function (done) {
      var now = 1425920267;
      MockDate.set(now * 1000);
      client.take('ip', '0.0.0.0', function (err) {
        if (err) return done(err);
        client.status('ip', '0.0.0.0', function (err, response) {
          if (err) return done(err);
          assert.equal(response.items.length, 0);
          done();
        });
      });
    });

    it('should work for fixed buckets', function (done) {
      client.take('wrong_password', 'curichiaga', function (err) {
        if (err) return done(err);
        client.status('wrong_password', 'curichiaga', function (err, response) {
          if (err) return done(err);
          assert.equal(response.items[0].remaining, 2);
          done();
        });
      });
    });


    it('should not return fulfilled fixed buckets', function (done) {
      client.take('wrong_password', 'catrasca', function (err) {
        if (err) return done(err);
        client.put('wrong_password', 'catrasca', function (err) {
          if (err) return done(err);
          client.status('wrong_password', 'catrasca', function (err, response) {
            if (err) return done(err);
            assert.equal(response.items.length, 0);
            done();
          });
        });
      });
    });

    it('should not fail if bucket doesnt exists', function (done) {
      client.status('ip', '12312312321312321', function (err, response) {
        if (err) return done(err);
        assert.equal(response.items.length, 0);
        done();
      });
    });

    it.skip('should work with subclasses', function (done) {

      async.parallel([
        function (cb) { client.take('ip', 'class1|192.123.21.1', cb); },
        function (cb) { client.take('ip', 'class1|192.123.21.2', cb); },
        function (cb) { client.take('ip', 'class1|192.123.21.2', cb); },
        function (cb) { client.take('ip', 'class2|192.123.21.3', cb); },
      ], function (err) {
        if (err) return done(err);
        //this will retrieve all bucket instances of ip - class1
        client.status('ip', 'class1', function (err, response) {
          if (err) return done(err);
          assert.equal(response.items.length, 2);
          assert.equal(response.items[0].remaining, 9);
          assert.equal(response.items[0].instance, 'class1|192.123.21.1');
          assert.equal(response.items[1].remaining, 8);
          assert.equal(response.items[1].instance, 'class1|192.123.21.2');
          done();
        });
      });

    });

  });
});


