'use strict';

class SlidingWindowStrategy {
  constructor(store, options = {}) {
    this.store = store;
    this.limit = options.limit || 100;
    this.windowMs = options.windowMs || 60000;
  }
  
  async consume(key, weight = 1) {
    const now = Date.now();
    
    const currentWindow = Math.floor(now / this.windowMs) * this.windowMs;
    const previousWindow = currentWindow - this.windowMs;
    
    const currentKey = `${key}:${currentWindow}`;
    const previousKey = `${key}:${previousWindow}`;
    
    let currentRecord = await this.store.get(currentKey);
    const previousRecord = await this.store.get(previousKey);
    
    if (!currentRecord) {
      currentRecord = {
        count: 0,
        resetTime: currentWindow + this.windowMs
      };
    }
    
    const previousCount = previousRecord ? previousRecord.count : 0;
    
    const timeElapsed = now - currentWindow;
    const timeRatio = 1 - (timeElapsed / this.windowMs);
    
    const effectivePreviousCount = Math.floor(previousCount * timeRatio);
    const effectiveCurrentCount = currentRecord.count;
    const effectiveTotalCount = effectiveCurrentCount + effectivePreviousCount;
    
    const newCount = effectiveCurrentCount + weight;
    const effectiveNewTotal = effectivePreviousCount + newCount;
    const remaining = Math.max(0, this.limit - effectiveNewTotal);
    const limited = effectiveNewTotal > this.limit;
    
    if (!limited) {
      currentRecord.count = newCount;
      await this.store.set(currentKey, currentRecord, this.windowMs * 2);
    }
    
    return {
      limited,
      remaining,
      resetTime: currentRecord.resetTime,
      consumed: limited ? 0 : weight,
      currentCount: currentRecord.count,
      previousCount: effectivePreviousCount
    };
  }
  
  async resetKey(key) {
    const now = Date.now();
    const currentWindow = Math.floor(now / this.windowMs) * this.windowMs;
    const previousWindow = currentWindow - this.windowMs;
    
    const currentKey = `${key}:${currentWindow}`;
    const previousKey = `${key}:${previousWindow}`;
    
    await Promise.all([
      this.store.del(currentKey),
      this.store.del(previousKey)
    ]);
    
    return true;
  }
  
  async resetAll() {
    return await this.store.reset();
  }
}

module.exports = SlidingWindowStrategy; 