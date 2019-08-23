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
    this.currentHash = hash('sha1').update(JSON.stringify(config.currentVal)).digest('base64');
  }

  checkForChanges() {
    this.logger.info('Configurator: fetching config');
    const start = Date.now();
    this.store.fetch((err, data) => {
      this.scheduledTimeout = setTimeout(() => {
        this.checkForChanges();
      }, this.pollInterval);
      if (err) {
        return this.logger.error('Configurator: error fetching configuration', { err });
      }

      this.metrics.histogram('configurator.fetch', Date.now() - start);
      const newHash = hash('sha1').update(JSON.stringify(data)).digest('base64');
      const changed = newHash !== this.currentHash;
      this.logger.info('Configurator: finished fetching config', { changed });
      if (changed) {
        this.emit('changed', data);
        this.currentHash = newHash;
      }
    });
  }

  stopCheckingForChanges() {
    if (this.scheduledTimeout)  {
      clearTimeout(this.scheduledTimeout);
    }
  }
}

module.exports = Configurator;
