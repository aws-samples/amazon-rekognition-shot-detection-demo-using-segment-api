// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const PATH = require('path');

const LambdaTimeoutThreshold = 60 * 1000;

module.exports = Base => class extends Base {
  constructor(event, context) {
    super(event, context);
    this.$t0 = new Date().getTime();
    this.$event = event;
    this.$context = context;
    this.$input = event.input;
    this.$output = event.output || {};
    this.$accountId = context.invokedFunctionArn.split(':')[4];
    this.$region = process.env.AWS_REGION || context.invokedFunctionArn.split(':')[3];
    this.$fnGetRemainingTime = (typeof context.getRemainingTimeInMillis === 'function')
      ? context.getRemainingTimeInMillis.bind()
      : undefined;
    this.sanityCheck();
  }

  sanityCheck() {
    if (!this.input) {
      throw new Error('missing input');
    }
    if (!this.input.bucket || !this.input.key) {
      throw new Error('missing bucket and key');
    }
  }

  get t0() {
    return this.$t0;
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

  get input() {
    return this.$input;
  }

  set input(val) {
    this.$input = JSON.parse(JSON.stringify(val));
  }

  get output() {
    return this.$output;
  }

  set output(val) {
    this.$output = JSON.parse(JSON.stringify(val));
  }

  toJSON() {
    return {
      input: this.input,
      output: this.output,
    };
  }

  getRemainingTime() {
    return this.$fnGetRemainingTime
      ? this.$fnGetRemainingTime()
      : LambdaTimeoutThreshold + 10;
  }

  quitNow() {
    return (this.getRemainingTime() - LambdaTimeoutThreshold) <= 0;
  }

  makeOutputPath(ref, subPath = '') {
    const parsed = PATH.parse(ref);
    return PATH.join(parsed.dir, parsed.name, subPath);
  }

  setOutput(state, data) {
    this.output[state] = {
      ...this.output[state],
      ...data,
      metrics: {
        t0: this.t0,
        t1: new Date().getTime(),
      },
    };
  }

  async process() {
    return this.toJSON();
  }
};
