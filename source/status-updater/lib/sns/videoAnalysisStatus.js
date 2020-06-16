// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const {
  States,
  ServiceToken,
} = require('core-lib');

/**
 * @class VideoAnalysisStatus
 * @description manage Rekognition and Textract SNS notification message
 */
class VideoAnalysisStatus {
  constructor(parent) {
    this.$parent = parent;
  }

  static get ServiceTypes() {
    return {
      Rekognition: 'rekognition',
      Textract: 'textract',
    };
  }

  static get Mapping() {
    return {
      SUCCEEDED: 'completed',
      ERROR: 'error',
      FAILED: 'error',
    };
  }

  static get Event() {
    return {
      Succeeded: 'SUCCEEDED',
      Failed: 'FAILED',
      Error: 'ERROR',
    };
  }

  get parent() {
    return this.$parent;
  }

  get api() {
    return this.parent.api;
  }

  get service() {
    return this.parent.service;
  }

  get stateData() {
    return this.parent.stateData;
  }

  get message() {
    return this.parent.message;
  }

  get status() {
    return this.message.Status;
  }

  get jobId() {
    return this.message.JobId;
  }

  get timestamp() {
    return this.message.Timestamp;
  }

  async process() {
    switch (this.status) {
      case VideoAnalysisStatus.Event.Succeeded:
        await this.onCompleted();
        break;
      case VideoAnalysisStatus.Event.Failed:
      case VideoAnalysisStatus.Event.Error:
      default:
        await this.onError();
        break;
    }
    return ServiceToken.unregister(this.jobId).catch(() => undefined);
  }

  async onCompleted() {
    const data = this.stateData.output[States.StartSegmentDetection];
    data.status = VideoAnalysisStatus.Mapping[this.status];
    data.metrics.t1 = new Date().getTime();
    return this.parent.sendTaskSuccess();
  }

  async onError() {
    const error = new Error(`${this.status}: ${this.jobId}`);
    const data = this.stateData.output[States.StartSegmentDetection];
    data.status = VideoAnalysisStatus.Mapping[this.status] || 'error';
    data.errorMessage = error.message;
    data.metrics.t1 = new Date().getTime();
    return this.parent.sendTaskFailure(error);
  }
}

module.exports = {
  VideoAnalysisStatus,
};
