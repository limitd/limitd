const agent = require('auth0-instrumentation');
const config = require('../conf');
const EventLogger = require('auth0-common-logging').EventLogger;
const package = require('../package.json');

const env = config.toEnv();

agent.init(package, env, null, { fileRotationSignal: 'SIGHUP' });

agent.eventLogger  = new EventLogger(agent.logger);
agent.eventLogger.watch(process);

agent.metrics.startResourceCollection();

module.exports = agent;
