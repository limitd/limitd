var _ = require('lodash');
var minimist = require('minimist');
var yaml = require('js-yaml');
var fs   = require('fs');

var defaults = {
  PORT: 9231
};

function capitalize_keys (obj) {
  return _.reduce(obj, function (result, n, key) {
    result[key.toUpperCase()] = obj[key];
    return result;
  }, {});
}

var argv = capitalize_keys(minimist(process.argv.slice(2)));

exports.get = function (override) {
  var config;

  override = override && capitalize_keys(override);

  if (override) {
   config = _.extend({}, defaults, override);
  } else {
   config = _.extend({}, defaults, argv, process.env);
  }

  if (config.CONFIG_FILE) {
    try {
      var doc = yaml.safeLoad(fs.readFileSync(config.CONFIG_FILE, 'utf8'));
      _.extend(config, capitalize_keys(doc), override);
    } catch (e) {
      console.error('Error loading configuration \n', e.stack);
    }
  }

  return config;
};