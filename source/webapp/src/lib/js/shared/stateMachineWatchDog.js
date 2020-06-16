// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import SolutionManifest from '/solution-manifest.js';
import mxReadable from '../mixins/mxReadable.js';
import AppUtils from './appUtils.js';
import ApiHelper from './apiHelper.js';
import LocalCache from './localCache.js';
import Localization from './localization.js';
import S3Utils from './s3utils.js';

export class StateMachineExecution extends mxReadable(class {}) {
  constructor(data) {
    super(data);
    this.$data = this.parseJsonData(data);
    this.$prefetched = undefined;
    this.$proxyVideoKey = undefined;
    this.$listItem = undefined;
  }

  parseJsonData(data) {
    const parsed = JSON.parse(JSON.stringify(data));
    parsed.startDate = new Date(parsed.startDate);
    if (parsed.stopDate) {
      parsed.stopDate = new Date(parsed.stopDate);
    }
    parsed.input = JSON.parse(parsed.input);
    if (parsed.output) {
      parsed.output = JSON.parse(parsed.output);
    }
    return parsed;
  }

  static get Status() {
    return {
      Running: 'RUNNING',
      Succeeded: 'SUCCEEDED',
      Failed: 'FAILED',
      TimedOut: 'TIMED_OUT',
      Aborted: 'ABORTED',
    };
  }

  get data() {
    return this.$data;
  }

  get executionArn() {
    return this.data.executionArn;
  }

  get stateMachineArn() {
    return this.data.stateMachineArn;
  }

  get name() {
    return this.data.name;
  }

  get status() {
    return this.data.status;
  }

  get startDate() {
    return this.data.startDate;
  }

  get stopDate() {
    return this.data.stopDate;
  }

  get input() {
    return this.data.input;
  }

  get output() {
    return this.data.output;
  }

  get prefetched() {
    return this.$prefetched;
  }

  set prefetched(val) {
    this.$prefetched = val;
  }

  get proxyVideoKey() {
    return this.$proxyVideoKey;
  }

  set proxyVideoKey(val) {
    this.$proxyVideoKey = val;
  }

  get listItem() {
    return this.$listItem;
  }

  set listItem(val) {
    this.$listItem = val;
  }

  get stateMediainfo() {
    return (!this.output)
      ? undefined
      : this.output.output[SolutionManifest.States.RunMediainfo];
  }

  get stateMediaConvert() {
    return (!this.output)
      ? undefined
      : this.output.output[SolutionManifest.States.StartMediaConvert];
  }

  get stateSegmentDetection() {
    return (!this.output)
      ? undefined
      : this.output.output[SolutionManifest.States.StartSegmentDetection];
  }

  get stateDetectionResults() {
    return (!this.output)
      ? undefined
      : this.output.output[SolutionManifest.States.CollectDetectionResults];
  }

  get stateTimeline() {
    return (!this.output)
      ? undefined
      : this.output.output[SolutionManifest.States.CreateTimeline];
  }

  get mediainfo() {
    return (!this.stateMediainfo)
      ? undefined
      : this.stateMediainfo.mediainfo;
  }

  getPosterUrl() {
    return this.prefetched;
  }

  getProxyVideoUrl() {
    return (!this.proxyVideoKey)
      ? undefined
      : S3Utils.signUrl(this.stateMediaConvert.output.bucket, this.proxyVideoKey);
  }

  update(data) {
    const dirty = (this.status !== data.status)
      || (!this.output && data.output);
    this.$data = this.parseJsonData(data);
    return dirty;
  }

