const assert = require('chai').assert;
const LimitdServer = require('..').Server;
const LimitdClient = require('limitd-client');

const rimraf   = require('rimraf');
const path     = require('path');
const _        = require('lodash');

var client;

describe('stopping a limitd server', function () {
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
      client.once('connect', () => {
        server.stop(done);
      });
    });
  });

  it('should not accept more requests', function(done) {
    client.take('ip', '211.123.12.12', function (err) {
      assert.include(err.message, 'socket is closed');
      done();
    });
  });

  it('should close the underlying database', function() {
    assert.ok(server._db._db.isClosed());
  });
});
