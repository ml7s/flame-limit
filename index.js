'use strict';

const http = require('http');

function flameLimit(options = {}) {
  const limit = options.limit || 100;
  const windowMs = options.windowMs || 60000;
  const weightByPath = options.weightByPath || {};
  const tokenBased = options.tokenBased || false;
  const onLimit = options.onLimit || null;
  
  const clients = new Map();
  
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, data] of clients.entries()) {
      if (now > data.resetTime) {
        clients.delete(key);
      }
    }
  }, Math.min(windowMs, 60000));
  
  cleanupInterval.unref();
  
  function getPathWeight(path) {
    let weight = 1;
    const pathEntries = Object.entries(weightByPath);
    
    for (const [pattern, value] of pathEntries) {
      if (patternMatches(pattern, path)) {
        weight = value;
        break;
      }
    }
    
    return weight;
  }
  
  function patternMatches(pattern, path) {
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
  }
  
  function getClientIdentifier(req) {
    if (tokenBased) {
      return req.headers && req.headers.authorization 
        ? req.headers.authorization 
        : 'anonymous';
    }
    
    return req.ip || 
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           req.connection?.socket?.remoteAddress ||
           'unknown';
  }
  
  function sendLimitExceededResponse(req, res) {
    const response = {
      status: 'error',
      statusCode: 429,
      message: 'Too Many Requests',
      limitResetAt: clients.get(getClientIdentifier(req)).resetTime
    };
    
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Retry-After', Math.ceil((clients.get(getClientIdentifier(req)).resetTime - Date.now()) / 1000));
    res.end(JSON.stringify(response));
  }
  
  return function middleware(req, res, next) {
    const clientId = getClientIdentifier(req);
    const now = Date.now();
    const path = req.path || req.url || '/';
    const requestWeight = getPathWeight(path);
    
    if (!clients.has(clientId)) {
      clients.set(clientId, {
        count: 0,
        resetTime: now + windowMs
      });
    }
    
    const clientData = clients.get(clientId);
    
    if (now > clientData.resetTime) {
      clientData.count = 0;
      clientData.resetTime = now + windowMs;
    }
    
    clientData.count += requestWeight;
    
    if (clientData.count > limit) {
      if (typeof onLimit === 'function') {
        return onLimit(req, res, next);
      }
      
      return sendLimitExceededResponse(req, res);
    }
    
    if (typeof next === 'function') {
      return next();
    }
    
    return true;
  };
}

module.exports = flameLimit; 