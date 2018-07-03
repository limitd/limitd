const FileStore = require('./file');
const CredstashStore = require('./credstash');

function storesFactory(type, config) {
  if (type === 'credstash') {
    return new CredstashStore(config);
  } else if (type === 'file') {
    return new FileStore(config);
  }
  throw new Error('Unsupported Configurator Store Type');
}

module.exports = storesFactory;
