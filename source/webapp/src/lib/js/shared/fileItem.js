// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import SolutionManifest from '/solution-manifest.js';
import Localization from './localization.js';
import AppUtils from './appUtils.js';
import S3Utils from './s3utils.js';
import mxReadable from '../mixins/mxReadable.js';

class BaseFile {
  constructor(name, group) {
    this.$fileId = `file-${AppUtils.randomHexstring()}`;
    this.$displayName = name;
    this.$bucket = SolutionManifest.S3.Bucket;
    let trimmed = name.replace(/^\/*/g, '');
    this.$key = (group)
      ? [
        group.replace(/^\/*|\/*$/g, ''),
        trimmed,
      ].join('/')
      : [
        // this.$fileId,
        trimmed,
      ].join('/');
    trimmed = trimmed.substring(trimmed.lastIndexOf('/') + 1);
    this.$basename = trimmed.substring(0, trimmed.lastIndexOf('.'));
  }

  static get Constants() {
    return {
      Multipart: {
        PartSize: 5 * 1024 * 1024,
        MaxConcurrentUpload: 4,
      },
    };
  }

  static get Events() {
    return {
      File: {
        Remove: 'file:remove',
      },
    };
  }

  get displayName() {
    return this.$displayName;
  }

  get fileId() {
    return this.$fileId;
  }

  get bucket() {
    return this.$bucket;
  }

  set bucket(val) {
    this.$bucket = val;
  }

  get key() {
    return this.$key;
  }

  set key(val) {
    this.$key = val;
  }

  get basename() {
    return this.$basename;
  }
}

export default class FileItem extends mxReadable(BaseFile) {
  constructor(name, file, group) {
    super(name, group);
    this.$file = file;
    this.$dataUrl = undefined;
    this.$thumbnail = undefined;
    this.$analysis = undefined;
    this.$metric = undefined;
    this.$labels = [];
  }

  get file() {
    return this.$file;
  }

  get name() {
    return this.file.name;
  }

  get dataUrl() {
    return this.$dataUrl;
  }

  set dataUrl(val) {
    this.$dataUrl = val;
  }

  get thumbnail() {
    return this.$thumbnail;
  }

  set thumbnail(val) {
    this.$thumbnail = val;
  }

  get analysis() {
    return this.$analysis;
  }

  set analysis(val) {
    this.$analysis = val;
  }

  get metric() {
    return this.$metric;
  }

  set metric(val) {
    this.$metric = val;
  }

  get labels() {
    return this.$labels;
  }

  set labels(val) {
    this.$labels = val;
  }

  setAnalysis(val) {
    this.analysis = val;
  }

  setMetric(metric) {
    this.metric = {
      ...metric,
    };
  }

  signUrl() {
    return S3Utils.signUrl(this.bucket, this.key);
  }

  signJsonOutUrl() {
    const replaced = this.key.substring(0, this.key.lastIndexOf('.'));
    return S3Utils.signUrl(this.bucket, `${replaced}.json`);
  }

  async createItem(w = 96, h = 96) {
    const dl = $('<dl/>').addClass('row lead-xs ml-2 col-9 no-gutters')
      .append($('<dt/>').addClass('text-left col-sm-1')
        .append(Localization.Messages.Name))
      .append($('<dd/>').addClass('col-sm-11 my-0')
        .append(this.displayName))
      .append($('<dt/>').addClass('text-left col-sm-1 my-0')
        .append(Localization.Messages.Size))
      .append($('<dd/>').addClass('col-sm-11 my-0')
        .append(FileItem.readableFileSize(this.file.size)))
      .append($('<dt/>').addClass('text-left col-sm-1 my-0')
        .append(Localization.Messages.Type))
      .append($('<dd/>').addClass('col-sm-11 my-0')
        .append(this.file.type || '--'));

    const spinner = $('<div/>').addClass('ml-auto spinner-grow text-success align-self-center')
      .addClass('collapse')
      .attr('role', 'status');

    const badge = $('<span/>').addClass('badge badge-pill badge-danger')
      .addClass('lead-xs ml-auto align-self-center')
      .addClass('collapse')
      .attr('data-toggle', 'tooltip')
      .attr('data-placement', 'bottom')
      .attr('title', '')
      .append('error')
      .tooltip();

    const li = $('<li/>').addClass('list-group-item d-flex')
      .attr('data-file-id', this.fileId)
      .attr('data-display-name', this.displayName)
      .append($('<i/>').addClass('far fa-file-video align-self-center')
        .css('font-size', '3rem')
        .css('font-weight', 300)
        .css('color', '#888'))
      .append(dl)
      .append(spinner)
      .append(badge);
    return li;
  }

  async getDataUrl() {
    if (this.dataUrl) {
      return this.dataUrl;
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = e => reject(e);
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(this.file);
    });
    const thumbnail = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 96;
        const scaleH = Math.max(Math.floor(img.width / 96), 1);
        canvas.height = Math.floor(img.height / scaleH);
        canvas.getContext('2d')
          .drawImage(img,
            0, 0, img.width, img.height,
            0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.onerror = () => {
        reject(new Error(`fail to load ${this.displayName}`));
      };
      img.src = dataUrl;
    });
    this.dataUrl = dataUrl;
    this.thumbnail = thumbnail;
    return this.dataUrl;
  }

  async upload(bucket, key) {
    if (bucket) {
      this.bucket = bucket;
    }
    if (key) {
      this.key = key;
    }
    const s3 = S3Utils.getInstance();
    return s3.upload({
      Bucket: this.bucket,
      Key: this.key,
      ContentType: this.file.type,
      Body: this.file,
    }, {
      partSize: FileItem.Constants.Multipart.PartSize,
      queueSize: FileItem.Constants.Multipart.MaxConcurrentUpload,
    }).promise();
  }

  async readAsText() {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (data) => resolve(reader.result);
      reader.readAsText(this.file, 'utf8');
    });
  }
}
