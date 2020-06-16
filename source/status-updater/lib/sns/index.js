// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const AWS = require('aws-sdk');

const {
  ServiceToken,
} = require('core-lib');

const {
  VideoAnalysisStatus,
} = require('./videoAnalysisStatus');

class SnsStatus {
  constructor(event, context) {
    this.$event = event;
    this.$context = context;
    this.$message = JSON.parse(event.Records[0].Sns.Message);
    this.$timestamp = new Date(event.Records[0].Sns.Timestamp).getTime();
    this.$token = undefined;
    this.$api = undefined;
    this.$service = undefined;
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

  get service() {
    return this.$service;
  }

  set service(val) {
    this.$service = val;
  }

  get api() {
    return this.$api;
  }

  set api(val) {
    this.$api = val;
  }

  get stateData() {
    return this.$stateData;
  }

  set stateData(val) {
    this.$stateData = val;
  }

  get message() {
    return this.$message;
  }

  get timestamp() {
    return this.$timestamp;
  }

  async process() {
    /* note: different service sns message uses different key name for job id */
    const id = this.message.JobId || this.message.jobId;
    const response = await ServiceToken.getData(id).catch(() => undefined);

    if (!response || !response.service || !response.token || !response.api) {
      throw new Error(`fail to get token, ${id}`);
    }

    this.token = response.token;
    this.api = response.api;
    this.service = response.service;
    this.stateData = JSON.parse(JSON.stringify(response.data));

    let instance;
    switch (this.service) {
      case VideoAnalysisStatus.ServiceTypes.Rekognition:
        instance = new VideoAnalysisStatus(this);
        break;
      default:
        break;
    }

    if (!instance) {
      throw new Error(`fail to get service, ${this.service}`);
    }

    await instance.process();
    return this.stateData;
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
  SnsStatus,
};
