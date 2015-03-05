var LimitdClient = require('..').Client;
var assert = require('chai').assert;


describe('LimitdClient when server is off', function () {

  it('should return "socket is closed" error', function (done) {
    var client = new LimitdClient({
      host: '10.0.0.123'
    });

    client.take('ip', 'foo', 1, function (err) {
      assert.equal(err.message, 'The socket is closed.');
      done();
    });
  });

  it('should return "socket is closed" error 2', function () {
    var client = new LimitdClient({
      host: '10.0.0.123'
    });

    try {
      client.take('ip', 'foo');
    }catch (err) {
      assert.equal(err.message, 'The socket is closed.');
    }
  });

});