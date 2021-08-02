// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import Localization from '../../../shared/localization.js';
import S3Utils from '../../../shared/s3utils.js';
import AppUtils from '../../../shared/appUtils.js';
import {
  AWSConsoleStepFunctions,
  AWSConsoleMediaConvert,
} from '../../../shared/awsConsole.js';
import mxReadable from '../../../mixins/mxReadable.js';
import BaseSlideComponent from '../baseSlideComponent.js';

export default class PreviewSlideComponent extends mxReadable(BaseSlideComponent) {
  constructor() {
    super();
    this.$media = undefined;
    this.$ids = {
      ...super.ids,
      player: `vjs-${AppUtils.randomHexstring()}`,
    };
    this.$player = undefined;
    this.$trackCached = {};
    this.$mediaType = 'video/mp4';
  }

  static get Events() {
    return {
      Slide: {
        Close: 'slide:preview:close',
      },
    };
  }

  get media() {
    return this.$media;
  }

  set media(val) {
    this.$media = val;
  }

  get player() {
    return this.$player;
  }

  set player(val) {
    this.$player = val;
  }

  get trackCached() {
    return this.$trackCached;
  }

  set trackCached(val) {
    this.$trackCached = val;
  }

  get displayName() {
    if (!this.media) {
      return undefined;
    }
    const name = this.media.input.input.key;
    return name.substring(name.lastIndexOf('/') + 1);
  }

  get mediaType() {
    return this.$mediaType;
  }

  get mediainfo() {
    return (this.media || {}).mediainfo;
  }

  get readableDuration() {
    return (!this.mediainfo)
      ? '--'
      : PreviewSlideComponent.readableDuration(this.mediainfo.container[0].duration * 1000);
  }

  async setMedia(media) {
    if (this.media !== media) {
      await this.hide();
      this.media = media;
      await this.createSlide();
    }
    return super.show();
  }

  async show() {
    return this.slide;
  }

  async hide() {
    await this.unload();
    this.media = undefined;
    this.slide.children().remove();
    return super.hide();
  }

  async createSlide() {
    await this.unload();
    const close = this.createCloseButton();
    const title = $('<span/>').addClass('lead mx-auto align-self-center')
      .append(`${this.displayName} (${this.readableDuration})`);
    const row = $('<div/>').addClass('row no-gutters')
      .append($('<div/>').addClass('col-12 p-0 m-0 bg-light')
        .append($('<div/>').addClass('col-9 p-0 d-flex m-4 mx-auto')
          .append(title))
        .append($('<div/>').addClass('col-9 p-0 m-4 mx-auto')
          .append(this.createVideoView())))
      .append($('<div/>').addClass('col-12 p-0 m-0')
        .append(this.createResultTabs()))
      .append(close);
    this.slide.append(row);
    await this.load();
    return this.slide;
  }

  createCloseButton() {
    const icon = $('<i/>').addClass('far fa-times-circle text-secondary')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Buttons.ClosePreview)
      .css('font-size', '1.8rem');
    icon.tooltip();

