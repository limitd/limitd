var LimitdServer = require('..').Server;
var LimitdClient = require('..').Client;

var assert = require('chai').assert;
var rimraf = require('rimraf');
var path   = require('path');
var client;
var _ = require('lodash');
var moment = require('moment');

///this test doesnt add any value yet
describe.skip('limitd issue 1', function () {
  var db_file = path.join(__dirname, 'dbs', 'server.tests.db');

  try{
    rimraf.sync(db_file);
  } catch(err){}

  var server;

  before(function (done) {
    server = new LimitdServer(_.extend({
      db: db_file
    }, require('./fixture'), {
      log_level: 'debug'
    }));

    server.start(function (err, address) {
      if (err) return done(err);
      client = new LimitdClient(_.extend(address, { }));
      client.once('connect', done);
    });
  });

  after(function () {
    server.stop();
  });

  afterEach(function () {
    if (Date.unfix) { Date.unfix(); }
  });

  it('should work with a simple request', function (done) {
    var start = moment();
    Date.fix(start.unix());

    client.take('once per hour', 'test', function (err) {
      if (err) return done(err);

      Date.fix(start.add(10, 'm').unix());

      client.take('once per hour', 'test', function (err, response) {
        assert.notOk(response.conformant);
        done();
      });
    });
  });

});
