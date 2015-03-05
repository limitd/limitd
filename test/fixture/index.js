var yaml = require('js-yaml');
var fs = require('fs');
var path = require('path');

module.exports = yaml.safeLoad(fs.readFileSync(
  path.join(__dirname, '/fixture.yml'),
  'utf8'
));