  createListItem() {
    const duration = ((this.output || {}).output)
      ? StateMachineExecution.readableDuration(this.output.output[SolutionManifest.States.RunMediainfo].mediainfo.container[0].duration)
      : '--';
    const dateAdded = StateMachineExecution.isoDateTime(this.startDate);
    const dateCompleted = (this.stopDate)
      ? StateMachineExecution.isoDateTime(this.stopDate)
      : '--';
    let status = this.status === StateMachineExecution.Status.Succeeded
      ? 'badge-success'
      : this.status === StateMachineExecution.Status.Running
        ? 'badge-primary'
        : 'badge-danger';
    status = $('<span/>').addClass('badge badge-pill')
      .addClass(status)
      .addClass('lead-xxs')
      .append(this.status);

    const dl = $('<dl/>').addClass('row lead-xs ml-2 my-2 col-9 no-gutters')
      .append($('<dt/>').addClass('text-left col-sm-2')
        .append(Localization.Messages.Name))
      .append($('<dd/>').addClass('col-sm-10 my-0 dd-name')
        .append((this.input.input || {}).key || '--'))
      .append($('<dt/>').addClass('text-left col-sm-2 my-0')
        .append(Localization.Messages.Duration))
      .append($('<dd/>').addClass('col-sm-10 my-0 dd-duration')
        .append(duration))
      .append($('<dt/>').addClass('text-left col-sm-2 my-0')
        .append(Localization.Messages.Status))
      .append($('<dd/>').addClass('col-sm-10 my-0 dd-status')
        .append(status))
      .append($('<dt/>').addClass('text-left col-sm-2 my-0')
        .append(Localization.Messages.DateAdded))
      .append($('<dd/>').addClass('col-sm-10 my-0 dd-date-added')
        .append(dateAdded))
      .append($('<dt/>').addClass('text-left col-sm-2 my-0')
        .append(Localization.Messages.DateCompleted))
      .append($('<dd/>').addClass('col-sm-10 my-0 dd-date-completed')
        .append(dateCompleted));

    const image = $('<img/>').addClass('btn-bg w-100 h-100')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('src', this.prefetched || '/images/video.jpg')
      .css('object-fit', 'cover');

    this.listItem = $('<li/>').addClass('list-group-item list-group-item-action row no-gutters d-flex')
      .attr('data-execution', this.name)
      .append($('<div/>').addClass('col-2')
        .append(image))
      .append($('<div/>').addClass('col-10')
        .append(dl));

    return this.listItem;
  }

  updateListItem() {
    if (!this.listItem) {
      return undefined;
    }
    const duration = ((this.output || {}).output)
      ? StateMachineExecution.readableDuration(this.output.output[SolutionManifest.States.RunMediainfo].mediainfo.container[0].duration)
      : '--';
    const dateAdded = StateMachineExecution.isoDateTime(this.startDate);
    const dateCompleted = (this.stopDate)
      ? StateMachineExecution.isoDateTime(this.stopDate)
      : '--';
    const status = this.status === StateMachineExecution.Status.Succeeded
      ? 'badge-success'
      : this.status === StateMachineExecution.Status.Running
        ? 'badge-primary'
        : 'badge-danger';

    const dds = this.listItem.find('dd');
    for (let i = 0; i < dds.length; i++) {
      const dd = $(dds[i]);
      if (dd.hasClass('dd-duration')) {
        dd.empty().append(duration);
      } else if (dd.hasClass('dd-date-added')) {
        dd.empty().append(dateAdded);
      } else if (dd.hasClass('dd-date-completed')) {
        dd.empty().append(dateCompleted);
      }
    }
    const badge = this.listItem.find('.badge')
      .removeClass('badge-success badge-primary badge-danger')
      .addClass(status)
      .empty()
      .append(this.status);

    this.listItem.find('img').attr('src', this.prefetched);
    return this.listItem;
  }

  getListItem() {
    return this.listItem || this.createListItem();
  }

  async prefetch(localCache) {
    if (this.prefetched && this.proxyVideoKey) {
      return true;
    }
    if (!(this.output || {}).output) {
      return false;
    }
    const data = this.stateMediaConvert.output;
    const response = await S3Utils.listObjects(data.bucket, data.prefix);
    this.proxyVideoKey = (response.find(x =>
      x.Key.substring(x.Key.lastIndexOf('.')) === '.mp4') || {}).Key;

    const filtered = response.filter(x =>
      x.Key.substring(x.Key.lastIndexOf('.')) === '.jpg').sort((a, b) => b.Size - a.Size);
    if (!filtered[0]) {
      return false;
    }

    const blob = await localCache.getItem(this.name);
    if (blob) {
      this.prefetched = URL.createObjectURL(blob);
      return true;
    }
    this.prefetched = await localCache.getImageURL(this.name, {
      bucket: data.bucket,
      key: filtered[0].Key,
    });
    return true;
  }
}

export default class StateMachineWatchDog {
  constructor() {
    this.$name = SolutionManifest.StateMachine.Name;
    this.$executions = [];
    this.$token = undefined;
    this.$localCache = LocalCache.getSingleton();
    this.$timer = undefined;
    this.$id = `step-${AppUtils.randomHexstring()}`;
    this.$eventSource = $('<div/>').addClass('collapse')
      .attr('id', this.$id);
    $('body').append(this.$eventSource);
  }

  static getSingleton() {
    if (!(window.AWSomeNamespace || {}).StateMachineWatchDog) {
      window.AWSomeNamespace = {
        ...window.AWSomeNamespace,
        StateMachineWatchDogInstance: new StateMachineWatchDog(),
      };
    }
    return window.AWSomeNamespace.StateMachineWatchDogInstance;
  }

