const https = require('https');
const fs = require('fs');
const configFileParser = require('../conf/parser/file');

const download = function(url, dest, timeout, cb) {
  try {
    fs.unlink(dest, function() {
      var file = fs.createWriteStream(dest);
      var request = https.get(url, function(response) {
        response.pipe(file);
        file.on('finish', function() {
          file.close(cb);
        });
      }).on('error', function(err) {
        fs.unlink(dest);
        cb(err);
      });

      request.setTimeout(timeout, function(err) {
        fs.unlink(dest);
        cb(err);
      });
    });
  } catch (err) {
    cb(err);
  }
};

module.exports.fetchRemoteConfiguration = function(config, cb) {
  const tmpConfigPath = '/tmp/limitd-remote-config';
  download(config.remoteConfigURI, tmpConfigPath, config.remoteConfigTimeout || 3000, function() {
    try {
      const parsedFromFile = configFileParser.parse(tmpConfigPath);
      cb(null, parsedFromFile);
    } catch (e) {
      console.error('Error parsing configuration from remote location\n', e.stack);
      return cb(e);
    }
  })
};