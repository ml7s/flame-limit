'use strict';

class MemoryStore {
  constructor(keyPrefix = 'flame-limit:') {
    this.keyPrefix = keyPrefix;
    this.store = new Map();
    this.gcTimer = setInterval(() => this.gc(), 60000);
    this.gcTimer.unref();
  }

  async get(key) {
    const prefixedKey = `${this.keyPrefix}${key}`;
    return this.store.get(prefixedKey);
  }

  async set(key, value, ttl) {
    const prefixedKey = `${this.keyPrefix}${key}`;
    value._expireAt = Date.now() + ttl;
    this.store.set(prefixedKey, value);
    return true;
  }

  async del(key) {
    const prefixedKey = `${this.keyPrefix}${key}`;
    return this.store.delete(prefixedKey);
  }

  async reset() {
    this.store.clear();
    return true;
  }

  gc() {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (value._expireAt && value._expireAt <= now) {
        this.store.delete(key);
      }
    }
  }

  shutdown() {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
  }
}

module.exports = MemoryStore; 