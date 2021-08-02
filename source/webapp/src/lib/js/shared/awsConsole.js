// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import SolutionManifest from '/solution-manifest.js';

export class AWSConsoleS3 {
  static getS3Link(bucket, key) {
    return (key)
      ? `https://s3.console.aws.amazon.com/s3/object/${bucket}/${key}?region=${SolutionManifest.Region}`
      : `https://s3.console.aws.amazon.com/s3/buckets/${bucket}/?region=${SolutionManifest.Region}`;
  }
}

export class AWSConsoleStepFunctions {
  static getExecutionLink(arn) {
    return `https://console.aws.amazon.com/states/home?region=${SolutionManifest.Region}#/executions/details/${arn}`;
  }
}

export class AWSConsoleMediaConvert {
  static getJobLink(jobId) {
    return `https://console.aws.amazon.com/mediaconvert/home?region=${SolutionManifest.Region}#/jobs/summary/${jobId}`;
  }
}
