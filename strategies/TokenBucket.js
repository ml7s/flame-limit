'use strict';

class TokenBucketStrategy {
  constructor(store, options = {}) {
    this.store = store;
    this.limit = options.limit || 100;
    this.windowMs = options.windowMs || 60000;
    this.refillRate = this.limit / this.windowMs;
  }
  
  async consume(key, weight = 1) {
    const now = Date.now();
    const storeKey = `${key}:token`;
    
    let bucket = await this.store.get(storeKey);
    
    if (!bucket) {
      bucket = {
        tokens: this.limit,
        lastRefill: now,
        resetTime: now + this.windowMs
      };
    }
    
    const elapsed = now - bucket.lastRefill;
    
    if (elapsed > 0) {
      const tokensToAdd = elapsed * this.refillRate;
      bucket.tokens = Math.min(this.limit, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
    
    const remaining = Math.max(0, bucket.tokens - weight);
    const limited = bucket.tokens < weight;
    
    if (!limited) {
      bucket.tokens -= weight;
      
      if (bucket.tokens === 0) {
        bucket.resetTime = now + Math.ceil(weight / this.refillRate);
      }
      
      await this.store.set(storeKey, bucket, this.windowMs * 2);
    }
    
    return {
      limited,
      remaining: Math.floor(remaining),
      resetTime: limited ? now + Math.ceil((weight - bucket.tokens) / this.refillRate) : bucket.resetTime,
      consumed: limited ? 0 : weight
    };
  }
  
  async resetKey(key) {
    const storeKey = `${key}:token`;
    await this.store.del(storeKey);
    return true;
  }
  
  async resetAll() {
    return await this.store.reset();
  }
}

module.exports = TokenBucketStrategy; 