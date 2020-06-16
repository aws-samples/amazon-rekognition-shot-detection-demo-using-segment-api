// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const PATH = require('path');
const {
  MediaInfoCommand,
} = require('mediainfo');
const {
  States,
  S3Utils,
} = require('core-lib');
const mxBaseState = require('../../shared/mxBaseState');

class StateMediainfo extends mxBaseState(class {}) {
  async process() {
    const output = await this.runMediainfo();
    this.setOutput(States.RunMediainfo, output);
    return super.process();
  }

  async runMediainfo() {
    const src = this.input;

    const mi = new MediaInfoCommand();
    await mi.analyze({
      Bucket: src.bucket,
      Key: src.key,
    });

    const name = 'mediainfo.json';
    const prefix = this.makeOutputPath(src.key, States.RunMediainfo);
    const body = JSON.stringify(mi.toJSON(), null, 2);
    await S3Utils.upload(src.bucket, PATH.join(prefix, name), body, {
      ContentType: 'application/json',
      ContentDisposition: `attachment; filename="${name}"`,
    });

    return {
      mediainfo: mi.miniData,
      output: {
        bucket: src.bucket,
        key: PATH.join(prefix, name),
      },
    };
  }
}

module.exports = StateMediainfo;
