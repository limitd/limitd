var avsc = require('avsc');
var registry = {};

function parse (name) {
  return avsc.parse(__dirname + '/../avro-protocol/' + name + '.avsc', {
    registry: registry
  });
}

[
  'Bucket',
  'Request/Index',
  'Response/PutBody',
  'Response/TakeBody',
  'Response/ErrorBody',
  'Response/StatusBody',
  'Response/Index',
].forEach(function (k) {
  module.exports[k] = parse(k);
});