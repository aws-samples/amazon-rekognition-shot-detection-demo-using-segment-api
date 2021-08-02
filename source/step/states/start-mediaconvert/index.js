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
    } = this.makeChannelMappings() || {};

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
    const tracks = this.parseTracks(audio);
    return (!tracks.length)
      ? undefined
      : {
        AudioSourceName: name,
        AudioSelectors: {
          [name]: {
            Offset: 0,
            DefaultSelection: 'DEFAULT',
            SelectorType: 'TRACK',
            Tracks: tracks,
          },
        },
      };
  }

  parseTracks(audio) {
    /* #0: reorder audio tracks */
    const reordered = audio.sort((a, b) => {
      const a0 = (a.streamIdentifier !== undefined) ? a.streamIdentifier : a.streamOrder;
      const b0 = (b.streamIdentifier !== undefined) ? b.streamIdentifier : b.streamOrder;
      return a0 - b0;
    }).map((x, idx) => ({
      ...x,
      trackIdx: idx + 1,
    }));
    /* #1: input has no audio */
    if (!reordered.length) {
      return [];
    }
    /* #2: input has one audio track */
    if (reordered.length === 1) {
      return [reordered[0].trackIdx];
    }
    /* #3: multiple audio tracks and contain stereo track */
    for (let i = 0; i < reordered.length; i++) {
      if (this.getChannels(reordered[i]) >= 2) {
        return [reordered[i].trackIdx];
      }
    }
    /* #4: multiple audio tracks and contain Dolby E track */
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].format === 'Dolby E') {
        return [reordered[i].trackIdx];
      }
    }
    /* #5: multiple PCM mono audio tracks, take the first 2 mono tracks */
    const pcms = reordered.filter(x => this.getChannels(x) === 1);
    return pcms.slice(0, 2).map(x => x.trackIdx);
  }

  getChannels(track) {
    return (track.channelS !== undefined)
      ? track.channelS
      : track.channels;
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
