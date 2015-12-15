var Request = require('../../messages').Request;
var through2 = require('through2');

module.exports = function () {
  return through2.obj(function (chunk, enc, callback) {
    var decoded;

    try {
      decoded = Request.decode(chunk);
    } catch(err) {
      return callback(err);
    }

    callback(null, decoded);
  });
};