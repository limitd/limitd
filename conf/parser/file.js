const _ = require('lodash');
const yaml = require('js-yaml');
const path = require('path');
const fs = require('fs');

module.exports.parse = function(configFile) {
  const configFilePath = path.resolve(process.cwd(), configFile);
  const config = yaml.load(fs.readFileSync(configFilePath, 'utf8'));

  const override_dir = configFilePath + '.d';

  if (fs.existsSync(override_dir) && fs.statSync(override_dir).isDirectory()) {
    fs.readdirSync(override_dir).sort().forEach(function(override_file) {
      const override = yaml.load(fs.readFileSync(path.join(override_dir, override_file), 'utf8'));
      Object.assign(config, _.omit(override, ['buckets']));
      config.buckets = Object.assign({}, config.buckets || {}, override.buckets || {});
    });
  }

  return config;
};