  static get Events() {
    return {
      Execution: {
        Status: {
          NewAdded: 'execution:status:newadded',
          Changed: 'execution:status:changed',
          Removed: 'execution:status:removed',
        },
      },
    };
  }

  static get Constants() {
    return {
      ModelVersion: {
        Key: 'selected-model-version',
      },
    };
  }

  get name() {
    return this.$name;
  }

  get executions() {
    return this.$executions;
  }

  set executions(val) {
    if (!Array.isArray(val)) {
      throw new Error('invalid executions');
    }
    if (val.filter(x => !(x instanceof StateMachineExecution)).length) {
      throw new Error('invalid executions');
    }
    this.$executions = val.slice(0);
  }

  get token() {
    return this.$token;
  }

  set token(val) {
    this.$token = val;
  }

  get timer() {
    return this.$timer;
  }

  set timer(val) {
    this.$timer = val;
  }

  get localCache() {
    return this.$localCache;
  }

  get id() {
    return this.$id;
  }

  get eventSource() {
    return this.$eventSource;
  }

  async getStatus(execution) {
    return (!execution)
      ? this.getAllExecutionStatus()
      : this.getExecutionStatus(execution);
  }

  async getMoreExecutions() {
    return this.getAllExecutionStatus(true);
  }

  async getExecutionStatus(execution) {
    const name = (execution instanceof StateMachineExecution)
      ? execution.name
      : (execution && execution.indexOf('arn:aws:states') === 0)
        ? execution.split(':').pop()
        : execution;
    const response = await ApiHelper.getExecution({
      stateMachine: this.name,
      execution: name,
    });
    return this.updateExecution(response);
  }

  async getAllExecutionStatus(useToken = false) {
    const params = {
      stateMachine: this.name,
      maxResults: 20,
    };
    if (useToken) {
      params.token = this.token;
    }
    const response = await ApiHelper.getExecution(params);
    this.token = response.nextToken;
    await Promise.all(response.executions.map(execution =>
      this.updateExecution(execution)));
    // this.checkExecutionRemoval(response.executions.map(x => x.name));
    return this.executions;
  }

  async updateExecution(data) {
    let execution = this.executions.find(x => x.name === data.name);
    let event;
    if (!execution) {
      event = StateMachineWatchDog.Events.Execution.Status.NewAdded;
      execution = new StateMachineExecution(data);
      await execution.prefetch(this.localCache);
      execution.createListItem();
      this.executions.push(execution);
    } else if (execution.update(data)) {
      event = StateMachineWatchDog.Events.Execution.Status.Changed;
      await execution.prefetch(this.localCache);
      execution.updateListItem();
    }
    if (event) {
      this.eventSource.trigger(event, [execution]);
    }
    return execution;
  }

  checkExecutionRemoval(data = []) {
    const removedList = this.executions.filter(execution =>
      data.findIndex(x0 =>
        execution === x0.name) < 0).filter(x => x);
    while (removedList.length) {
      const removed = removedList.shift();
      const idx = this.executions.findIndex(x =>
        x.name === removed.name);
      if (idx >= 0) {
        this.executions.splice(idx, 1);
        this.eventSource.trigger(StateMachineWatchDog.Events.Execution.Status.Removed, [removed]);
      }
    }
  }

  async startNewExecution(data) {
    const response = await ApiHelper.startNewExecution({
      input: {
        bucket: data.bucket,
        key: data.key,
      },
    }, {
      stateMachine: this.name,
    });
    return this.updateExecution(response);
  }

  async startTimer(intervalInSec = 3 * 60) {
    if (!this.timer) {
      await this.getStatus();
      this.timer = setInterval(async () => {
        console.log('StateMachineWatchDog.startTimer: refresing execution status...');
        await this.getStatus();
      }, intervalInSec * 1000);
    }
    return this;
  }

  async stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = undefined;
  }

  filterExecutions(status) {
    return this.executions.filter(model =>
      model.status === status);
  }

  getRunningExecutions() {
    return this.filterExecutions(StateMachineExecution.Status.Running);
  }

  getCompletedExecutions() {
    return this.filterExecutions(StateMachineExecution.Status.Succeeded);
  }

  getErrorExecutions() {
    return this.executions.filter(model =>
      model.status !== StateMachineExecution.Status.Running
      && model.status !== StateMachineExecution.Status.Succeeded);
  }
}
