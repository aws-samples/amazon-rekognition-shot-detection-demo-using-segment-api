// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const AWS = require('aws-sdk');
const PATH = require('path');
const CRYPTO = require('crypto');
const {
  States,
  S3Utils,
  ServiceToken,
} = require('core-lib');
const mxBaseState = require('../../shared/mxBaseState');

class StateSegmentDetection extends mxBaseState(class {}) {
  constructor(event, context) {
    super(event, context);
    this.$tag = [
      process.env.ENV_SOLUTION_UUID,
      CRYPTO.randomBytes(8).toString('hex'),
    ].join('_');
  }

  async process() {
    const output = await this.startSegmentDetection();
    this.setOutput(States.StartSegmentDetection, output);
    await this.registerToken();
    return super.process();
  }

  get tag() {
    return this.$tag;
  }

  sanityCheck() {
    let missing = [
      'ENV_SOLUTION_UUID',
      'ENV_SERVICE_TOPIC_ROLE_ARN',
      'ENV_SERVICE_TOPIC_ARN',
    ].filter(x => process.env[x] === undefined);
    if (missing.length > 0) {
      throw new Error(`missing env.${missing.join(', ')}`);
    }
    const prevStateOutput = this.output[States.StartMediaConvert].output;
    missing = [
      'bucket',
      'prefix',
    ].filter(x => prevStateOutput[x] === undefined);
    if (missing.length > 0) {
      throw new Error(`missing output.${missing.join(', ')}`);
    }
    return super.sanityCheck();
  }

  static get Constants() {
    return {
      ServiceName: 'rekognition',
      Targets: {
        StartSegmentDetection: 'StartSegmentDetection',
        GetSegmentDetection: 'GetSegmentDetection',
      },
      MinConfidence: 80.0,
    };
  }

  async startSegmentDetection() {
    const params = await this.makeParams();
    const rekog = new AWS.Rekognition({
      rekognition: '2016-06-27',
    });
    const response = await rekog.startSegmentDetection(params).promise();

    if (!(response || {}).JobId) {
      throw new Error(`${params.Video.S3Object.Name} startSegmentDetection job failed`);
    }

    return {
      jobId: response.JobId,
    };
  }

  async makeParams() {
    const prevStateOutput = this.output[States.StartMediaConvert].output;
    const response = await S3Utils.listObjects(prevStateOutput.bucket, prevStateOutput.prefix);
    const video = response.find(x => PATH.parse(x.Key).ext === '.mp4');
    if (!video) {
      throw new Error('fail to find transcoded mp4');
    }
    return {
      JobTag: this.tag,
      ClientRequestToken: this.tag,
      Video: {
        S3Object: {
          Bucket: prevStateOutput.bucket,
          Name: video.Key,
        },
      },
      NotificationChannel: {
        RoleArn: process.env.ENV_SERVICE_TOPIC_ROLE_ARN,
        SNSTopicArn: process.env.ENV_SERVICE_TOPIC_ARN,
      },
      SegmentTypes: [
        'TECHNICAL_CUE',
        'SHOT',
      ],
      Filters: {
        ShotFilter: {
          MinSegmentConfidence: StateSegmentDetection.Constants.MinConfidence,
        },
        TechnicalCueFilter: {
          MinSegmentConfidence: StateSegmentDetection.Constants.MinConfidence,
        },
      },
    };
  }

  async registerToken() {
    return ServiceToken.register(
      this.output[States.StartSegmentDetection].jobId,
      this.event.token,
      StateSegmentDetection.Constants.ServiceName,
      States.StartSegmentDetection,
      this.toJSON()
    );
  }
}

module.exports = StateSegmentDetection;
