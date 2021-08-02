// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const PATH = require('path');
const {
  States,
  S3Utils,
  EDLComposer,
  AdmZip,
} = require('core-lib');
const WebVttTrack = require('./webVttTrack');
const mxBaseState = require('../../shared/mxBaseState');

const TYPE_SHOT = 'SHOT';
const CUE_ALIGNMENT_START = {
  line: 0,
  position: 0,
  align: 'start',
};
const CUE_ALIGNMENT_END = {
  line: 0,
  position: 100,
  align: 'end',
};

class StateCreateTimeline extends mxBaseState(class {}) {
  async process() {
    const output = await this.createTrack();
    this.setOutput(States.CreateTimeline, output);
    return super.process();
  }

  async createTrack() {
    const prevState = this.output[States.CollectDetectionResults];
    let idx = 0;
    const detections = {};
    while (idx < prevState.output.parts) {
      const name = `${String(idx++).padStart(8, '0')}.json`;
      const results = await this.parseResults(prevState.output.prefix, name);
      Object.keys(results).map((x) => {
        if (detections[x] === undefined) {
          detections[x] = [];
        }
        return detections[x].splice(detections[x].length, 0, ...results[x]);
      });
    }
    /* create webvtt track */
    const vttFiles = await this.createWebVttFiles(detections);
    /* create EDL zip package */
    const edlZipFile = await this.createEdlZipFile(detections);
    const keys = [
      ...vttFiles,
      edlZipFile,
    ].filter(x => x);
    return {
      bucket: this.input.bucket,
      keys,
    };
  }

  async parseResults(prefix, name) {
    const bucket = this.input.bucket;
    const key = PATH.join(prefix, name);
    const detections = {};
    const data = await S3Utils.getObject(bucket, key).then((res) => JSON.parse(res.Body));
    while (data.Segments.length) {
      const segment = data.Segments.shift();
      if (segment.Type === TYPE_SHOT) {
        if (detections.shot === undefined) {
          detections.shot = [];
        }
        detections.shot.push({
          type: segment.Type,
          name: `Shot ${segment.ShotSegment.Index.toString().padStart(3, '0')}`,
          confidence: segment.ShotSegment.Confidence,
          begin: segment.StartTimestampMillis,
          end: segment.EndTimestampMillis,
          smpteBegin: segment.StartTimecodeSMPTE,
          smpteEnd: segment.EndTimecodeSMPTE,
        });
      } else {
        const typed = segment.TechnicalCueSegment.Type.toLowerCase();
        if (detections[typed] === undefined) {
          detections[typed] = [];
        }
        detections[typed].push({
          type: segment.TechnicalCueSegment.Type,
          name: `${segment.TechnicalCueSegment.Type.substring(0, 5)}${String(detections[typed].length).padStart(3, '0')}`,
          confidence: segment.TechnicalCueSegment.Confidence,
          begin: segment.StartTimestampMillis,
          end: segment.EndTimestampMillis,
          smpteBegin: segment.StartTimecodeSMPTE,
          smpteEnd: segment.EndTimecodeSMPTE,
        });
      }
    }
    return detections;
  }

  async createWebVttFiles(detections) {
    const bucket = this.input.bucket;
    const prefix = this.makeOutputPath(this.input.key, States.CreateTimeline);
    const promises = Object.values(detections).map((data) => {
      if (!data || data.length === 0) {
        return undefined;
      }
      const name = data[0].type.toLowerCase();
      const outKey = PATH.join(prefix, `${name}.vtt`);
      const alignment = (name === 'shot')
        ? CUE_ALIGNMENT_START
        : CUE_ALIGNMENT_END;
      const body = this.createWebVtt(name, data, alignment);
      return S3Utils.upload(bucket, outKey, body, {
        ContentType: 'text/vtt',
      }).then(() => outKey);
    });
    return Promise.all(promises);
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

  async createEdlZipFile(detections) {
    const zip = new AdmZip();
    const parsed = PATH.parse(this.input.key);
    const title = parsed.name.replace(/[\W_]+/g, ' ');
    Object.values(detections).forEach((data) => {
      if (data.length === 0) {
        return;
      }
      const type = data[0].type.toLowerCase();
      const events = data.map((item, idx) => ({
        id: idx + 1,
        reelName: item.name,
        clipName: parsed.base,
        startTime: item.smpteBegin,
        endTime: item.smpteEnd,
      }));
      const edl = new EDLComposer({
        title,
        events,
      });
      const buf = Buffer.from(edl.compose(), 'utf8');
      zip.addFile(`${type}.edl`, buf, type);
    });
    const bucket = this.input.bucket;
    const prefix = this.makeOutputPath(this.input.key, States.CreateTimeline);
    const name = `${parsed.name}.zip`;
    return S3Utils.upload(bucket, PATH.join(prefix, name), zip.toBuffer(), {
      ContentType: 'application/zip',
      ContentDisposition: `attachment; filename="${name}"`,
    }).then(() => PATH.join(prefix, name));
  }
}

module.exports = StateCreateTimeline;
