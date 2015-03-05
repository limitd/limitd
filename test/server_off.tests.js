var LimitdClient = require('..').Client;
var assert = require('chai').assert;


describe('LimitdClient when server is off', function () {

  it('should disconnect the socket on unknown message', function (done) {
    var client = new LimitdClient({
      host: '10.0.0.123'
    });

    client.take('ip', 'foo', 1, function (err) {
      assert.equal(err.message, 'The socket is closed.');
      done();
    });
  });

});