'use strict';

const _ = require('lodash');
const schema = require('../config.schema');
const propertyNames = Object.keys(schema.properties);

function parseString(name, value) {
  const subschema = schema.properties[name];

  return parseStringToSpecificType(value, subschema.type);
}

function parseBucketString(name, value) {
  const objectName = Object.keys(schema.properties.buckets.patternProperties)[0];
  const subschema = schema.properties.buckets.patternProperties[objectName].properties[name];

  return parseStringToSpecificType(value, subschema.type);
}

function parseStringToSpecificType(value, type) {
  let parsed;
  if (type === 'string' || Array.isArray(type) && type.indexOf('string') > -1) {
    return value;
  }
  switch (type) {
    case 'integer':
      parsed = Number(value);
      break;
    case 'boolean':
      parsed = Boolean(value);
      break;
  }

  return parsed;
}

module.exports.parse = function (env) {
  const keys = Object.keys(env);
  const config = {};
  const buckets = {};

  keys.forEach(key => {
    if (key.indexOf('BUCKET') === 0) {
      const id = key.split('_')[1];
      if (key !== `BUCKET_${id}_NAME`) {
        const bucketName = env[`BUCKET_${id}_NAME`];
        let bucket = buckets[bucketName];
        if (!bucket) {
          bucket = {};
          buckets[bucketName] = bucket;
        }
        const propertyName = key.replace(`BUCKET_${id}_`, '').toLowerCase();
        bucket[propertyName] = parseBucketString(propertyName, env[key]);
      }

    } else if(propertyNames.indexOf(key.toLowerCase()) > -1) {
      const propertyName = key.toLowerCase();
      config[propertyName] = parseString(propertyName, env[key]);
    }
  });

  if (!_.isEmpty(buckets)) {
    config.buckets = buckets;
  }

  return config;
};
