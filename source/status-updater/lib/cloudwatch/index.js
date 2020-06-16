// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const AWS = require('aws-sdk');
const {
  TranscodeStatus,
} = require('./transcodeStatus');


class CloudWatchStatus {
  constructor(event, context) {
    this.$event = event;
    this.$context = context;
    this.$token = undefined;
    this.$stateData = undefined;
  }

  get event() {
    return this.$event;
  }

  get context() {
    return this.$context;
  }

  get token() {
    return this.$token;
  }

  set token(val) {
    this.$token = val;
  }

  get stateData() {
    return this.$stateData;
  }

  set stateData(val) {
    this.$stateData = val;
  }

  get source() {
    return this.event.source;
  }

  get detail() {
    return this.event.detail;
  }

  get timestamp() {
    return new Date(this.event.time).getTime();
  }

  async process() {
    let instance;
    if (this.source === TranscodeStatus.SourceType) {
      instance = new TranscodeStatus(this);
    } else {
      throw new Error(`${this.source} not supported`);
    }
    return instance.process();
  }

  async sendTaskSuccess() {
    return (new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    })).sendTaskSuccess({
      output: JSON.stringify(this.stateData),
      taskToken: this.token,
    }).promise();
  }

  async sendTaskFailure(error) {
    return (new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    })).sendTaskFailure({
      taskToken: this.token,
      error: 'Error',
      cause: error.message,
    }).promise();
  }
}

module.exports = {
  CloudWatchStatus,
};
