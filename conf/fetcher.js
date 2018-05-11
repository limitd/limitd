const https = require('https');
const fs = require('fs');
const configFileParser = require('../conf/parser/file');

const download = function(url, dest, etagDest, timeout, cb) {
  try {
    fs.unlink(dest, function(err) {
      if(err && err.code !== 'ENOENT') {
        // couldn't remove the file
        return cb(err);
      }

      var file = fs.createWriteStream(dest);
      file.on('error', function(err) {
        // couldn't write to the file
        fs.unlink(dest, function() { cb(err); });
      }).on('finish', function() {
        file.close(cb);
      });

      var request = https.get(url, function(response) {
        // if the contents of the config file are the same, we don't need to reload anything
        if (response.headers && response.headers['etag']) {
          var lastEtag;

          // we do this synchronously to avoid piping anything to the file stream unless
          // the content is new
          try {
            lastEtag = fs.readFileSync(etagDest, { encoding: 'utf8' });
          } catch(e) {}

          if (lastEtag === response.headers['etag']) {
            return file.close(function() {
              cb(null, true);
            });
          }

          fs.writeFile(etagDest, response.headers['etag'], function(err) {
            if (err) return cb(err);
          });
        }

        response.pipe(file);
      }).on('error', function(err) {
        // couldn't download it from the URL
        fs.unlink(dest, function() { cb(err); });
      });
      request.setTimeout(timeout, function(err) {
        // timed out when trying to download it in due time
        fs.unlink(dest, function() { cb(err); });
      });
    });
  } catch (err) {
    // something weird happened here
    cb(err);
  }
};

module.exports.fetchRemoteConfiguration = function(config, cb) {
  const tmpConfigPath = config.tmpConfigPath || '/tmp/limitd-remote-config';
  const tmpConfigEtagPath = config.tmpConfigEtagPath || `${config.tmpConfigPath}.etag`;
  download(config.remoteConfigURI, tmpConfigPath, tmpConfigEtagPath, config.remoteConfigTimeout || 3000, function(err, configIsEquals) {
    if (err) return cb(err);
    if (configIsEquals) return cb();

    try {
      const parsedFromFile = configFileParser.parse(tmpConfigPath);
      cb(null, parsedFromFile);
    } catch (e) {
      return cb(e);
    }
  });
};