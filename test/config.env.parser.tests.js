const expect = require('chai').expect;
const parser = require('../conf/parser/env');

describe('config env parser', function() {
  describe('with a complete well formed environment', function () {
    const env = {
      PORT: '9001',
      BUCKET_1_NAME: 'user',
      BUCKET_1_SIZE: '1',
      BUCKET_1_PER_MINUTE: '5',
      BUCKET_1_PURPOSE: 'user creation bucket',
      BUCKET_2_NAME: 'foo',
      BUCKET_2_SIZE: '10',
      BUCKET_2_PER_MINUTE: '15',
      BUCKET_2_MATCH: '^[a-zA-Z0-9]+$',
      BUCKET_3_NAME: 'bar',
      BUCKET_3_UNLIMITED: 'true',
      DB: './database'
    };

    it('should parse it ok', function() {
      const config = parser.parse(env);
      expect(Object.keys(config).length).to.equal(3);
      expect(config.port).to.equal('9001');
      expect(config.db).to.equal('./database');
      expect(config.buckets).to.deep.equal({
        user: { size: 1, per_minute: 5, purpose: 'user creation bucket' },
        foo: { size: 10, per_minute: 15, match: '^[a-zA-Z0-9]+$' },
        bar: { unlimited: true }
      });
    });
  });

  describe('with just the buckets configuration in the environment', function () {
    const env = {
      BUCKET_1_NAME: 'user',
      BUCKET_1_SIZE: 1,
      BUCKET_1_PER_MINUTE: 5,
      BUCKET_2_NAME: 'foo',
      BUCKET_2_SIZE: 10,
      BUCKET_2_PER_MINUTE: 15,
      BUCKET_3_NAME: 'bar',
      BUCKET_3_SIZE: 13,
      BUCKET_3_PER_SECOND: 25,
    };

    it('should parse it ok', function() {
      const config = parser.parse(env);
      expect(Object.keys(config).length).to.equal(1);
      expect(config.buckets).to.deep.equal({
        user: { size: 1, per_minute: 5 },
        foo: { size: 10, per_minute: 15 },
        bar: { size: 13, per_second: 25 }
      });
    });
  });

  describe('with just the buckets configuration in the environment in a random order', function () {
    const env = {
      BUCKET_3_PER_SECOND: 25,
      BUCKET_1_SIZE: 1,
      BUCKET_2_NAME: 'foo',
      BUCKET_1_PER_MINUTE: 5,
      BUCKET_2_SIZE: 10,
      BUCKET_3_NAME: 'bar',
      BUCKET_2_PER_MINUTE: 15,
      BUCKET_1_NAME: 'user',
      BUCKET_3_SIZE: 13,
    };

    it('should parse it ok', function() {
      const config = parser.parse(env);
      expect(Object.keys(config).length).to.equal(1);
      expect(config.buckets).to.deep.equal({
        user: { size: 1, per_minute: 5 },
        foo: { size: 10, per_minute: 15 },
        bar: { size: 13, per_second: 25 }
      });
    });
  });

  describe('with not supported additional properties', function () {
    const env = {
      PORT: '9001',
      BUCKET_1_NAME: 'user',
      BUCKET_1_SIZE: '1',
      BUCKET_1_PER_MINUTE: '5',
      BUCKET_2_NAME: 'foo',
      BUCKET_2_SIZE: '10',
      BUCKET_2_PER_MINUTE: '15',
      BUCKET_3_NAME: 'bar',
      BUCKET_3_SIZE: '13',
      BUCKET_3_PER_SECOND: '25',
      DB: './database',

      ADDITIONAL_PROPERTY_1: 'baz',
      additional_property_2: 'taz'
    };

    it('should not include additional properties', function() {
      const config = parser.parse(env);
      expect(Object.keys(config).length).to.equal(3);
      expect(config.port).to.equal('9001');
      expect(config.db).to.equal('./database');
      expect(config.buckets).to.deep.equal({
        user: { size: 1, per_minute: 5 },
        foo: { size: 10, per_minute: 15 },
        bar: { size: 13, per_second: 25 }
      });
    });
  });
});
