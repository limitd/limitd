var yaml = require('js-yaml');
var fs = require('fs');

module.exports = yaml.safeLoad(fs.readFileSync(__dirname + '/fixture.yml', 'utf8'));
