var LimitdServer = require('..').Server;

var Socket = require('net').Socket;
var rimraf = require('rimraf');
var _ = require('lodash');
var path = require('path');

describe('wrong requests', function () {
  var server, address;

  before(function (done) {
    var db_file = path.join(__dirname, 'dbs', 'unexpected_conditions.db');
    try{
      rimraf.sync(db_file);
    } catch(err){}

    server = new LimitdServer(_.extend({db: db_file}, require('./fixture')));

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
    var socket = new Socket();
    var ResponseMessage  = require('../messages').Response;
    // I'm going to make the server fail by sending a Response message from the client.
    socket.connect(address.port, address.address)
      .once('connect', function () {
        socket.write(new ResponseMessage({
          request_id: '123'
        }).encodeDelimited().toBuffer());
      }).once('close', function () {
        done();
      });

  });

});