    const btn = $('<div/>').addClass('close-preview')
      .append($('<button/>').addClass('btn btn-sm btn-link')
        .attr('type', 'button')
        .append(icon));
    btn.off('click').on('click', async (event) => {
      event.preventDefault();
      await this.beforeViewHide();
      this.slide.trigger(PreviewSlideComponent.Events.Slide.Close, [this.media]);
    });
    return btn;
  }

  createVideoView() {
    const poster = this.media.getPosterUrl();
    const videoEl = $('<video/>').addClass('video-js vjs-fluid w-100')
      .attr('id', this.ids.player)
      .attr('controls', 'controls')
      .attr('preload', 'metadata')
      .attr('poster', poster)
      .attr('crossorigin', 'anonymous');

    return $('<div/>').addClass('col-9 p-0 m-0 mx-auto')
      .append(videoEl);
  }

  async load() {
    const player = videojs(this.ids.player, {
      textTrackDisplay: {
        allowMultipleShowingTracks: true,
      },
    });
    player.markers({
      markers: [],
    });
    player.src({
      type: this.mediaType,
      src: this.media.getProxyVideoUrl(),
    });
    player.load();
    this.player = player;
    return this;
  }

  async unload() {
    if (this.player) {
      this.player.dispose();
    }
    this.player = undefined;
    this.trackCached = {};
    return this;
  }

  async beforeViewHide() {
    if (this.player) {
      this.player.pause();
    }
    return this;
  }

  createResultTabs() {
    const tabList = $('<div/>').addClass('list-group')
      .attr('id', 'list-tab')
      .attr('role', 'tablist');
    const tabContent = $('<div/>').addClass('tab-content')
      .attr('id', 'nav-tabContent');

    [
      this.createShotDetectionTab(),
      this.createSummaryTab(),
    ].forEach((x, idx) => {
      tabList.append(x[0]);
      tabContent.append(x[1]);
      if (idx === 0) {
        x[0].addClass('active');
        x[1].addClass('show active');
      }
    });

    const row = $('<div/>').addClass('row')
      .append($('<div/>').addClass('col-2')
        .append(tabList))
      .append($('<div/>').addClass('col-10')
        .append(tabContent));
    return row;
  }

  createTabAndContent(name) {
    const id = `tab-${AppUtils.randomHexstring()}`;
    const tabLink = $('<a/>').addClass('list-group-item list-group-item-action')
      .attr('id', `${id}-list`)
      .attr('href', `#${id}`)
      .attr('role', 'tab')
      .attr('data-toggle', 'list')
      .attr('aria-controls', name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase())
      .append(name);
    const tabContent = $('<div/>').addClass('tab-pane fade')
      .attr('id', id)
      .attr('role', 'tabpanel')
      .attr('labelledby', `${id}-list`);

    tabLink.on('click', async (event) => {
      event.preventDefault();
      return tabLink.tab('show');
    });
    return [
      tabLink,
      tabContent,
    ];
  }

  createShotDetectionTab() {
    const [
      tabLink,
      tabContent,
    ] = this.createTabAndContent(Localization.Messages.ShotDetection);

    const description = $('<p/>').addClass('lead-sm')
      .append(Localization.Messages.ShotDetectionDesc);
    const edlDescription = $('<p/>').addClass('lead-sm mt-4')
      .append(Localization.Messages.EditDecisionListDesc);

    const timeline = this.media.stateTimeline;
    const vtts = timeline.keys.filter(x =>
      x.substring(x.lastIndexOf('.')) === '.vtt');

    const btnTracks = vtts.map((vtt) => {
      const basename = vtt.substring(0, vtt.lastIndexOf('.')).split('/').pop();
      this.trackRegister(basename, vtt);
      return this.createTrackButton(basename);
    });

    const edl = timeline.keys.find(x =>
      x.substring(x.lastIndexOf('.')) === '.zip');
    const btnEdl = $('<a/>').addClass('btn btn-sm btn-success text-capitalize mb-1 ml-1')
      .attr('href', S3Utils.signUrl(timeline.bucket, edl))
      .attr('target', '_blank')
      .attr('download', edl.substring(0, edl.lastIndexOf('.')).split('/').pop())
      .attr('role', 'button')
      .append(Localization.Buttons.DownloadEDL);

    const col = $('<div/>').addClass('col-9 my-4')
      .append(description)
      .append(btnTracks)
      .append(edlDescription)
      .append(btnEdl);

    return [
      tabLink,
      tabContent.append(col),
    ];
  }

  createSummaryStepFunctions() {
    const overall = $('<details/>').addClass('mt-4')
      .append($('<summary/>').addClass('lead-sm')
        .append(Localization.Messages.StepFunctions));
    const execution = $('<a/>').addClass('badge badge-pill badge-primary mr-1 mb-1 lead-xs')
      .attr('href', AWSConsoleStepFunctions.getExecutionLink(this.media.executionArn))
      .attr('target', '_blank')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Tooltips.ViewOnAWSConsole)
      .html(this.media.name)
      .tooltip();
    const status = $('<span/>').addClass('badge badge-pill badge-success')
      .addClass('lead-xxs')
      .append(this.media.status);
    const startTime = new Date(this.media.startDate);
    const endTime = new Date(this.media.stopDate);

    const dl = $('<dl/>').addClass('row lead-xs ml-2 my-2 col-9 no-gutters')
      .append($('<dt/>').addClass('text-left col-sm-3')
        .append(Localization.Messages.StateMachineExecution))
      .append($('<dd/>').addClass('col-sm-9 mt-1 mb-0')
        .append(execution))
      .append($('<dt/>').addClass('text-left col-sm-3')
        .append(Localization.Messages.Status))
      .append($('<dd/>').addClass('col-sm-9 mt-1 mb-0')
        .append(status))
      .append($('<dt/>').addClass('text-left col-sm-3')
        .append(Localization.Messages.DateAdded))
      .append($('<dd/>').addClass('col-sm-9 mt-1 mb-0')
        .append(PreviewSlideComponent.isoDateTime(startTime)))
      .append($('<dt/>').addClass('text-left col-sm-3')
        .append(Localization.Messages.DateCompleted))
      .append($('<dd/>').addClass('col-sm-9 mt-1 mb-0')
        .append(PreviewSlideComponent.isoDateTime(endTime)))
      .append($('<dt/>').addClass('text-left col-sm-3')
        .append(Localization.Messages.TotalElapsed))
      .append($('<dd/>').addClass('col-sm-9 mt-1 mb-0')
        .append(PreviewSlideComponent.readableDuration(endTime.getTime() - startTime.getTime())));
    return overall.append(dl);
  }

  createSummaryMediainfo() {
    const state = this.media.stateMediainfo;
    const overall = $('<details/>').addClass('mt-4')
      .append($('<summary/>').addClass('lead-sm')
        .append(Localization.Messages.Mediainfo));
    const startTime = new Date(state.metrics.t0);
    const endTime = new Date(state.metrics.t1);
    const elapsed = PreviewSlideComponent.readableDuration(endTime.getTime() - startTime.getTime());
    const url = S3Utils.signUrl(state.output.bucket, state.output.key);
    const output = $('<a/>').addClass('badge badge-pill badge-primary mr-1 mb-1 mr-1 lead-xs')
      .attr('href', url)
      .attr('target', '_blank')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Tooltips.DownloadFile)
      .html(state.output.key.split('/').pop())
      .tooltip();

    const dl = $('<dl/>').addClass('row lead-xs ml-2 my-2 col-9 no-gutters')
      .append($('<dt/>').addClass('text-left col-sm-3')
        .append(Localization.Messages.DateAdded))
      .append($('<dd/>').addClass('col-sm-9 mt-1 mb-0')
        .append(PreviewSlideComponent.isoDateTime(startTime)))
      .append($('<dt/>').addClass('text-left col-sm-3')
        .append(Localization.Messages.DateCompleted))
      .append($('<dd/>').addClass('col-sm-9 mt-1 mb-0')
        .append(PreviewSlideComponent.isoDateTime(endTime)))
      .append($('<dt/>').addClass('text-left col-sm-3')
        .append(Localization.Messages.TotalElapsed))
      .append($('<dd/>').addClass('col-sm-9 mt-1 mb-0')
        .append(elapsed))
      .append($('<dt/>').addClass('text-left col-sm-3')
        .append(Localization.Messages.Outputs))
      .append($('<dd/>').addClass('col-sm-9 mt-1 mb-0')
        .append(output));

    return overall.append(dl);
  }

  createSummaryMediaConvert() {
    const state = this.media.stateMediaConvert;
    const overall = $('<details/>').addClass('mt-4')
      .append($('<summary/>').addClass('lead-sm')
        .append(Localization.Messages.MediaConvert));
    const execution = $('<a/>').addClass('badge badge-pill badge-primary mr-1 mb-1 lead-xs')
      .attr('href', AWSConsoleMediaConvert.getJobLink(state.jobId))
      .attr('target', '_blank')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Tooltips.ViewOnAWSConsole)
      .html(state.jobId)
      .tooltip();
    const proxyVideo = $('<a/>').addClass('badge badge-pill badge-primary mr-1 mb-1 lead-xs')
      .attr('href', this.media.getProxyVideoUrl())
      .attr('target', '_blank')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', Localization.Tooltips.DownloadFile)
      .html(this.media.proxyVideoKey.split('/').pop())
      .tooltip();
    const status = $('<span/>').addClass('badge badge-pill badge-success')
      .addClass('lead-xxs')
      .append(state.status);
    const startTime = new Date(state.metrics.t0);
    const endTime = new Date(state.metrics.t1);
    const elapsed = PreviewSlideComponent.readableDuration(endTime.getTime() - startTime.getTime());

    const dl = $('<dl/>').addClass('row lead-xs ml-2 my-2 col-9 no-gutters')
      .append($('<dt/>').addClass('text-left col-sm-3')
        .append(Localization.Messages.JobId))
      .append($('<dd/>').addClass('col-sm-9 mt-1 mb-0')
        .append(execution))
      .append($('<dt/>').addClass('text-left col-sm-3')
        .append(Localization.Messages.Status))
      .append($('<dd/>').addClass('col-sm-9 mt-1 mb-0')
        .append(status))
      .append($('<dt/>').addClass('text-left col-sm-3')
        .append(Localization.Messages.DateAdded))
      .append($('<dd/>').addClass('col-sm-9 mt-1 mb-0')
        .append(PreviewSlideComponent.isoDateTime(startTime)))
      .append($('<dt/>').addClass('text-left col-sm-3')
        .append(Localization.Messages.DateCompleted))
      .append($('<dd/>').addClass('col-sm-9 mt-1 mb-0')
        .append(PreviewSlideComponent.isoDateTime(endTime)))
      .append($('<dt/>').addClass('text-left col-sm-3')
        .append(Localization.Messages.TotalElapsed))
      .append($('<dd/>').addClass('col-sm-9 mt-1 mb-0')
        .append(elapsed))
      .append($('<dt/>').addClass('text-left col-sm-3')
        .append(Localization.Messages.Outputs))
      .append($('<dd/>').addClass('col-sm-9 mt-1 mb-0')
        .append(proxyVideo));

    return overall.append(dl);
  }

  createSummaryRekognition() {
    let state = this.media.stateSegmentDetection;

    const overall = $('<details/>').addClass('mt-4')
      .append($('<summary/>').addClass('lead-sm')
        .append(Localization.Messages.RekognitionVideo));
    const execution = $('<span/>').addClass('badge badge-pill badge-light mr-1 mb-1 lead-xs')
      .html(state.jobId);
    const status = $('<span/>').addClass('badge badge-pill badge-success')
      .addClass('lead-xxs')
      .append(state.status);
    const startTime = new Date(state.metrics.t0);
    const endTime = new Date(state.metrics.t1);
    const elapsed = PreviewSlideComponent.readableDuration(endTime.getTime() - startTime.getTime());

    state = this.media.stateDetectionResults;
    const outputs = [];
    for (let i = 0; i < state.output.parts; i++) {
      const name = `${String(i).padStart(8, '0')}.json`;
      const url = S3Utils.signUrl(state.output.bucket, `${state.output.prefix}${name}`);
      outputs.push($('<a/>').addClass('badge badge-pill badge-primary mr-1 mb-1 mr-1 lead-xs')
        .attr('href', url)
        .attr('target', '_blank')
        .attr('data-toggle', 'tooltip')
        .attr('data-placement', 'bottom')
        .attr('title', Localization.Tooltips.DownloadFile)
        .html(name)
        .tooltip());
    }

    const dl = $('<dl/>').addClass('row lead-xs ml-2 my-2 col-9 no-gutters')
      .append($('<dt/>').addClass('text-left col-sm-3')
        .append(Localization.Messages.JobId))
      .append($('<dd/>').addClass('col-sm-9 mt-1 mb-0')
        .append(execution))
      .append($('<dt/>').addClass('text-left col-sm-3')
        .append(Localization.Messages.Status))
      .append($('<dd/>').addClass('col-sm-9 mt-1 mb-0')
        .append(status))
      .append($('<dt/>').addClass('text-left col-sm-3')
        .append(Localization.Messages.DateAdded))
      .append($('<dd/>').addClass('col-sm-9 mt-1 mb-0')
        .append(PreviewSlideComponent.isoDateTime(startTime)))
      .append($('<dt/>').addClass('text-left col-sm-3')
        .append(Localization.Messages.DateCompleted))
      .append($('<dd/>').addClass('col-sm-9 mt-1 mb-0')
        .append(PreviewSlideComponent.isoDateTime(endTime)))
      .append($('<dt/>').addClass('text-left col-sm-3')
        .append(Localization.Messages.TotalElapsed))
      .append($('<dd/>').addClass('col-sm-9 mt-1 mb-0')
        .append(elapsed))
      .append($('<dt/>').addClass('text-left col-sm-3')
        .append(Localization.Messages.Outputs))
      .append($('<dd/>').addClass('col-sm-9 mt-1 mb-0')
        .append(outputs));

    return overall.append(dl);
  }

  createSummaryTab() {
    const [
      tabLink,
      tabContent,
    ] = this.createTabAndContent(Localization.Messages.Summary);

    const step = this.createSummaryStepFunctions();
    const rekognition = this.createSummaryRekognition();
    const mediaconvert = this.createSummaryMediaConvert();
    const mediainfo = this.createSummaryMediainfo();
    tabContent
      .append(step)
      .append(rekognition)
      .append(mediaconvert)
      .append(mediainfo);
    return [
      tabLink,
      tabContent,
    ];
  }

  createTrackButton(name, prefix) {
    const displayName = (prefix ? `${prefix} ${name}` : name).replace(/_/g, ' ');
    const btn = $('<button/>').addClass('btn btn-sm btn-primary text-capitalize mb-1 ml-1')
      .attr('type', 'button')
      .attr('data-toggle', 'button')
      .attr('aria-pressed', false)
      .attr('autocomplete', 'off')
      .attr('data-track-name', name)
      .append(displayName);
    btn.off('click').on('click', async (event) => {
      const enableNow = btn.attr('aria-pressed') === 'false';
      console.log(`${btn.data('trackName')} ${enableNow}`);
      return this.trackToggle(name, enableNow);
    });
    return btn;
  }

  async play() {
    if (this.player) {
      this.player.play();
    }
    return this;
  }

  async pause() {
    if (this.player) {
      this.player.pause();
    }
    return this;
  }

  async seek(time) {
    if (this.player) {
      this.player.currentTime(time);
    }
    return this;
  }

  getCurrentTime() {
    return (this.player)
      ? Math.floor((this.player.currentTime() * 1000) + 0.5)
      : undefined;
  }

  trackIsEnabled(label) {
    if (this.player) {
      const tracks = this.player.remoteTextTracks();
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].label === label) {
          return tracks[i].mode === 'showing';
        }
      }
    }
    return false;
  }

  trackRegister(label, key, language = 'en') {
    this.trackCached[label] = {
      key,
      language,
      loaded: false,
    };
    return this;
  }

  trackUnregister(label) {
    delete this.trackCached[label];
    return this;
  }

  async trackLoad(label) {
    if (this.player) {
      const src = S3Utils.signUrl(this.media.stateTimeline.bucket, this.trackCached[label].key);
      const track = this.player.addRemoteTextTrack({
        kind: 'subtitles',
        language: this.trackCached[label].language,
        label,
        src,
      }, false);
      track.off('load');
      track.on('load', (event) => {
        const selected = event.target.track;
        selected.mode = 'showing';
        this.trackLoadedEvent(selected);
      });
    }
    return this;
  }

  async trackToggle(label, on) {
    if (this.player) {
      const tracks = this.player.remoteTextTracks();
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].label === label) {
          tracks[i].mode = (on) ? 'showing' : 'hidden';
          return this.markerToggle(tracks[i], on);
        }
      }
    }
    /* if track is cached but not loaded, load it now */
    return (on && this.trackCached[label] && !this.trackCached[label].loaded)
      ? this.trackLoad(label)
      : this;
  }

  trackLoadedEvent(track) {
    this.trackCached[track.label].loaded = true;
    this.markerAdd(track);
    return this;
  }

  markerAdd(track) {
    const markers = [];
    for (let i = 0; i < track.cues.length; i++) {
      markers.push({
        time: track.cues[i].startTime,
        duration: track.cues[i].endTime - track.cues[i].startTime,
        text: track.label,
        overlayText: track.label,
      });
    }
    this.player.markers.add(markers);
    return this;
  }

  markerRemove(track) {
    const indices = [];
    const markers = this.player.markers.getMarkers();
    for (let i = 0; i < markers.length; i++) {
      if (markers[i].overlayText === track.label) {
        indices.push(i);
      }
    }
    this.player.markers.remove(indices);
    return this;
  }

  markerToggle(track, on) {
    return (on)
      ? this.markerAdd(track)
      : this.markerRemove(track);
  }
}
