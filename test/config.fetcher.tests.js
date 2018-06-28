const assert = require('chai').assert;
const fs = require('fs');
const nock = require('nock');
const fetcher = require('../conf/fetcher');

describe('config file fetcher', function() {
  var config;
  var remoteConfigFile;
  before(function() {
    config = null;
    remoteConfigFile = fs.readFileSync(`${__dirname}/fixture/fixture-remote.yml`, { encoding: 'utf8' });
  });

  it('should not crash if it can\'t remove or save to the file', function() {
    fetcher.fetchRemoteConfiguration({
      tmpConfigPath: '/root/something-i-cant-change',
      tmpConfigEtagPath: '/tmp/foo-bar',
      remoteConfigURI: 'https://foo.bar/mylimit.config'
    }, function(err) {
      assert.exists(err);
    });
  });

  it('should not crash if it can\'t save the file etag', function() {
    fetcher.fetchRemoteConfiguration({
      tmpConfigPath: '/tmp/foo-bar-baz',
      tmpConfigEtagPath: '/root/something-i-cant-write-to',
      remoteConfigURI: 'https://foo.bar/mylimit.config'
    }, function(err) {
      assert.exists(err);
    });
  });

  it('should not change contents if the etag matches previous content', function() {
    nock('https://foo.bar')
      .persist()
      .defaultReplyHeaders({
        'etag': '123'
      })
      .get('/mylimit.config')
      .reply(200, remoteConfigFile);

    fs.writeFileSync('/tmp/should-not-change', remoteConfigFile, { encoding: 'utf8' });
    fs.writeFileSync('/tmp/should-not-change.etag', '123', { encoding: 'utf8' });

    fetcher.fetchRemoteConfiguration({
      tmpConfigPath: '/tmp/should-not-change',
      tmpConfigEtagPath: '/tmp/should-not-change.etag',
      remoteConfigURI: 'https://foo.bar/mylimit.config'
    }, function(err, contents) {
      assert.notExists(err);
      assert.notExists(contents);
    });
  });

  it('should not crash if the downloaded file can\'t be parsed', function() {
    nock('https://foo.bar')
      .persist()
      .defaultReplyHeaders({
        'etag': '1234'
      })
      .get('/mylimit.invalid.config')
      .reply(200, 'lol this is invalid');

    fetcher.fetchRemoteConfiguration({
      tmpConfigPath: '/tmp/should-change',
      tmpConfigEtagPath: '/tmp/should-change.etag',
      remoteConfigURI: 'https://foo.bar/mylimit.invalid.config'
    }, function(err, contents) {
      assert.exists(err);
      assert.notExists(contents);
    });
  });

  it('should save file to the destination', function() {
    nock('https://foo.bar')
      .persist()
      .defaultReplyHeaders({
        'etag': '1234'
      })
      .get('/mylimit.config')
      .reply(200, remoteConfigFile);

    fs.writeFileSync('/tmp/should-change', remoteConfigFile, { encoding: 'utf8' });
    fs.writeFileSync('/tmp/should-change.etag', '1233', { encoding: 'utf8' });

    fetcher.fetchRemoteConfiguration({
      tmpConfigPath: '/tmp/should-change',
      tmpConfigEtagPath: '/tmp/should-change.etag',
      remoteConfigURI: 'https://foo.bar/mylimit.config'
    }, function(err, contents) {
      assert.notExists(err);
      assert.exists(contents);
    });
  });
});
