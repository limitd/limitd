const LimitdServer = require('..').Server;

const Socket = require('net').Socket;
const rimraf = require('rimraf');
const _ = require('lodash');
const path = require('path');
const lps = require('length-prefixed-stream');

describe('wrong requests', function () {
  var server, address;

  before(function (done) {
    const db_file = path.join(__dirname, 'dbs', 'unexpected_conditions.db');

    try{
      rimraf.sync(db_file);
    } catch(err){}

    server = new LimitdServer(_.extend({
      db: db_file
    }, require('./fixture'), {
      log_level: 'fatal'
    }));

    server.start(function (err, addr) {
      if (err) return done(err);
      address = addr;
      done();
    });
  });

  after(function () {
    server.stop();
  });

  it('should disconnect the socket on unknown message', function (done) {
    const socket = new Socket();
    const Response  = require('limitd-protocol').Response;
    // I'm going to make the server fail by sending a Response message from the client.
    socket.connect(address.port, address.address)
      .once('connect', function () {
        const stream = lps.encode();
        stream.pipe(socket);
        stream.write(Response.encode({ request_id: '123' }));
      }).once('close', function () {
        done();
      });

  });

});
