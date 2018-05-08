const program  = require('commander');
const _ = require('lodash');
const configEnvParser = require('../conf/parser/env');
const configFileParser = require('../conf/parser/file');

const defaults = {
  log_level: 'info',
  toEnv: function() {
    return Object.keys(this).reduce((r, key) => {
      r[key.toUpperCase()] = this[key];
      return r;
    }, {});
  }
};

if (!process.argv[1].match(/limitd$/)) {
  //this is when limitd is used as
  //library or when running limitd's own tests
  module.exports = _.defaults({
    limitd_lib_mode: true,
    log_level: 'fatal'
  }, defaults);
  return;
}

program.version(require('../package').version)
  .option('-d --db <file>', 'Path to the database.')
  .option('-p --port [9231]', 'Port to bind [9231].', '9231')
  .option('-h --hostname [0.0.0.0]', 'Hostname to bind [0.0.0.0].', '0.0.0.0')
  .option('-c --config-file <file>', 'Configuration file.')
  .option('-l --log-file <file>', 'The log file.')
  .parse(process.argv);

const config = _.pick(program, ['db', 'port', 'hostname', 'configFile', 'logFile']);

if (config.logFile) {
  config.log_file = config.logFile;
  delete config.logFile;
}

const configFile = config.configFile || process.env.CONFIG_FILE;

if (configFile) {
  try {
    const parsedFromFile = configFileParser.parse(configFile);
    _.extend(config, parsedFromFile);
  } catch (e) {
    console.error('Error parsing configuration from file\n', e.stack);
    setTimeout(function () {
      process.exit(1);
    }, 500);
  }
}

try{
  const parsedFromEnv = configEnvParser.parse(process.env);
  _.extend(config, parsedFromEnv);
} catch (e) {
  console.error('Error parsing environment configuration\n', e.stack);
  setTimeout(function () {
    process.exit(2);
  }, 500);
}

if (typeof config.db === 'undefined') {
  console.error('missing database path');
  return process.exit(1);
}

_.defaults(config, defaults);

module.exports = config;
