// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import Localization from '../../../shared/localization.js';
import LocalCache from '../../../shared/localCache.js';
import StateMachineWatchDog, {
  StateMachineExecution,
} from '../../../shared/stateMachineWatchDog.js';
import mxReadable from '../../../mixins/mxReadable.js';
import mxDropzone from '../../../mixins/mxDropzone.js';
import BaseSlideComponent from '../baseSlideComponent.js';

export default class DropzoneSlideComponent extends mxReadable(mxDropzone(BaseSlideComponent)) {
  constructor() {
    super();
    this.slide.append(this.createLoading());
    this.$stateMachineWatchDog = StateMachineWatchDog.getSingleton();
    this.$localCache = LocalCache.getSingleton();
    this.$selectedModel = undefined;
    this.$fileList = [];
  }

  static get Sections() {
    return {
      Upload: 'upload-list',
      Analyzing: 'analyzing-list',
      MostRecent: 'most-recent-list',
    };
  }

  static get Events() {
    return {
      Slide: {
        Media: {
          Selected: 'dropzone:slide:media:selected',
        },
      },
    };
  }

  get stateMachineWatchDog() {
    return this.$stateMachineWatchDog;
  }

  get localCache() {
    return this.$localCache;
  }

  get selectedModel() {
    return this.$selectedModel;
  }

  set selectedModel(val) {
    this.$selectedModel = val;
  }

  get fileList() {
    return this.$fileList;
  }

  async show() {
    if (this.initialized) {
      return super.show();
    }
    await this.stateMachineWatchDog.startTimer();

    const description = $('<p/>').addClass('lead')
      .html(Localization.Messages.DropzoneDesc);
    const dropzone = this.createDropzone(Localization.Messages.DropFilesHere);

    const row = $('<div/>').addClass('row no-gutters')
      .append($('<div/>').addClass('col-12 p-0 m-0 bg-light')
        .append($('<div/>').addClass('col-9 p-0 m-4 mx-auto')
          .append(description))
        .append($('<div/>').addClass('col-9 p-0 m-4 mx-auto')
          .append(dropzone))
        .append($('<div/>').addClass('col-9 p-0 m-4 mx-auto')
          .append(this.createUploadSection())))
      .append($('<div/>').addClass('col-12 p-0 m-0')
        .append($('<div/>').addClass('col-9 p-0 m-4 mx-auto')
          .append(this.createProcessingSection())))
      .append($('<div/>').addClass('col-12 p-0 m-0 bg-light')
        .append($('<div/>').addClass('col-9 p-0 m-4 mx-auto')
          .append(this.createMostRecentSection())))
      .append(this.createLoading());

    this.slide.append(row);
    await this.executionChangedEvent();
    return super.show();
  }

  createUploadSection() {
    const details = $('<details/>').addClass(`my-2 ${DropzoneSlideComponent.Sections.Upload}`)
      .addClass('collapse')
      .append($('<summary/>').addClass('mb-2')
        .append(Localization.Messages.FilesReadyToUpload));
    const ul = $('<ul/>').addClass('list-group');

    const status = $('<div/>').addClass('lead-sm mr-4 d-flex align-self-end');
    const upload = $('<button/>').addClass('btn btn-sm btn-success ml-1')
      .attr('data-action', 'upload')
      .html(Localization.Buttons.StartUpload);

    const done = $('<button/>').addClass('btn btn-sm btn-secondary ml-1')
      .attr('disabled', '')
      .attr('data-action', 'done')
      .html(Localization.Buttons.Done);

    const controls = $('<form/>').addClass('form-inline')
      .append(status)
      .append($('<div/>').addClass('mt-4 ml-auto')
        .append(upload)
        .append(done));

    upload.on('click', async (event) => {
      const kids = ul.children();
      let elapsed = new Date().getTime();
      upload.attr('disabled', '');
      status.removeClass('collapse');
      let processed = 0;
      for (let i = 0; i < kids.length; i++) {
        const item = $(kids[i]);
        const fileId = item.data('fileId');
        const spinner = item.find('.spinner-grow');
        spinner.removeClass('collapse');
        status.text(`${Localization.Statuses.Processing} ${i + 1} / ${kids.length}...`);
        try {
          const file = this.fileList.find(x => x.fileId === fileId);
          if (!file) {
            throw new Error(`${item.data('displayName')} not found`);
          }
          await this.startAnalysis(file);
          item.addClass('list-group-item-success');
          processed++;
        } catch (e) {
          item.addClass('list-group-item-danger');
          item.find('.badge').prop('title', e.message).removeClass('collapse');
        } finally {
          spinner.addClass('collapse');
        }
      }
      done.removeAttr('disabled');
      elapsed = new Date().getTime() - elapsed;
      status.text(`${Localization.Statuses.Completed} ${processed} / ${kids.length} (${Localization.Statuses.Elapsed}: ${DropzoneSlideComponent.readableDuration(elapsed)})`);
    });

    done.on('click', async (event) => {
      ul.children().remove();
      this.fileList.length = 0;
      done.attr('disabled', '');
      upload.removeAttr('disabled');
      status.addClass('collapse').text('');
      details.removeAttr('open').addClass('collapse');
    });

    controls.submit((event) =>
      event.preventDefault());

    return details.append(ul)
      .append(controls);
  }

