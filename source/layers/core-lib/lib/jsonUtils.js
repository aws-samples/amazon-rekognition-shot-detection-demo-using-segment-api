// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
class InternalUtils {
  static isObject(obj) {
    return obj && typeof obj === 'object';
  }

  static isPrimitive(obj) {
    switch (typeof obj) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'undefined':
      case 'symbol':
        return true;
      default:
        break;
    }
    return (obj === null);
  }

  static internalMerge(target, source) {
    if (!InternalUtils.isObject(target) || !InternalUtils.isObject(source)) {
      return source;
    }

    Object.keys(source).forEach(key => {
      const targetValue = target[key];
      const sourceValue = source[key];
      if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
        target[key] = Array.from(new Set(targetValue.concat(sourceValue))).filter(x => x);
      } else if (InternalUtils.isObject(targetValue) && InternalUtils.isObject(sourceValue)) {
        target[key] = InternalUtils.internalMerge({
          ...targetValue,
        }, sourceValue);
      } else {
        target[key] = sourceValue;
      }
    });
    return target;
  }

  static internalCleansing(obj, removeList = {}) {
    if (InternalUtils.isPrimitive(obj)) {
      return ((obj === null) || (typeof obj === 'string' && !obj.length))
        ? undefined
        : obj;
    }

    if ((removeList.array || removeList.object) && !Object.keys(obj).length) {
      return undefined;
    }

    const duped = Array.isArray(obj) ? [] : {};
    Object.keys(obj).forEach((x) => {
      duped[x] = InternalUtils.internalCleansing(obj[x], removeList);
    });

    return Array.isArray(duped)
      ? duped.filter(x => x)
      : duped;
  }
}

class JsonUtils {
  static merge(target, source) {
    return InternalUtils.internalMerge(JSON.parse(JSON.stringify(target)), source);
  }

  static cleansing(obj, removeList) {
    const options = {
      array: true,
      object: true,
      ...removeList,
    };
    const parsed = InternalUtils.internalCleansing(JSON.parse(JSON.stringify(obj)), options);
    return JSON.parse(JSON.stringify(parsed));
  }

  static sanitize(data, callback) {
    function escapeFn(k, v, obj) {
      if (typeof v === 'string') {
        obj[k] = obj[k].replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
    }

    function sanitizer(obj, cb) {
      Object.keys(obj).forEach((k) => {
        if (obj[k] !== null && obj[k] !== undefined && typeof obj[k] === 'object') {
          sanitizer(obj[k], cb);
        } else {
          cb.apply(this, [k, obj[k], obj]);
        }
      });
    }

    const duped = JSON.parse(JSON.stringify(data));
    sanitizer(duped, callback || escapeFn);
    return duped;
  }
}

module.exports = JsonUtils;
