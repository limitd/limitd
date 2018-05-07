const EventLogger = require('auth0-common-logging').EventLogger;

module.exports = logger => new EventLogger(logger);
