'use strict';

class FixedWindowStrategy {
  constructor(store, options = {}) {
    this.store = store;
    this.limit = options.limit || 100;
    this.windowMs = options.windowMs || 60000;
  }
  
  async consume(key, weight = 1) {
    const now = Date.now();
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
    const windowEnd = windowStart + this.windowMs;
    const storeKey = `${key}:${windowStart}`;
    
    let record = await this.store.get(storeKey);
    
    if (!record) {
      record = {
        count: 0,
        resetTime: windowEnd
      };
    }
    
    const newCount = record.count + weight;
    const remaining = Math.max(0, this.limit - newCount);
    const limited = newCount > this.limit;
    
    if (!limited) {
      record.count = newCount;
      await this.store.set(storeKey, record, this.windowMs);
    }
    
    return {
      limited,
      remaining,
      resetTime: record.resetTime,
      consumed: limited ? 0 : weight
    };
  }
  
  async resetKey(key) {
    const now = Date.now();
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
    const storeKey = `${key}:${windowStart}`;
    
    await this.store.del(storeKey);
    
    return true;
  }
  
  async resetAll() {
    return await this.store.reset();
  }
}

module.exports = FixedWindowStrategy; 