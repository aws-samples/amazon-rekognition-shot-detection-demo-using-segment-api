// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import Localization from '../../shared/localization.js';
import ApiHelper from '../../shared/apiHelper.js';
import mxSpinner from '../../mixins/mxSpinner.js';
import mxReadable from '../../mixins/mxReadable.js';
import mxDropzone from '../../mixins/mxDropzone.js';
import BaseTab from './baseTab.js';
import AppUtils from '../../shared/appUtils.js';

export default class ConvertTab extends mxDropzone(mxReadable(mxSpinner(BaseTab))) {
  constructor(defaultTab = false) {
    super(Localization.Messages.ConvertTab, {
      selected: defaultTab,
    });
    this.$fileList = [];
  }

  get fileList() {
    return this.$fileList;
  }

  static get Sections() {
    return {
      Processing: 'processing-list',
    };
  }

  static get SupportedFileExtensions() {
    return [
      '.json',
    ];
  }

  async show() {
    if (this.initialized) {
      return super.show();
    }
    const content = await this.createContent();
    this.tabContent.append(content);
    return super.show();
  }

  async createContent() {
    const description = $('<p/>').addClass('lead')
      .html(Localization.Messages.DropzoneJsonDesc);
    const dropzone = this.createDropzone(Localization.Messages.DropJsonHere);

    const row = $('<div/>').addClass('row no-gutters')
      .append($('<div/>').addClass('col-12 p-0 m-0 bg-light')
        .append($('<div/>').addClass('col-9 p-0 m-4 mx-auto')
          .append(description))
        .append($('<div/>').addClass('col-9 p-0 m-4 mx-auto')
          .append(dropzone)))
      .append($('<div/>').addClass('col-12 p-0 m-0')
        .append($('<div/>').addClass('col-9 p-0 m-4 mx-auto')
          .append(this.createProcessingSection())));
    return row;
  }

  createProcessingSection() {
    const details = $('<details/>').addClass(`my-2 ${ConvertTab.Sections.Processing}`)
      .append($('<summary/>').addClass('mb-2')
        .append(Localization.Messages.ConversionList));
    const ul = $('<ul/>').addClass('list-group');

    const status = $('<div/>').addClass('lead-sm mr-4 d-flex align-self-end');

    const upload = $('<button/>').addClass('btn btn-sm btn-success ml-1')
      .attr('data-action', 'upload')
      .html(Localization.Buttons.StartConvert);

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
          const downloadUrl = await this.startConversion(file);
          const download = $('<div/>').addClass('ml-auto align-self-center')
            .append($('<a/>').addClass('btn btn-sm btn-success text-capitalize mb-1 ml-1')
              .attr('href', downloadUrl)
              .attr('target', '_blank')
              .attr('download', `${file.basename}.zip`)
              .attr('role', 'button')
              .append(Localization.Buttons.DownloadEDL));
          item.append(download);
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
      status.text(`${Localization.Statuses.Completed} ${processed} / ${kids.length} (${Localization.Statuses.Elapsed}: ${ConvertTab.readableDuration(elapsed)})`);
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

  canSupport(file) {
    if (!file) {
      return false;
    }
    if (typeof file === 'string') {
      const ext = file.substring(file.lastIndexOf('.'), file.length).toLowerCase();
      return ConvertTab.SupportedFileExtensions.indexOf(ext) >= 0;
    }
    const mime = (file || {}).type || (file || {}).mime;
    if (mime) {
      return mime.split('/').pop() === 'json';
    }
    return this.canSupport((file || {}).name || (file || {}).key);
  }

  async processDropEvent(event) {
    this.tabContent.find(`.${ConvertTab.Sections.Processing}`)
      .removeClass('collapse').attr('open', '');
    return super.processDropEvent(event);
  }

  async processEachFileItem(file) {
    this.fileList.push(file);
    const item = await file.createItem();
    this.tabContent.find(`.${ConvertTab.Sections.Processing}`)
      .find('.list-group').append(item);
    return item;
  }

  async startConversion(file) {
    const text = await file.readAsText();
    const b64Data = await ApiHelper.startConversion({
      name: file.name,
      data: JSON.parse(text),
    });
    const mime = 'application/octet-stream';
    return fetch(`data:${mime};base64,${b64Data}`)
      .then(res => res.blob())
      .then(blob => URL.createObjectURL(blob, {
        type: mime,
      }));
  }
}
