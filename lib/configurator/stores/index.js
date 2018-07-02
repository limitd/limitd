const Credstash = require('./credstash');

function storesFactory(type, config) {
  if (type === 'credstash') {
    return new Credstash(config);
  }

  throw new Error('Unsupported Configurator Store Type');
}

module.exports = storesFactory;
