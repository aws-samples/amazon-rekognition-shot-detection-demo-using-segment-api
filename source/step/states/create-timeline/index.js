// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const PATH = require('path');
const {
  States,
  S3Utils,
  EDLComposer,
} = require('core-lib');
const WebVttTrack = require('./webVttTrack');
const mxBaseState = require('../../shared/mxBaseState');

class StateCreateTimeline extends mxBaseState(class {}) {
  async process() {
    const output = await this.createTrack();
    this.setOutput(States.CreateTimeline, output);
    return super.process();
  }

  async createTrack() {
    const prevState = this.output[States.CollectDetectionResults];
    let idx = 0;
    const shots = [];
    const cues = [];
    while (idx < prevState.output.parts) {
      const name = `${String(idx++).padStart(8, '0')}.json`;
      const result = await this.parseResults(prevState.output.prefix, name);
      shots.splice(shots.length, 0, ...result[0]);
      cues.splice(cues.length, 0, ...result[1]);
    }
    const promises = [];
    if (shots.length) {
      promises.push(this.createShotSegmentTrack(shots));
      promises.push(this.createEDLFile(shots));
    }
    if (cues.length) {
      promises.push(this.createTechnicalCueTrack(cues));
    }
    const keys = await Promise.all(promises);
    return {
      bucket: this.input.bucket,
      keys,
    };
  }

  async parseResults(prefix, name) {
    const bucket = this.input.bucket;
    const key = PATH.join(prefix, name);
    const shots = [];
    const cues = [];
    let response = await S3Utils.getObject(bucket, key);
    response = JSON.parse(response.Body);
    const segments = (response || {}).Segments || [];
    while (segments.length) {
      const segment = segments.shift();
      if (segment.Type === 'TECHNICAL_CUE') {
        cues.push({
          name: segment.TechnicalCueSegment.Type,
          confidence: segment.TechnicalCueSegment.Confidence,
          begin: segment.StartTimestampMillis,
          end: segment.EndTimestampMillis,
          smpteBegin: segment.StartTimecodeSMPTE,
          smpteEnd: segment.EndTimecodeSMPTE,
        });
      } else if (segment.Type === 'SHOT') {
        shots.push({
          name: `Shot ${segment.ShotSegment.Index.toString().padStart(3, '0')}`,
          confidence: segment.ShotSegment.Confidence,
          begin: segment.StartTimestampMillis,
          end: segment.EndTimestampMillis,
          smpteBegin: segment.StartTimecodeSMPTE,
          smpteEnd: segment.EndTimecodeSMPTE,
        });
      }
    }
    return [
      shots,
      cues,
    ];
  }

  async createShotSegmentTrack(shots) {
    const name = 'shot_segments';
    const key = PATH.join(this.makeOutputPath(this.input.key, States.CreateTimeline), `${name}.vtt`);
    const body = this.createWebVtt(name, shots, {
      line: 0,
      position: 0,
      align: 'start',
    });
    await S3Utils.upload(this.input.bucket, key, body, {
      ContentType: 'text/vtt',
    });
    return key;
  }

  async createEDLFile(shots) {
    const parsed = PATH.parse(this.input.key);
    const events = [];
    for (let i = 0; i < shots.length; i++) {
      events.push({
        id: i + 1,
        reelName: shots[i].name,
        startTime: shots[i].smpteBegin,
        endTime: shots[i].smpteEnd,
        clipName: parsed.base,
      });
    }
    const edl = new EDLComposer({
      title: parsed.name.replace(/[\W_]+/g, ' '),
      events,
    });
    const body = edl.compose();
    const key = PATH.join(this.makeOutputPath(this.input.key, States.CreateTimeline), `${parsed.name}.edl`);
    await S3Utils.upload(this.input.bucket, key, body, {
      ContentType: 'application/octet-stream',
      ContentDisposition: `attachment; filename="${parsed.name}.edl"`,
    });
    return key;
  }

  async createTechnicalCueTrack(cues) {
    const name = 'technical_cues';
    const key = PATH.join(this.makeOutputPath(this.input.key, States.CreateTimeline), `${name}.vtt`);
    const body = this.createWebVtt(name, cues, {
      line: 0,
      position: 100,
      align: 'end',
    });
    await S3Utils.upload(this.input.bucket, key, body, {
      ContentType: 'text/vtt',
    });
    return key;
  }

  createWebVtt(name, items, placement) {
    const track = new WebVttTrack();
    items.forEach((x) => {
      const cueText = [
        x.name,
        `<c.confidence>(${Number.parseFloat(x.confidence).toFixed(2)})</c>`,
      ].join(' ');
      const cueAlignment = [
        `align:${placement.align}`,
        `line:${placement.line}%`,
        `position:${placement.position}%`,
        'size:25%',
      ].join(' ');
      track.addCue(x.begin, x.end, cueText, cueAlignment);
    });
    return track.toString();
  }
}

module.exports = StateCreateTimeline;
