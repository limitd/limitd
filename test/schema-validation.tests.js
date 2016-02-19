var expect = require('chai').expect;
var _ = require('lodash');
var validate = require('../lib/config_validator');

describe('schema validation', function() {
  it('should return an error for an empty config', function() {
    var err = validate({});
    expect(err).to.contain('Missing required property: buckets');
    expect(err).to.contain('Missing required property: db');
  });

  it('should return an error if db is not provided', function() {
    var err = validate({
      buckets: {
        ip: {
          size: 1
        }
      }
    });
    expect(err).to.contain('Missing required property: db');
  });

  it('should return an error if buckets is not provided', function() {
    var err = validate({
      db: '/tmp/limitd.db'
    });
    expect(err).to.contain('Missing required property: buckets');
  });

  it('should not return an error if both db and buckets are provided', function() {
    var err = validate({
      db: '/tmp/limitd.db',
      buckets: {
        ip: {
          size: 1
        }
      }
    });
    expect(err).to.be.null;
  });

  it('should return an error if log_level is invalid', function() {
    var err = validate({
      db: '/tmp/limitd.db',
      buckets: {
        ip: {
          size: 1
        }
      },
      log_level: 'lero'
    });
    expect(err).to.contain('\'Invalid property "lero"\' on property log_level');
  });

  it('should not return an error if log_level is valid', function() {
    var config = {
      db: '/tmp/limitd.db',
      buckets: {
        ip: {
          size: 1
        }
      }
    };
    var logLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
    logLevels.forEach(function(logLevel) {
      expect(validate(_.extend(config, { log_level: logLevel }))).to.be.null;
    });
  });

  var intervalMissing = function() {
    var err = validate({
      db: '/tmp/limitd.db',
      buckets: {
        ip: {
          purpose: 'Whatever'
        }
      }
    });
    expect(err).to.contain('Use only one of: per_second / per_minute / per_hour');
  };

  var moreThanOnePerInterval = function() {
    var config = {
      db: '/tmp/limitd.db',
      buckets: {
        ip: {}
      }
    };
    expect(validate(_.extend(_.clone(config), { buckets: { ip: { size: 1, per_second: 1, per_minute: 2 } } }))).to.be.not.null;
    expect(validate(_.extend(_.clone(config), { buckets: { ip: { per_minute: 1, per_hour: 2 } } }))).to.be.not.null;
    var err = validate(_.extend(_.clone(config), { buckets: { ip: { per_second: 1, per_hour: 2 } } }));
    expect(err).to.contain('Use only one of: per_second / per_minute / per_hour');
  };

  var intervalNaN = function() {
    var config = {
      db: '/tmp/limitd.db',
      buckets: {
        ip: {}
      }
    };
    expect(validate(_.extend(_.clone(config), { buckets: { ip: { per_second: 'a' } } }))).to.be.not.null;
    expect(validate(_.extend(_.clone(config), { buckets: { ip: { per_minute: 'a' } } }))).to.be.not.null;
    var err = validate(_.extend(_.clone(config), { buckets: { ip: { per_hour: 'a' } } }));
    expect(err).to.contain('Expected type integer but found type string');
  };

  var negativeInterval = function() {
    var config = {
      db: '/tmp/limitd.db',
      buckets: {
        ip: {}
      }
    };
    expect(validate(_.extend(_.clone(config), { buckets: { ip: { per_second: -1 } } }))).to.be.not.null;
    expect(validate(_.extend(_.clone(config), { buckets: { ip: { per_minute: -1 } } }))).to.be.not.null;
    var err = validate(_.extend(_.clone(config), { buckets: { ip: { per_hour: -1 } } }));
    expect(err).to.contain('Value -1 is less than minimum 1');
  };

  var validInterval = function() {
    var config = {
      db: '/tmp/limitd.db',
      buckets: {
        ip: {}
      }
    };
    expect(validate(_.extend(_.clone(config), { buckets: { ip: { per_second: 1 } } }))).to.be.null;
    expect(validate(_.extend(_.clone(config), { buckets: { ip: { per_minute: 1 } } }))).to.be.null;
    expect(validate(_.extend(_.clone(config), { buckets: { ip: { per_hour: 1 } } }))).to.be.null;
  };

  var sizeNaN = function() {
    var config = {
      db: '/tmp/limitd.db',
      buckets: {
        ip: {
          size: 'a'
        }
      }
    };
    var err = validate(config);
    expect(err).to.contain('Expected type integer but found type string');
  };

  var negativeSize = function() {
    var config = {
      db: '/tmp/limitd.db',
      buckets: {
        ip: {
          size: -2
        }
      }
    };
    var err = validate(config);
    expect(err).to.contain('Value -2 is less than minimum 0');
  };

  var validSize = function() {
    var config = {
      db: '/tmp/limitd.db',
      buckets: {
        ip: {
          size: 3
        }
      }
    };
    expect(validate(config)).to.be.null;
  };

  var invalidMatch = function() {
    var err = validate({
      db: '/tmp/limitd.db',
      buckets: {
        ip: {
          size: 3,
          match: 'lol'
        }
      }
    });
    expect(err).to.contain('String does not match pattern');
  };

  var validMatch = function() {
    var err = validate({
      db: '/tmp/limitd.db',
      buckets: {
        ip: {
          size: 3,
          match: '!!js/regexp /^10\./ig'
        }
      }
    });
    expect(err).to.be.null;
  };

  describe('buckets', function() {
    it('should return an error if neither size nor per_${interval} is provided', intervalMissing);
    it('should return an error if more than one per_${interval} property is provided', moreThanOnePerInterval);
    it('should return an error if per_${interval} is not a number', intervalNaN);
    it('should return an error if per_${interval} < 0', negativeInterval);
    it('should not return an error if one valid per_${interval} is provided', validInterval);
    it('should return an error if size is not a number', sizeNaN);
    it('should return an error if size < 0', negativeSize);
    it('should not return an error if a valid size is provided', validSize);
    it('should return an error if match is not a regex', invalidMatch);
    it('should not return an error if match is a regex', validMatch);

    describe('override', function() {
      it('should return an error if neither size nor per_${interval} is provided', intervalMissing);
      it('should return an error if more than one per_${interval} property is provided', moreThanOnePerInterval);
      it('should return an error if per_${interval} is not a number', intervalNaN);
      it('should return an error if per_${interval} < 0', negativeInterval);
      it('should not return an error if one valid per_${interval} is provided', validInterval);
      it('should return an error if size is not a number', sizeNaN);
      it('should return an error if size < 0', negativeSize);
      it('should not return an error if a valid size is provided', validSize);
      it('should return an error if match is not a regex', invalidMatch);
      it('should not return an error if match is a regex', validMatch);

      // it('should return an error if until is not a regex', function() {
      //  var err = validate({
      //    db: '/tmp/limitd.db',
      //    buckets: {
      //      ip: {
      //        size: 3,
      //        override: {
      //          until: {}
      //        }
      //      }
      //    }
      //  });
      //  expect(err).to.contain('String does not match pattern');
      // });

      // it('should not return an error if until is a regex', function() {
      //  var err = validate({
      //    db: '/tmp/limitd.db',
      //    buckets: {
      //      ip: {
      //        size: 3,
      //        override: {
      //          until: '!!timestamp 2010-11-18'
      //        }
      //      }
      //    }
      //  });
      //  expect(err).to.be.null;
      // });
    });
  });
});
