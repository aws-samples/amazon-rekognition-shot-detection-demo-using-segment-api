// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const PATH = require('path');
const {
  States,
  S3Utils,
  AuthRequest,
} = require('core-lib');
const mxBaseState = require('../../shared/mxBaseState');

class StateCollectDetectionResults extends mxBaseState(class {}) {
  async process() {
    const output = await this.getSegmentDetection();
    this.setOutput(States.CollectDetectionResults, output);
    return super.process();
  }

  sanityCheck() {
    const prevStateData = this.output[States.StartSegmentDetection];
    if (!prevStateData.jobId) {
      throw new Error('missing jobId');
    }
    return super.sanityCheck();
  }

  static get Constants() {
    return {
      ServiceName: 'rekognition',
      Targets: {
        GetSegmentDetection: 'GetSegmentDetection',
      },
    };
  }

  async getSegmentDetection() {
    const prevState = this.output[States.StartSegmentDetection];
    let idx = 0;
    let nextToken;
    do {
      nextToken = await this.batchCopyResultsS3(idx++, {
        JobId: prevState.jobId,
        NextToken: nextToken,
      });
    } while (nextToken);

    return {
      output: {
        bucket: this.input.bucket,
        prefix: `${this.makeOutputPath(this.input.key, States.CollectDetectionResults)}/`,
        parts: idx,
      },
    };
  }

  async batchCopyResultsS3(idx, params) {
    const accumulated = [];
    let i = 0;
    let response;
    do {
      response = await AuthRequest.send(
        StateCollectDetectionResults.Constants.ServiceName,
        StateCollectDetectionResults.Constants.Targets.GetSegmentDetection,
        params
      ).catch(e =>
        new Error(`${params.JobId} ${e.message}`));
      if (response instanceof Error) {
        throw response;
      }
      accumulated.splice(accumulated.length, 0, ...this.parseResults(response));
    } while ((response || {}).NextToken && (i++ < 10));

    const bucket = this.input.bucket;
    const prefix = this.makeOutputPath(this.input.key, States.CollectDetectionResults);
    const name = `${String(idx).padStart(8, '0')}.json`;
    const body = {
      Segments: accumulated,
    };
    await S3Utils.upload(bucket, PATH.join(prefix, name), body, {
      ContentType: 'application/json',
      ContentDisposition: `attachment; filename="${name}"`,
    });
    return response.NextToken;
  }

  parseResults(data) {
    return data.Segments;
  }
}

module.exports = StateCollectDetectionResults;
