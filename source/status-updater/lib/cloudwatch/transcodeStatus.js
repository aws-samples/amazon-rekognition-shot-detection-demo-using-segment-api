// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const {
  States,
  ServiceToken,
} = require('core-lib');

class TranscodeStatus {
  constructor(parent) {
    this.$parent = parent;
    this.$service = undefined;
    this.$api = undefined;
  }

  static get SourceType() {
    return 'aws.mediaconvert';
  }

  static get Mapping() {
    return {
      SUBMITTED: 'started',
      PROGRESSING: 'inProgress',
      STATUS_UPDATE: 'inProgress',
      COMPLETE: 'completed',
      CANCELED: 'error',
      ERROR: 'error',
    };
  }

  static get Event() {
    return {
      Completed: 'COMPLETE',
      Canceled: 'CANCELED',
      Error: 'ERROR',
      InProgress: 'STATUS_UPDATE',
    };
  }

  get parent() {
    return this.$parent;
  }

  get api() {
    return this.$api;
  }

  set api(val) {
    this.$api = val;
  }

  get service() {
    return this.$service;
  }

  set service(val) {
    this.$service = val;
  }

  get event() {
    return this.parent.event;
  }

  get context() {
    return this.parent.context;
  }

  get detail() {
    return this.parent.detail;
  }

  get token() {
    return this.parent.token;
  }

  set token(val) {
    this.parent.token = val;
  }

  get stateData() {
    return this.parent.stateData;
  }

  set stateData(val) {
    this.parent.stateData = val;
  }

  get status() {
    return this.detail.status;
  }

  get jobId() {
    return this.detail.jobId;
  }

  get timestamp() {
    return this.detail.timestamp;
  }

  get outputGroupDetails() {
    return this.detail.outputGroupDetails;
  }

  get jobPercentComplete() {
    return (this.detail.jobProgress || {}).jobPercentComplete || 0;
  }

  get errorMessage() {
    return this.detail.errorMessage;
  }

  get errorCode() {
    return this.detail.errorCode;
  }

  async process() {
    const response = await ServiceToken.getData(this.jobId).catch(() => undefined);
    if (!response || !response.service || !response.token || !response.api) {
      throw new Error(`fail to get token, ${this.jobId}`);
    }

    this.token = response.token;
    this.service = response.service;
    this.api = response.api;
    this.stateData = JSON.parse(JSON.stringify(response.data));

    let completed = true;
    switch (this.status) {
      case TranscodeStatus.Event.Completed:
        await this.onCompleted();
        break;
      case TranscodeStatus.Event.InProgress:
        await this.onProgress();
        completed = false;
        break;
      case TranscodeStatus.Event.Canceled:
      case TranscodeStatus.Event.Error:
      default:
        await this.onError();
        break;
    }
    if (completed) {
      await ServiceToken.unregister(this.jobId).catch(() => undefined);
    }
    return response.data;
  }

  async onCompleted() {
    const data = this.stateData.output[States.StartMediaConvert];
    data.status = TranscodeStatus.Mapping[this.status];
    data.metrics.t1 = new Date().getTime();
    return this.parent.sendTaskSuccess();
  }

  async onError() {
    const data = this.stateData.output[States.StartMediaConvert];
    const error = (this.status === TranscodeStatus.Event.Canceled)
      ? new Error('user canceled job')
      : (this.status === TranscodeStatus.Event.Error)
        ? new Error(`${this.errorMessage} (${this.errorCode})`)
        : new Error();
    data.status = TranscodeStatus.Mapping[this.status] || 'error';
    data.errorMessage = error.message;
    data.metrics.t1 = new Date().getTime();
    return this.parent.sendTaskFailure(error);
  }

  async onProgress() {
    return this.stateData;
  }
}

module.exports = {
  TranscodeStatus,
};
