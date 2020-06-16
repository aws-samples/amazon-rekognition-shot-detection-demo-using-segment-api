// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import SolutionManifest from '/solution-manifest.js';
import AppUtils from './appUtils.js';

export default class ApiHelper {
  static get Endpoints() {
    return {
      Analyze: `${SolutionManifest.ApiEndpoint}/analyze`,
    };
  }

  static async startNewExecution(body, query) {
    return AppUtils.authHttpRequest('POST', ApiHelper.Endpoints.Analyze, query, body);
  }

  static async getExecution(query) {
    return AppUtils.authHttpRequest('GET', ApiHelper.Endpoints.Analyze, query);
  }
}
