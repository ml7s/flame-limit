'use strict';

const FixedWindowStrategy = require('./strategies/FixedWindow');
const SlidingWindowStrategy = require('./strategies/SlidingWindow');
const TokenBucketStrategy = require('./strategies/TokenBucket');
const MemoryStore = require('./strategies/MemoryStore');
const RedisStore = require('./RedisStore');

const STRATEGIES = {
  fixed: FixedWindowStrategy,
  sliding: SlidingWindowStrategy,
  token: TokenBucketStrategy
};

const STORES = {
  memory: MemoryStore,
  redis: RedisStore
};

const DEFAULT_OPTIONS = {
  limit: 100,
  windowMs: 60000,
  backend: 'memory',
  strategy: 'fixed',
  weightByPath: false,
  trustProxy: false,
  keyPrefix: 'flame-limit:'
};

function flameLimit(options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  const Store = STORES[config.backend];
  if (!Store) {
    throw new Error(`Unknown backend: ${config.backend}. Use 'memory' or 'redis'.`);
  }
  
  const store = config.backend === 'redis' 
    ? new Store(config.redisClient, config.keyPrefix)
    : new Store(config.keyPrefix);
  
  const Strategy = STRATEGIES[config.strategy];
  if (!Strategy) {
    throw new Error(`Unknown strategy: ${config.strategy}. Use 'fixed', 'sliding', or 'token'.`);
  }
  
  const strategy = new Strategy(store, {
    limit: config.limit,
    windowMs: config.windowMs
  });
  
  const getIdentifier = config.identifierFn || ((req) => {
    if (config.trustProxy) {
      const xff = req.headers['x-forwarded-for'];
      if (xff) {
        return xff.split(',')[0].trim();
      }
    }
    
    return req.ip || 
           req.socket?.remoteAddress || 
           req.connection?.remoteAddress || 
           req.connection?.socket?.remoteAddress || 
           'unknown';
  });
  
  const getPathWeight = (path) => {
    if (!config.weightByPath || !config.weights) {
      return 1;
    }
    
    for (const [pattern, weight] of Object.entries(config.weights)) {
      if (patternMatches(pattern, path)) {
        return weight;
      }
    }
    
    return 1;
  };
  
  const patternMatches = (pattern, path) => {
    if (pattern === path) return true;
    
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return path.startsWith(prefix);
    }
    
    try {
      return new RegExp(pattern).test(path);
    } catch (e) {
      return false;
    }
  };
  
  const sendLimitExceededResponse = (req, res, next, resetTime) => {
    if (config.onLimit && typeof config.onLimit === 'function') {
      return config.onLimit(req, res, next, resetTime);
    }
    
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Retry-After', Math.ceil((resetTime - Date.now()) / 1000));
    
    const response = JSON.stringify({
      status: 'error',
      statusCode: 429,
      message: 'Too Many Requests',
      limitResetAt: resetTime
    });
    
    res.end(response);
  };
  
  const middleware = async (req, res, next) => {
    const identifier = getIdentifier(req);
    const path = req.path || req.url || '/';
    const weight = getPathWeight(path);
    
    try {
      const result = await strategy.consume(identifier, weight);
      
      res.setHeader('X-RateLimit-Limit', config.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));
      
      if (result.limited) {
        return sendLimitExceededResponse(req, res, next, result.resetTime);
      }
      
      if (typeof next === 'function') {
        return next();
      }
      
      return true;
    } catch (error) {
      if (typeof next === 'function') {
        return next(error);
      }
      
      throw error;
    }
  };
  
  middleware.resetKey = async (key) => {
    return await strategy.resetKey(key);
  };
  
  middleware.resetAll = async () => {
    return await strategy.resetAll();
  };
  
  return middleware;
}

flameLimit.FixedWindowStrategy = FixedWindowStrategy;
flameLimit.SlidingWindowStrategy = SlidingWindowStrategy;
flameLimit.TokenBucketStrategy = TokenBucketStrategy;
flameLimit.MemoryStore = MemoryStore;
flameLimit.RedisStore = RedisStore;

module.exports = flameLimit; 