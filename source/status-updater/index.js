// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const {
  CloudWatchStatus,
} = require('./lib/cloudwatch');

const {
  SnsStatus,
} = require('./lib/sns');

const REQUIRED_ENVS = [
  'ENV_SOLUTION_UUID',
  'ENV_MEDIACONVERT_HOST',
  'ENV_MEDIACONVERT_ROLE',
  'ENV_SERVICE_TOPIC_ROLE_ARN',
  'ENV_SERVICE_TOPIC_ARN',
  'ENV_SERVICE_TOKEN_TABLE',
  'ENV_SERVICE_TOKEN_TABLE_PARTITION_KEY',
  'ENV_SERVICE_TOKEN_TABLE_SORT_KEY',
];

/**
 * @exports handler
 */
exports.handler = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)};\ncontext = ${JSON.stringify(context, null, 2)};`);
  try {
    const missing = REQUIRED_ENVS.filter(x => process.env[x] === undefined);
    if (missing.length) {
      throw new Error(`missing env, ${missing.join(', ')}`);
    }
    let instance;
    if (event.source) {
      instance = new CloudWatchStatus(event, context);
    } else if (event.Records
      && (event.Records[0].Sns || {}).TopicArn === process.env.ENV_SERVICE_TOPIC_ARN) {
      instance = new SnsStatus(event, context);
    } else {
      throw new Error('event not supported. exiting....');
    }
    return instance.process();
  } catch (e) {
    console.error(e);
    return undefined;
  }
};
