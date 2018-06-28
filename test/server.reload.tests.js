const LimitdServer = require('..').Server;
const LimitdClient = require('limitd-client');
const parser = require('../conf/parser/file');

const assert   = require('chai').assert;
const rimraf   = require('rimraf');
const path     = require('path');
const _        = require('lodash');
const MockDate = require('mockdate');

var client;
describe('limitd server config reloading', function () {
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

  after(function (done) {
    server.stop(done);
  });

  afterEach(function () {
    MockDate.reset();
  });

  it('should work with a simple request before reloading', function (done) {
    var now = 1425920267;
    MockDate.set(now * 1000);
    client.take('ip', '211.123.12.12', function (err, response) {
      if (err) return done(err);
      assert.ok(response.conformant);
      assert.equal(response.remaining, 9);
      done();
    });
  });

  it('should work with a simple request after reloading', function (done) {
    var now = 1425920297;
    MockDate.set(now * 1000);

    var newConfig = parser.parse(`${__dirname}/fixture/fixture-remote.yml`);

    server._db.close(function() {
      server._reloadDB({ types: newConfig.buckets });
      setTimeout(function() {
        client.take('ip', '211.123.12.12', function (err, response) {
          if (err) return done(err);
          assert.ok(response.conformant);
          assert.equal(response.remaining, 19);
          done();
        });
      }, 1000);
    });
  });
});