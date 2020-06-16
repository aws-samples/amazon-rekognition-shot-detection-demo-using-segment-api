// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const {
  States,
} = require('core-lib');
const StateMediainfo = require('./states/run-mediainfo');
const StateMediaConvert = require('./states/start-mediaconvert');
const StateSegmentDetection = require('./states/start-segment-detection');
const StateCollectDetectionResults = require('./states/collect-detection-results');
const StateCreateTimeline = require('./states/create-timeline');

exports.handler = async (event, context) => {
  console.log(`event = ${JSON.stringify(event, null, 2)};\ncontext = ${JSON.stringify(context, null, 2)};`);
  let handler;
  try {
    if (event.state === States.RunMediainfo) {
      handler = new StateMediainfo(event, context);
    } else if (event.state === States.StartMediaConvert) {
      handler = new StateMediaConvert(event, context);
    } else if (event.state === States.StartSegmentDetection) {
      handler = new StateSegmentDetection(event, context);
    } else if (event.state === States.CollectDetectionResults) {
      handler = new StateCollectDetectionResults(event, context);
    } else if (event.state === States.CreateTimeline) {
      handler = new StateCreateTimeline(event, context);
    } else {
      throw new Error(`${event.state} not impl`);
    }
    return handler.process();
  } catch (e) {
    console.error(e);
    throw e;
  }
};
