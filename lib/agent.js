const bunyan = require('bunyan');
const config = require('../conf');
const env = config.toEnv();

const logger = bunyan.createLogger({
    name: 'limitd-server',
    streams:      [
        {
            level: env.LOG_LEVEL || 'info',
            stream: process.stdout
        }
    ]
  });


module.exports = { logger };
