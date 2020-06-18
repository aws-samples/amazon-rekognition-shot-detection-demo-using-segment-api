// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const AWS = require('aws-sdk');
const PATH = require('path');
const {
  EDLComposer,
} = require('core-lib');
const {
  mxValidation,
} = require('./mxValidation');

class ApiRequest extends mxValidation(class {}) {
  constructor(event, context) {
    super();
    this.$event = event;
    this.$context = context;
    this.$accountId = context.invokedFunctionArn.split(':')[4];
    const identity = ((event.requestContext || {}).identity || {}).cognitoIdentityId
      || (event.queryStringParameters || {}).requester;
    this.$cognitoIdentityId = (identity)
      ? decodeURIComponent(identity)
      : undefined;

    try {
      this.$body = JSON.parse(this.$event.body);
    } catch (e) {
      this.$body = {};
    }
  }

  static get Methods() {
    return {
      OPTIONS: 'OPTIONS',
      GET: 'GET',
      POST: 'POST',
    };
  }

  static get Constants() {
    return {
      AllowMethods: Object.values(ApiRequest.Methods),
      AllowHeaders: [
        'Authorization',
        'Host',
        'Content-Type',
        'X-Amz-Date',
        'X-Api-Key',
        'X-Amz-Security-Token',
        'x-amz-content-sha256',
        'x-amz-user-agent',
      ],
    };
  }

  static get Operations() {
    return {
      Analyze: 'analyze',
      Convert: 'convert',
    };
  }

  get event() {
    return this.$event;
  }

  get context() {
    return this.$context;
  }

  get accountId() {
    return this.$accountId;
  }

  get cognitoIdentityId() {
    return this.$cognitoIdentityId;
  }

  get method() {
    return this.event.httpMethod;
  }

  get path() {
    return this.event.path;
  }

  get headers() {
    return this.event.headers;
  }

  get queryString() {
    return this.event.queryStringParameters;
  }

  get pathParameters() {
    return this.event.pathParameters;
  }

  get body() {
    return this.$body;
  }

  opSupported() {
    const op = (this.pathParameters || {}).operation;
    if (!this.testOperation(op)) {
      return false;
    }
    return !!(Object.values(ApiRequest.Operations)
      .find(x => x === op));
  }

  validateIdentity() {
    return !(this.cognitoIdentityId && !this.testCognitoIdentityId(this.cognitoIdentityId));
  }

  async onOPTIONS() {
    if (!this.validateIdentity()) {
      throw new Error('invalid user id');
    }
    if (!this.opSupported()) {
      throw new Error('operation not supported');
    }
    return this.onSucceeded();
  }

  async onGET() {
    if (!this.validateIdentity()) {
      throw new Error('invalid user id');
    }
    if (!this.opSupported()) {
      throw new Error('operation not supported');
    }
    const op = this.pathParameters.operation;
    if (op === ApiRequest.Operations.Analyze) {
      return this.onGetAnalysis();
    }
    throw new Error('operation not supported');
  }

  async onPOST() {
    if (!this.validateIdentity()) {
      throw new Error('invalid user id');
    }
    if (!this.opSupported()) {
      throw new Error('operation not supported');
    }
    const op = this.pathParameters.operation;
    if (op === ApiRequest.Operations.Analyze) {
      return this.onPostAnalysis();
    }
    if (op === ApiRequest.Operations.Convert) {
      return this.onPostConversion();
    }
    throw new Error('operation not supported');
  }

  async onSucceeded(payload) {
    return {
      statusCode: 200,
      headers: this.getCORS(payload),
      body: (!payload || typeof payload === 'string')
        ? payload
        : JSON.stringify(payload),
    };
  }

  async onError(e) {
    const payload = {
      ErrorMessage: `${this.method} ${this.path} - ${e.message || e.code || 'unknown error'}`,
    };
    console.error(e);
    return {
      statusCode: 400,
      headers: this.getCORS(payload),
      body: payload,
    };
  }

  getCORS(data) {
    const h0 = this.headers || {};
    return {
      'Content-Type': (!data || typeof data === 'string')
        ? 'text/plain'
        : 'application/json',
      'Access-Control-Allow-Methods': ApiRequest.Constants.AllowMethods.join(', '),
      'Access-Control-Allow-Headers': ApiRequest.Constants.AllowHeaders.join(', '),
      'Access-Control-Allow-Origin': h0.Origin || h0.origin || h0['X-Forwarded-For'] || '*',
      'Access-Control-Allow-Credentials': 'true',
    };
  }

