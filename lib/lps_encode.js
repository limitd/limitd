var through2 = require('through2');
var varint = require('varint');

/*
 * This is faster than length-prefixed-stream because of this:
 * https://github.com/mafintosh/length-prefixed-stream/issues/2
 */
module.exports = function () {
  return through2.obj(function (chunk, enc, callback) {
    var varint_bytes = varint.encode(chunk.length);
    var varint_buffer = new Buffer(varint_bytes);
    var result = Buffer.concat([varint_buffer, chunk]);

    callback(null, result);
  });
};