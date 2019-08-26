const FileStore = require('./file');

function storesFactory(type, config) {
  if (type === 'file') {
    return new FileStore(config);
  }
  throw new Error('Unsupported Configurator Store Type');
}

module.exports = storesFactory;
