// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const DB = require('./db');

class ServiceToken {
  static get Token() {
    return {
      Name: 'token',
    };
  }

  static timeToLiveInSecond(days = 2) {
    return Math.floor((new Date().getTime() / 1000)) + (days * 86400);
  }

  static getDB() {
    const missing = [
      'ENV_SERVICE_TOKEN_TABLE',
      'ENV_SERVICE_TOKEN_TABLE_PARTITION_KEY',
      'ENV_SERVICE_TOKEN_TABLE_SORT_KEY',
    ].filter(x => process.env[x] === undefined);
    if (missing.length) {
      throw new Error(`missing env.${missing.join(', ')}`);
    }
    return new DB({
      Table: process.env.ENV_SERVICE_TOKEN_TABLE,
      PartitionKey: process.env.ENV_SERVICE_TOKEN_TABLE_PARTITION_KEY,
      SortKey: process.env.ENV_SERVICE_TOKEN_TABLE_SORT_KEY,
    });
  }

  static async register(id, token, service, api, data) {
    return (ServiceToken.getDB()).update(id, ServiceToken.Token.Name, {
      token,
      service,
      api,
      data,
      ttl: ServiceToken.timeToLiveInSecond(1),
    }, false);
  }

  static async unregister(id) {
    return (ServiceToken.getDB()).purge(id, ServiceToken.Token.Name);
  }

  static async getData(id) {
    return (ServiceToken.getDB()).fetch(id, ServiceToken.Token.Name);
  }
}

module.exports = ServiceToken;