  async onGetAnalysis() {
    const name = decodeURIComponent(this.queryString.stateMachine);
    let execution = this.queryString.execution;
    let token = this.queryString.token;
    let maxResults = this.queryString.maxResults;
    let filter = this.queryString.filter;

    if (!this.testStateMachineName(name)) {
      throw new Error('invalid state machine name');
    }
    if (execution) {
      execution = decodeURIComponent(execution);
      if (!this.testExecutionName(name)) {
        throw new Error('invalid state machine name');
      }
      const arn = [
        'arn:aws:states',
        process.env.AWS_REGION,
        this.accountId,
        'execution',
        name,
        execution,
      ].join(':');
      return this.onSucceeded(await this.describeExecution(arn));
    }
    if (token) {
      token = decodeURIComponent(token);
      if (token === 'undefined') {
        token = undefined;
      } else if (!this.testBase64String(token)) {
        throw new Error('invalid token');
      }
    }
    if (maxResults) {
      maxResults = Number.parseInt(maxResults, 10);
    }
    if (filter) {
      if (!this.testFilter(filter)) {
        throw new Error('invalid filter');
      }
      filter = filter.toUpperCase();
    }

    const arn = [
      'arn:aws:states',
      process.env.AWS_REGION,
      this.accountId,
      'stateMachine',
      name,
    ].join(':');
    return this.onSucceeded(await this.listExecutions(arn, filter, token, maxResults));
  }

  async onPostAnalysis() {
    const input = this.body.input;
    if (!(input.bucket && input.key)) {
      throw new Error('\'bucket\' and \'key\' must be specified');
    }
    if (!this.testBucket(input.bucket)) {
      throw new Error('invalid bucket');
    }
    const name = decodeURIComponent(this.queryString.stateMachine);
    if (!this.testStateMachineName(name)) {
      throw new Error('invalid state machine name');
    }

    const arn = [
      'arn:aws:states',
      process.env.AWS_REGION,
      this.accountId,
      'stateMachine',
      name,
    ].join(':');
    let response = await this.startExecution(arn, {
      input,
    });
    response = await this.describeExecution(response.executionArn);
    return this.onSucceeded(response);
  }

  async onPostConversion() {
    let missing = [
      'name',
      'data',
    ].filter(x => this.body[x] === undefined);
    if (missing.length) {
      throw new Error(`missing ${missing.join(', ')}`);
    }

    missing = [
      'VideoMetadata',
      'Segments',
    ].filter(x => this.body.data[x] === undefined);
    if (missing.length) {
      throw new Error('invalid Segment JSON format');
    }

    const edl = this.createEDLFile(this.body.name, this.body.data);
    return this.onSucceeded(edl);
  }

  async startExecution(arn, data) {
    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    });
    return step.startExecution({
      stateMachineArn: arn,
      input: JSON.stringify(data, null, 2),
    }).promise();
  }

  async describeExecution(arn) {
    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    });
    const response = await step.describeExecution({
      executionArn: arn,
    }).promise();
    response.runningState = await this.getRunningState(response);
    return response;
  }

  async listExecutions(arn, filter, token, maxResults = 20) {
    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    });

    const response = await step.listExecutions({
      stateMachineArn: arn,
      statusFilter: filter,
      maxResults,
      nextToken: token,
    }).promise();

    const executions = await Promise.all(response.executions.map(x =>
      this.describeExecution(x.executionArn)));
    response.executions = executions;
    return response;
  }

  async getRunningState(data) {
    if (data.status !== 'RUNNING') {
      return undefined;
    }
    const step = new AWS.StepFunctions({
      apiVersion: '2016-11-23',
    });
    const history = await step.getExecutionHistory({
      executionArn: data.executionArn,
      maxResults: 10,
      reverseOrder: true,
    }).promise();
    return this.parseLastActiveState(history.events);
  }

  parseLastActiveState(events) {
    const state = events.find(x => x.type === 'TaskStateEntered');
    return ((state || {}).stateEnteredEventDetails)
      ? state.stateEnteredEventDetails.name
      : undefined;
  }

  createEDLFile(name, data) {
    const parsed = PATH.parse(name);
    let idx = 0;
    const events = [];
    while (data.Segments.length) {
      const segment = data.Segments.shift();
      if (segment.Type !== 'SHOT') {
        continue;
      }
      events.push({
        id: idx + 1,
        startTime: segment.StartTimecodeSMPTE,
        endTime: segment.EndTimecodeSMPTE,
        reelName: `Shot ${segment.ShotSegment.Index.toString().padStart(3, '0')}`,
        clipName: parsed.name,
      });
      idx++;
    }
    const edl = new EDLComposer({
      title: parsed.name.replace(/[\W_]+/g, ' '),
      events,
    });
    return edl.compose();
  }
}

module.exports = {
  ApiRequest,
};
