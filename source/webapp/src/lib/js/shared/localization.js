// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
export default class Localization {
  static get isoCode() {
    return 'en-US';
  }

  static get Messages() {
    return Localization.Languages[Localization.isoCode].Messages;
  }

  static get Tooltips() {
    return Localization.Languages[Localization.isoCode].Tooltips;
  }

  static get Buttons() {
    return Localization.Languages[Localization.isoCode].Buttons;
  }

  static get Alerts() {
    return Localization.Languages[Localization.isoCode].Alerts;
  }

  static get Statuses() {
    return Localization.Languages[Localization.isoCode].Statuses;
  }

  static get Languages() {
    return {
      'en-US': {
        Messages: {
          /* signin flow */
          Title: 'Segment Detection Demo <span style="font-size:0.75rem">by AWS Specialist SA, M&E Team</span>',
          PasswordRequirement: 'Password must be at least <abbr title="eight characters">eight</abbr> characters long and contain <abbr title="one uppercase character">one</abbr> uppercase, <abbr title="one lowercase character">one</abbr> lowercase, <abbr title="one numeric character">one</abbr> number, and <abbr title="one special character">one</abbr> special character.',
          ResetSendCode: 'Please enter the username and press <strong>Send code</strong>. You should receive a 6-digits code in mail in a few minutes. You will need the code to reset the password.',
          ResetPassword: 'Please enter the verification code that has sent to your email address and your new password.',
          /* collection tab panel */
          DemoTab: 'Analysis',
          ConvertTab: 'SimpleConvert',
          DropzoneDesc: '<p>Drag and drop video to the \'drop area\' to start analysis. Video file extensions can be .mp4, .m4v, .mov, .mxf, .mpg, .mpeg, .m2ts, .ts, .avi, .wmv, .mkv, or .webm. Check out <a href="https://docs.aws.amazon.com/mediaconvert/latest/ug/reference-codecs-containers-input.html#reference-codecs-containers-input-video" target="_blank">AWS Elemental MediaConvert Supported Input Codecs and Containers</a>.</p><p>You can drop multiple videos or folders up to 20 files. (Note: Folder is supported in Chrome, Firefox, and Edge browsers.)</p>',
          DropzoneJsonDesc: '<p>This is a simple conversion tool to convert Amazon Rekognition Segment Detection JSON result into Edit Decision List (EDL) format. Drag and drop JSON (.json) file(s) to the \'drop area\' to start the conversion.',
          DropFilesHere: 'Drop video file(s) here',
          DropJsonHere: 'Drop JSON file(s) here',
          Download: 'Download',
          ViewJson: 'View JSON',
          ViewMetric: 'Metrics',
          Input: 'Input',
          Output: 'Output',
          FilesReadyToUpload: 'File(s) ready to upload',
          FilesBeingAnalysis: 'Analysis in process',
          MostRecentList: 'Most recently completed',
          ConversionList: 'Conversion list',
          Name: 'Name',
          Size: 'Size',
          Type: 'Type',
          Duration: 'Duration',
          Status: 'Status',
          DateAdded: 'Start Time',
          DateCompleted: 'End Time',
          Summary: 'Summary',
          Mediainfo: 'Mediainfo',
          ShotDetection: 'Segment Detection',
          ShotDetectionDesc: '<a href="" target="_blank">Amazon Rekognition Video Segment APIs</a> supports \'Shots\' and \'Techincal Cues\' detections. Click on the buttons to see the detection results in action.',
          EditDecisionListDesc: 'This demo converts the segments result into Edit Decision List (EDL) file. You can download and import the timeline into popular editing software.',
          StepFunctions: 'AWS Step Functions',
          StateMachineExecution: 'State Machine Execution',
          TotalElapsed: 'Total Elapsed',
          MediaConvert: 'AWS Elemental MediaConvert',
          JobId: 'Job Id',
          RekognitionVideo: 'Amazon Rekognition Video',
          Outputs: 'Output(s)',
        },
        Tooltips: {
          /* main view */
          VisitSolutionPage: 'Learn more about Amazon Rekognition Segment Detection',
          Logout: 'ready to logout?',
          ViewOnAWSConsole: 'view on console',
          DownloadFile: 'download file',
          Refresh: 'refresh status',
        },
        Buttons: {
          StartUpload: 'Start upload',
          StartConvert: 'Start convert',
          Done: 'Done',
          Back: 'Back',
          Next: 'Next',
          Cancel: 'Cancel',
          ClosePreview: 'Close preview window',
          DownloadEDL: 'Download EDL Package',
        },
        Statuses: {
          Processing: 'Processing',
          Completed: 'Completed',
          Elapsed: 'Elapsed',
        },
        Alerts: {
          Oops: 'Oops...',
          Warning: 'Warning',
          Confirmed: 'Confirmed',
          Info: 'Info',
          Success: 'Success',
          /* sign in */
          PasswordConformance: 'Passwords don\'t conform with the requirements. Please make sure the password is at least 8 characters, 1 uppercase, 1 lowercase, 1 numeric, and 1 special character.',
          UsernameConformance: 'Username don\'t conform with the requirements. Please make sure the username only contains alphanumeric and/or \'.\', \'_\', \'%\', \'+\', \'-\' characters',
          SignInProblem: 'Problem to sign in. Please try again.',
          MismatchPasswords: 'Passwords don\'t match. Please re-enter the password',
          PasswordConfirmed: 'Your new password has been set. Please re-sign in to the portal.',
          SessionExpired: 'Session expired. Please sign in again.',
        },
      },
    };
  }
}