  createProcessingSection() {
    const details = $('<details/>').addClass(`my-2 ${DropzoneSlideComponent.Sections.Analyzing}`)
      .append($('<summary/>').addClass('mb-2')
        .append(Localization.Messages.FilesBeingAnalysis));
    const ul = $('<ul/>').addClass('list-group');
    this.stateMachineWatchDog.getRunningExecutions().forEach(x =>
      ul.append(this.createProcessingListItem(x)));
    return details.append(ul);
  }

  createMostRecentSection() {
    const details = $('<details/>').addClass(`my-2 ${DropzoneSlideComponent.Sections.MostRecent}`)
      .append($('<summary/>').addClass('mb-2')
        .append(Localization.Messages.MostRecentList));
    const ul = $('<ul/>').addClass('list-group');
    this.stateMachineWatchDog.getCompletedExecutions().forEach(x =>
      ul.append(this.createCompletedListItem(x)));
    return details.append(ul);
  }

  async processDropEvent(event) {
    this.slide.find(`.${DropzoneSlideComponent.Sections.Upload}`)
      .removeClass('collapse').attr('open', '');
    return super.processDropEvent(event);
  }

  async processEachFileItem(file) {
    this.fileList.push(file);
    const item = await file.createItem();
    this.slide.find(`.${DropzoneSlideComponent.Sections.Upload}`)
      .find('.list-group').append(item);
    return item;
  }

  async startAnalysis(file) {
    await file.upload();
    return this.stateMachineWatchDog.startNewExecution({
      bucket: file.bucket,
      key: file.key,
    });
  }

  createProcessingListItem(execution) {
    const item = execution.getListItem();
    item.off('click').on('click', async (event) => {
      event.preventDefault();
      this.loading(true);
      await this.stateMachineWatchDog.getStatus(execution);
      this.loading(false);
      return item;
    });
    return item;
  }

  createCompletedListItem(execution) {
    const item = execution.getListItem();
    item.off('click').on('click', async (event) => {
      event.preventDefault();
      return this.slide.trigger(DropzoneSlideComponent.Events.Slide.Media.Selected, [execution]);
    });
    return item;
  }

  getListGroupByStatus(status) {
    return (status === StateMachineExecution.Status.Running)
      ? this.slide.find(`.${DropzoneSlideComponent.Sections.Analyzing}`).find('.list-group')
      : this.slide.find(`.${DropzoneSlideComponent.Sections.MostRecent}`).find('.list-group');
  }

  async addExecutionOption(execution, parent) {
    console.log(`addExecutionOption: ${execution.name}`);
    const group = parent || this.getListGroupByStatus(execution.status);
    group.closest('details').attr('open', '');
    const kids = group.children();
    for (let i = 0; i < kids.length; i++) {
      const kid = $(kids[i]);
      if (kid.data('execution') === execution.name) {
        return kid;
      }
    }
    const item = (execution.status === StateMachineExecution.Status.Completed)
      ? this.createCompletedListItem(execution)
      : (execution.status === StateMachineExecution.Status.Running)
        ? this.createProcessingListItem(execution)
        : undefined;
    if (item) {
      group.prepend(item);
    }
    return item;
  }

  async updateExecutionOption(execution, parent) {
    console.log(`updateExecutionOption: ${execution.name}`);
    const running = this.getListGroupByStatus(StateMachineExecution.Status.Running).children();
    if (execution.status === StateMachineExecution.Status.Succeeded) {
      for (let i = 0; i < running.length; i++) {
        const item = $(running[i]);
        if (item.data('execution') === execution.name) {
          // move item from Running to Completed
          const detached = item.detach();
          detached.off('click').on('click', async () => {
            event.preventDefault();
            return this.slide.trigger(DropzoneSlideComponent.Events.Slide.Media.Selected, [execution]);
          });
          const completedGroup = this.getListGroupByStatus(StateMachineExecution.Status.Succeeded);
          completedGroup.prepend(detached);
          completedGroup.closest('details').attr('open', '');
          return detached;
        }
      }
    }
    return undefined;
  }

  async removeExecutionOption(execution, parent) {
    console.log(`removeExecutionOption: ${execution.name}`);
    return undefined;
  }

  async executionChangedEvent() {
    this.stateMachineWatchDog.eventSource.on(StateMachineWatchDog.Events.Execution.Status.NewAdded, async (event, execution) =>
      this.addExecutionOption(execution));

    this.stateMachineWatchDog.eventSource.on(StateMachineWatchDog.Events.Execution.Status.Changed, async (event, execution) =>
      this.updateExecutionOption(execution));

    this.stateMachineWatchDog.eventSource.on(StateMachineWatchDog.Events.Execution.Status.Removed, async (event, execution) =>
      this.removeExecutionOption(execution));
  }
}
