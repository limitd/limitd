var LimitdServer = require('../server');

var Socket = require('net').Socket;
var rimraf = require('rimraf');

describe('limitd server - wrong request', function () {
  before(function (done) {
    var db_file = __dirname + '/dbs/unexpected_conditions.db';
    try{
      rimraf.sync(db_file);
    } catch(err){}
    LimitdServer.start({
      config_file: __dirname + '/fixture.yml',
      db: db_file
    }, function (err, addr) {
      if (err) return done(err);
      address = addr;
      done();
    });
  });

  after(function () {
    LimitdServer.stop();
  });

  it('should disconnect the socket on unknown message', function (done) {
    var socket = new Socket();
    var ResponseMessage  = require('../messages').Response;
    // I'm going to make the server fail by sending a Response message from the client.
    socket.connect(address.port, address.address)
      .once('connect', function () {
        socket.write(new ResponseMessage({
          request_id: '123',
          conformant: false
        }).encodeDelimited().toBuffer());
      }).once('close', function () {
        done();
      });

  });

});