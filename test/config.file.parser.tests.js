const assert = require('chai').assert;
const parser = require('../conf/parser/file');

describe('config file parser', function() {
  var config;
  before(function() {
    config = parser.parse(`${__dirname}/fixture/fixture.yml`);
  });

  it('should load config root configs', function() {
    assert.property(config, 'log_level');
    assert.property(config, 'port');
    assert.property(config, 'buckets');
  });

  if('should override root properties', function() {
    assert.equal(config.log_level, 'debug');
  });

  it('should merge the buckets', function() {
    assert.property(config.buckets, 'requests');
    assert.property(config.buckets, 'ip');
    assert.property(config.buckets, 'wrong_password');
    assert.property(config.buckets, 'once per hour');

    assert.equal(Object.keys(config.buckets.ip).length, 1);
    assert.equal(config.buckets.ip.per_minute, 20);
  });
});
