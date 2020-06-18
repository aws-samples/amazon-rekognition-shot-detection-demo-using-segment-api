// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const AWS = require('aws-sdk');
const FS = require('fs');
const PATH = require('path');
const {
  States,
  ServiceToken,
} = require('core-lib');
const mxBaseState = require('../../shared/mxBaseState');

class StateMediaConvert extends mxBaseState(class {}) {
  async process() {
    const output = await this.startMediaConvert();
    this.setOutput(States.StartMediaConvert, output);
    await this.registerToken();
    return super.process();
  }

  sanityCheck() {
    const missing = [
      'ENV_SOLUTION_UUID',
      'ENV_MEDIACONVERT_HOST',
      'ENV_MEDIACONVERT_ROLE',
    ].filter(x => process.env[x] === undefined);
    if (missing.length > 0) {
      throw new Error(`missing env.${missing.join(', ')}`);
    }
    return super.sanityCheck();
  }

  static get Constants() {
    return {
      ServiceName: 'mediaconvert',
    };
  }

  async startMediaConvert() {
    const template = this.makeJobTemplate();
    const mc = new AWS.MediaConvert({
      apiVersion: '2017-08-29',
      endpoint: process.env.ENV_MEDIACONVERT_HOST,
    });
    const response = await mc.createJob(template).promise();
    return {
      jobId: response.Job.Id,
      output: {
        bucket: this.input.bucket,
        prefix: `${this.makeOutputPath(this.input.key, States.StartMediaConvert)}/`,
      },
    };
  }

  makeJobTemplate() {
    const {
      AudioSourceName,
      AudioSelectors,
    } = this.makeChannelMappings();

    return {
      Role: process.env.ENV_MEDIACONVERT_ROLE,
      Settings: {
        OutputGroups: this.makeOutputGroup(AudioSourceName),
        AdAvailOffset: 0,
        Inputs: [
          {
            AudioSelectors,
            VideoSelector: {
              ColorSpace: 'FOLLOW',
              Rotate: 'AUTO',
            },
            FilterEnable: 'AUTO',
            PsiControl: 'USE_PSI',
            FilterStrength: 0,
            DeblockFilter: 'DISABLED',
            DenoiseFilter: 'DISABLED',
            TimecodeSource: 'EMBEDDED',
            FileInput: `s3://${this.input.bucket}/${this.input.key}`,
          },
        ],
      },
      UserMetadata: this.makeUserMetadata(),
    };
  }

  makeChannelMappings() {
    const audio = this.output[States.RunMediainfo].mediainfo.audio || [];
    const name = 'Audio Selector 1';
    let tracks = (audio.length === 1)
      ? audio[0]
      : audio.find(x => x.channelS >= 2)
      || audio.find(x => x.format === 'Dolby E')
      || audio.filter(x => x.channelS === 1).sort((a, b) =>
        a.streamIdentifier - b.streamIdentifier).slice(0, 2);

    if (tracks && !Array.isArray(tracks)) {
      tracks = [tracks];
    }
    return (!tracks || !tracks.length)
      ? {}
      : {
        AudioSourceName: name,
        AudioSelectors: {
          [name]: {
            Offset: 0,
            DefaultSelection: 'DEFAULT',
            SelectorType: 'TRACK',
            /* note: streamIdentifier is 0-based, Track is 1-based */
            Tracks: tracks.map(x => x.streamIdentifier + 1),
          },
        },
      };
  }

  makeOutputGroup(aName) {
    const src = this.input;
    const tmpl = PATH.join(__dirname, 'tmpl/outputGroup.json');
    const ogs = JSON.parse(FS.readFileSync(tmpl));
    const prefix = this.makeOutputPath(src.key, States.StartMediaConvert);
    /* eslint-disable no-param-reassign */
    ogs.forEach((og) => {
      og.OutputGroupSettings.FileGroupSettings.Destination = `s3://${src.bucket}/${prefix}/`;
      og.Outputs.forEach((o) => {
        if (!aName) {
          delete o.AudioDescriptions;
        } else if (o.AudioDescriptions) {
          o.AudioDescriptions.forEach(a => {
            a.AudioSourceName = aName;
          });
        }
      });
      /* make sure each output has at least one valid output stream */
      og.Outputs = og.Outputs.filter(x =>
        x.CaptionDescriptions || x.AudioDescriptions || x.VideoDescription);
    });
    /* eslint-enable no-param-reassign */
    return ogs;
  }

  makeUserMetadata() {
    return {
      solutionUuid: process.env.ENV_SOLUTION_UUID,
    };
  }

  async registerToken() {
    return ServiceToken.register(
      this.output[States.StartMediaConvert].jobId,
      this.event.token,
      StateMediaConvert.Constants.ServiceName,
      States.StartMediaConvert,
      this.toJSON()
    );
  }
}

module.exports = StateMediaConvert;
