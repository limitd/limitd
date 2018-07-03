const EventEmitter = require('events');
const hash = require('crypto').createHash;
const storesFactory = require('./stores');

class Configurator extends EventEmitter {
  constructor(config) {
    super();
    const type = config.type;
    this.logger = config.logger;
    this.metrics = config.metrics;

    this.store = config.store || new storesFactory(type, config);

    this.pollInterval = config.interval || 300000; // 5 minutes
    this.currentHash = hash('sha1').update(String(config.currentVal)).digest('base64');
    this.startPolling();
  }

  checkForChanges() {
    this.logger.info('Configurator: fetching config');
    const start = Date.now();
    this.store.fetch((err, data) => {
      if (err) {
        return this.logger.error(err);
      }

      this.metrics.histogram('configurator.fetch', Date.now() - start);
      const newHash = hash('sha1').update(data).digest('base64');

      if (newHash !== this.currentHash) {
        this.emit('changed', data);
        this.currentHash = newHash;
      }
    });
  }

  startPolling() {
    if (this.scheduledInterval) {
      clearInterval(this.scheduledInterval);
    }

    this.scheduledInterval = setInterval(() => {
      this.checkForChanges();
    }, this.pollInterval);
  }
}

module.exports = Configurator;
