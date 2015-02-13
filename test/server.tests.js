var LimitdServer = require('../server');
var LimitdClient = require('../client');

var assert = require('chai').assert;
var expect = require('chai').expect;
var rimraf = require('rimraf');
var client;

var async = require('async');
var _ = require('lodash');

describe('limitd server', function () {
  var server;

  before(function (done) {
    var db_file = __dirname + '/dbs/server.tests.db';

    try{
      rimraf.sync(db_file);
    } catch(err){}

    server = new LimitdServer(_.extend({db: db_file}, require('./fixture')));

    server.start(function (err, address) {
      if (err) return done(err);
      client = new LimitdClient(address);
      client.once('connect', done);
    });
  });

  after(function () {
    server.close();
  });

  describe('TAKE', function () {
    it('should work with a simple request', function (done) {
      client.take('ip', '211.123.12.12', function (err, response) {
        if (err) return done(err);
        assert.ok(response.conformant);
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

    it('should return false when traffic is not conformant', function (done) {
      async.each(_.range(0, 10), function (i, cb) {
        client.take('ip', '211.123.12.24', cb);
      }, function (err) {
        if (err) return done(err);
        client.take('ip', '211.123.12.24', function (err, response) {
          assert.notOk(response.conformant);
          done();
        });
      });
    });
  });


  describe('WAIT', function () {
    it('should work with a simple request', function (done) {
      client.wait('ip', '211.76.23.4', function (err, response) {
        if (err) return done(err);
        assert.ok(response.conformant);
        assert.notOk(response.delayed);

        done();
      });
    });


    it('should return false when traffic is not conformant', function (done) {
      async.each(_.range(0, 10), function (i, cb) {
        client.wait('ip', '211.76.23.5', cb);
      }, function (err) {
        if (err) return done(err);
        var waitingSince = Date.now();
        client.wait('ip', '211.76.23.5', 3, function (err, response) {
          assert.ok(response.conformant);
          assert.ok(response.delayed);
          expect(Date.now() - waitingSince).to.be.within(580, 620);
          done();
        });
      });
    });
  });

  it('should fail when the bucket class doesnt exist', function (done) {
    client.take('blabla', '211.123.12.12', function (err) {
      assert.equal(err.message, 'blabla is not a valid bucket class');
      done();
    });
  });

  it('should autoremove unused buckets', function (done) {
    client.take('ip', '211.45.66.1', function (err) {
      if (err) return done(err);
      setTimeout(function () {
        server._db.get('ÿipÿ211.45.66.1', function (err, result) {
          assert.isUndefined(result);
          done();
        });
      }, 2200);
    });
  });

});