'use strict';

class RedisStore {
  constructor(redisClient, keyPrefix = 'flame-limit:') {
    if (!redisClient) {
      throw new Error('Redis client is required for RedisStore');
    }
    
    this.client = redisClient;
    this.keyPrefix = keyPrefix;
  }
  
  async get(key) {
    const prefixedKey = `${this.keyPrefix}${key}`;
    const result = await this.client.get(prefixedKey);
    
    if (!result) {
      return null;
    }
    
    try {
      return JSON.parse(result);
    } catch (error) {
      return null;
    }
  }
  
  async set(key, value, ttl) {
    const prefixedKey = `${this.keyPrefix}${key}`;
    const serialized = JSON.stringify(value);
    
    if (ttl) {
      await this.client.setEx(prefixedKey, Math.ceil(ttl / 1000), serialized);
    } else {
      await this.client.set(prefixedKey, serialized);
    }
    
    return true;
  }
  
  async del(key) {
    const prefixedKey = `${this.keyPrefix}${key}`;
    await this.client.del(prefixedKey);
    return true;
  }
  
  async reset() {
    const pattern = `${this.keyPrefix}*`;
    const keys = await this.client.keys(pattern);
    
    if (keys.length > 0) {
      await this.client.del(keys);
    }
    
    return true;
  }
  
  async incr(key, value = 1, ttl) {
    const prefixedKey = `${this.keyPrefix}${key}`;
    
    const result = await this.client.incrBy(prefixedKey, value);
    
    if (ttl && result <= value) {
      await this.client.expire(prefixedKey, Math.ceil(ttl / 1000));
    }
    
    return result;
  }
  
  async shutdown() {
    return true;
  }
}

module.exports = RedisStore; 