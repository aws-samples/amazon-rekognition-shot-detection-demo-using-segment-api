// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const AWS = require('aws-sdk');
const {
  mxBaseResponse,
} = require('../shared/mxBaseResponse');

class X0 extends mxBaseResponse(class {}) {}

async function getAccount() {
  const api = new AWS.APIGateway({
    apiVersion: '2015-07-09',
  });
  return api.getAccount({}).promise()
    .then(data => data.cloudwatchRoleArn)
    .catch(() => undefined);
}

async function getRole(roleArn) {
  if (!roleArn) {
    return undefined;
  }
  const iam = new AWS.IAM({
    apiVersion: '2010-05-08',
  });
  return iam.getRole({
    RoleName: roleArn.split('/').pop(),
  }).promise()
    .then(data => data.Role.Arn)
    .catch(() => undefined);
}

exports.ConfigureApiCloudWatchLogRole = async (event, context) => {
  const x0 = new X0(event, context);
  try {
    const data = event.ResourceProperties.Data;
    if (!data.LogRoleArn) {
      throw new Error('missing LogRoleArn');
    }
    const roleArn = await getRole(await getAccount());
    x0.storeResponseData('RoleArn', roleArn || data.LogRoleArn);
    x0.storeResponseData('Status', 'SUCCESS');
    return x0.responseData;
  } catch (e) {
    e.message = `ConfigureApiCloudWatchLogRole: ${e.message}`;
    throw e;
  }
};
