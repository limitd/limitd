var _ = require('lodash');

var sizeSchema = {
  type: 'integer',
  description: 'Size of the bucket (defaults to 0)',
  minimum: 0
};

var perSecondSchema = {
  type: 'integer',
  description: 'Amount of tokens to add to the bucket per second',
  minimum: 1
};

var perMinuteSchema = {
  type: 'integer',
  description: 'Amount of tokens to add to the bucket per minute',
  minimum: 1
};

var perHourSchema = {
  type: 'integer',
  description: 'Amount of tokens to add to the bucket per hour',
  minimum: 1
};

var matchSchema = {
  type: 'string',
  description: 'Regexp to match against the key',
  pattern: '^\!\!js\/regexp .+$'
};

// we can have ONE of per_${interval} and/or size
var requiredOptions = [
  {
    oneOf: [
      { required: ['per_second'] },
      { required: ['per_minute'] },
      { required: ['per_hour'] }
    ]
  },
  {
    required: ['size']
  }
];

module.exports = {
  type: 'object',
  description: 'limitd configuration',
  properties: {
    port: {
      type: 'integer',
      description: 'The port to use to run the server (defaults to 9231)'
    },
    db: {
      type: ['string', 'object'],
      description: 'The path for the server database'
    },
    hostname: {
      type: 'string',
      description: 'the hostname to bind to (defaults to INADDR_ANY)'
    },
    log_level: {
      enum: ['fatal', 'error', 'warn', 'info', 'debug', 'trace'],
      description: 'the verbosity of the logs (defaults to "info")',
    },
    buckets: {
      type: 'object',
      description: 'The configuration for all bucket types',
      patternProperties: {
        '^[a-zA-Z0-9\-]+$': {
          type: 'object',
          description: 'The configuration for a bucket type',
          anyOf: requiredOptions,
          additionalProperties: false,
          properties: {
            purpose: {
              type: 'string',
              description: 'The purpose of a particular bucket'
            },
            size: sizeSchema,
            per_second: perSecondSchema,
            per_minute: perMinuteSchema,
            per_hour: perHourSchema,
            match: matchSchema,
            override: {
              type: 'object',
              description: 'Custom configuration for a bucket with the specified key for the particular type',
              patternProperties: {
                '^[a-zA-Z0-9\-]+$': {
                  type: 'object',
                  description: 'The configuration for a bucket with the specified key for the particular type',
                  anyOf: requiredOptions.concat({}),
                  additionalProperties: false,
                  properties: {
                    size: sizeSchema,
                    per_second: perSecondSchema,
                    per_minute: perMinuteSchema,
                    per_hour: perHourSchema,
                    match: matchSchema,
                    until: {
                      type: 'string',
                      description: 'Timestamp representing when the rule will become invalid'
                      // pattern: '^\!\!timestamp (0[1-9]|1[012])/(0[1-9]|[12][0-9]|3[01])/(19|20)\d\d( ([01]\d|2[0-3]):[0-5]\d)?$'
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  additionalProperties: true,
  required: ['db', 'buckets']
};
