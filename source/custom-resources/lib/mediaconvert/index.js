// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const AWS = require('aws-sdk');
const {
  mxBaseResponse,
} = require('../shared/mxBaseResponse');

class X0 extends mxBaseResponse(class {}) {}

/**
 * @function DescribeMediaConvert
 * @param {object} event
 * @param {object} context
 */
exports.DescribeMediaConvert = async (event, context) => {
  const x0 = new X0(event, context);
  try {
    if (x0.isRequestType('Delete')) {
      x0.storeResponseData('Status', 'SKIPPED');
      return x0.responseData;
    }

    const mediaconvert = new AWS.MediaConvert({
      apiVersion: '2017-08-29',
    });
    const response = await mediaconvert.describeEndpoints({
      MaxResults: 1,
    }).promise();

    if (!(response.Endpoints || []).length || !response.Endpoints[0].Url) {
      throw new Error('Endpoints.Url is null');
    }
    x0.storeResponseData('Endpoint', response.Endpoints[0].Url);
    x0.storeResponseData('Status', 'SUCCESS');
    return x0.responseData;
  } catch (e) {
    e.message = `DescribeMediaConvert: ${e.message}`;
    throw e;
  }
};
