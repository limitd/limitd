const config = require('../conf');
const pkg = require('../package.json');
const agent = require('auth0-instrumentation');
const EventLogger = require('auth0-common-logging').EventLogger;

const env = config.toEnv();

agent.init(pkg, env, null, { fileRotationSignal: 'SIGHUP' });

agent.eventLogger = new EventLogger(agent.logger);
agent.eventLogger.watch(process);

agent.metrics.startResourceCollection();

module.exports = agent;
