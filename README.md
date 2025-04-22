# 🔥 flame-limit

A smart, fast, and customizable rate-limiting middleware compatible with Express, Koa, Fastify, or plain Node.js HTTP servers.

## ✨ Features

- 🚀 Works with Express, Koa, Fastify, and vanilla Node.js HTTP servers
- 🎯 Multiple rate-limiting strategies (Fixed Window, Sliding Window, Token Bucket)
- 🔒 IP-based or token-based rate limiting with custom identifiers
- ⏱️ Customizable time windows and request limits
- 🧰 Scalable with Redis for distributed architectures
- 🛠️ Path weight system for different rate limits based on routes
- 💪 Production-ready with minimal overhead

## 📦 Installation

```bash
npm install flame-limit
```

## 🔍 What is Flame Limit?

Flame Limit is a powerful rate-limiting library designed to protect your API and server resources from abuse. It provides multiple strategies for limiting requests, customizable configuration options, and support for different server frameworks.

Rate limiting is essential for:

- 🛡️ Protecting against DDoS attacks
- 🚫 Preventing brute force attempts
- 📊 Managing API usage and costs
- ⚡ Ensuring fair service for all users
- 🌐 Complying with third-party API limits

## 🔧 Rate Limiting Strategies

Flame Limit provides three rate-limiting strategies, each with its own strengths and ideal use cases:

| Strategy | Description | Pros | Cons | Best For |
|----------|-------------|------|------|----------|
| **Fixed Window** | Limits requests in fixed time windows (e.g., 100 req/minute at clock-time boundaries) | ✅ Simple implementation<br>✅ Low memory usage<br>✅ Predictable reset times | ❌ Burst traffic at window boundaries<br>❌ Less fair at window edges | - General purpose rate limiting<br>- Simple APIs<br>- When predictable reset times matter |
| **Sliding Window** | Distributes limits proportionally across two time windows | ✅ Smoother rate limiting<br>✅ Prevents boundary bursts<br>✅ More accurate limiting | ❌ Higher complexity<br>❌ Slightly more resource intensive | - Public APIs<br>- When preventing traffic spikes is important<br>- User-facing services |
| **Token Bucket** | Allows for burst traffic with a continuous refill rate | ✅ Allows controlled bursts<br>✅ Natural traffic patterns<br>✅ Adapts to usage patterns | ❌ Refill logic is more complex<br>❌ Less predictable limits | - Bursty workloads<br>- Client SDKs<br>- When some bursts are acceptable |

## 🔌 Storage Backends

| Backend | Description | Pros | Cons | Best For |
|---------|-------------|------|------|----------|
| **Memory** | Stores rate-limit data in application memory | ✅ Fast access<br>✅ Zero dependencies<br>✅ Simple setup | ❌ Not shared between nodes<br>❌ Lost on restart<br>❌ Memory consumption | - Single server setups<br>- Development<br>- Small to medium traffic |
| **Redis** | Stores rate-limit data in a Redis database | ✅ Shared across nodes<br>✅ Persists across restarts<br>✅ Scalable | ❌ External dependency<br>❌ Slightly higher latency<br>❌ Additional operational overhead | - Clusters/multiple servers<br>- High availability setups<br>- Production environments |

## 🚀 Basic Usage

### Express.js
```javascript
const express = require('express');
const flameLimit = require('flame-limit');

const app = express();

// Basic usage with defaults (100 requests per minute, fixed window)
app.use(flameLimit());

// Advanced usage
app.use(flameLimit({
  limit: 50,              // 50 requests per window
  windowMs: 15 * 60 * 1000, // 15 minutes
  strategy: 'sliding',    // Use sliding window algorithm
  backend: 'memory',      // Use in-memory storage
  weightByPath: true,     // Enable path-based weights
  weights: {
    '/api/search': 5,      // Search endpoint costs 5 points
    '/api/products/*': 2,  // Product endpoints cost 2 points
    '^/admin.*$': 10       // Admin routes cost 10 points
  }
}));

app.listen(3000);
```

### Koa.js
```javascript
const Koa = require('koa');
const flameLimit = require('flame-limit');

const app = new Koa();

// Middleware adapter for Koa
const koaAdapter = (middleware) => {
  return async (ctx, next) => {
    return new Promise((resolve, reject) => {
      middleware(ctx.req, ctx.res, (err) => {
        if (err) reject(err);
        else resolve(next());
      });
    });
  };
};

// Apply rate limiting
app.use(koaAdapter(flameLimit({
  limit: 100,
  windowMs: 60000
})));

app.listen(3000);
```

### Fastify
```javascript
const fastify = require('fastify')();
const flameLimit = require('flame-limit');

const limiter = flameLimit({
  limit: 100,
  windowMs: 60000,
  strategy: 'token'
});

// Register as middleware
fastify.addHook('onRequest', (request, reply, done) => {
  limiter(request.raw, reply.raw, (err) => {
    if (err) {
      reply.send(err);
      return;
    }
    done();
  });
});

fastify.listen({ port: 3000 });
```

### Native HTTP Server
```javascript
const http = require('http');
const flameLimit = require('flame-limit');

const limiter = flameLimit({
  limit: 100,
  windowMs: 60000
});

const server = http.createServer((req, res) => {
  // Apply rate limiting
  limiter(req, res, (err) => {
    if (err) {
      return;
    }
    
    // Your server logic here
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello World!');
  });
});

server.listen(3000);
```

## ⚙️ Advanced Configuration

```javascript
const flameLimit = require('flame-limit');
const redis = require('redis');

// Create Redis client
const redisClient = redis.createClient({ url: 'redis://localhost:6379' });
(async () => { await redisClient.connect(); })();

// Configure rate limiter
const limiter = flameLimit({
  // Basic settings
  limit: 200,                // Maximum requests per window
  windowMs: 60 * 1000,       // Window size in milliseconds (1 minute)
  
  // Strategy selection
  strategy: 'sliding',       // 'fixed', 'sliding', or 'token'
  
  // Storage backend
  backend: 'redis',          // 'memory' or 'redis'
  redisClient: redisClient,  // Redis client instance
  keyPrefix: 'myapp:ratelimit:', // Key prefix for Redis
  
  // Path weighting
  weightByPath: true,        // Enable path-based weighting
  weights: {
    '/api/public/*': 1,      // Low weight for public endpoints
    '/api/user/*': 5,        // Medium weight for user actions
    '/api/admin/*': 10       // High weight for admin actions
  },
  
  // Client identification
  trustProxy: true,         // Trust X-Forwarded-For header
  identifierFn: (req) => {   // Custom identifier function
    // Use API key from query or header
    return req.query.api_key || req.headers['x-api-key'] || req.ip;
  },
  
  // Response customization
  onLimit: (req, res, next, resetTime) => {
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Too Many Requests',
      retryAfter: Math.ceil((resetTime - Date.now()) / 1000)
    }));
  }
});
```

## 🔍 Custom Identifier Functions

The `identifierFn` option allows you to define how clients are identified for rate limiting purposes. This is powerful for creating sophisticated rate-limiting schemes.

```javascript
// Limit by API key
flameLimit({
  identifierFn: (req) => req.headers['x-api-key'] || 'anonymous'
});

// Limit by user ID (after authentication)
flameLimit({
  identifierFn: (req) => req.user?.id || req.ip
});

// Limit by combination of factors
flameLimit({
  identifierFn: (req) => {
    const ip = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'unknown';
    return `${ip}:${userAgent.substring(0, 20)}`;
  }
});

// Differentiate between authenticated and anonymous users
flameLimit({
  identifierFn: (req) => {
    if (req.user?.id) {
      // Authenticated users get their own rate limit
      return `user:${req.user.id}`;
    } else {
      // Anonymous requests are rate limited by IP
      return `ip:${req.ip}`;
    }
  }
});
```

## 🛡️ Production Best Practices

| Consideration | Recommendation |
|--------------|----------------|
| **High Availability** | Use Redis backend with proper replication/clustering to avoid single points of failure |
| **Memory Usage** | Monitor memory usage when using in-memory backend; large numbers of unique users can cause memory growth |
| **Security** | Use HTTPS and validate client IPs or tokens to prevent spoofing |
| **Performance** | Place rate limiting as early as possible in the request pipeline |
| **Monitoring** | Log rate limit events and set up alerts for unusual patterns |
| **Graceful Degradation** | Implement circuit breakers and fallbacks when Redis is unavailable |
| **Response Headers** | Always include rate limit headers (`X-RateLimit-*`) for client awareness |
| **Testing** | Load test your rate limits to ensure they behave as expected under stress |

## 🔥 When to Use Each Strategy

### Fixed Window
- ✅ General-purpose rate limiting
- ✅ When simplicity is important
- ✅ For predictable reset times (on the hour, minute, etc.)
- ❌ Not ideal when boundary bursts are a concern

### Sliding Window
- ✅ Public APIs with consistent traffic
- ✅ When preventing traffic spikes is critical
- ✅ For smoother rate limiting behavior
- ❌ Not ideal when computational efficiency is the top priority

### Token Bucket
- ✅ When bursts of traffic are acceptable but sustained high rates are not
- ✅ For APIs where user experience benefits from occasional bursts
- ✅ Client SDKs and tools
- ❌ Not ideal when strict, predictable limits are required

## 📈 Memory vs. Redis

### When to use Memory backend:
- ✅ Single-server deployments
- ✅ Development environments
- ✅ When simplicity and low latency are priorities
- ✅ Low to medium traffic applications
- ❌ Not suitable for clustered environments

### When to use Redis backend:
- ✅ Multiple server/container deployments
- ✅ When rate limits need to persist across application restarts
- ✅ High availability production environments
- ✅ When you need centralized rate limiting
- ❌ Not suitable when adding Redis adds too much complexity

## 📝 API Reference

### Main Function

```javascript
flameLimit(options);
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `limit` | Number | 100 | Maximum number of requests allowed per window |
| `windowMs` | Number | 60000 | Time window in milliseconds |
| `strategy` | String | 'fixed' | Rate limiting strategy ('fixed', 'sliding', 'token') |
| `backend` | String | 'memory' | Storage backend ('memory', 'redis') |
| `redisClient` | Object | null | Redis client instance (required when backend is 'redis') |
| `keyPrefix` | String | 'flame-limit:' | Prefix for storage keys |
| `weightByPath` | Boolean | false | Enable path-based request weighting |
| `weights` | Object | {} | Mapping of path patterns to weights |
| `trustProxy` | Boolean | false | Trust X-Forwarded-For header for IP identification |
| `identifierFn` | Function | null | Custom function to generate client identifiers |
| `onLimit` | Function | null | Custom handler for rate-limited requests |

## 📄 License

MIT

## 🚀 v2.0.0 Changes

- ✨ Added multiple rate limiting strategies (Fixed Window, Sliding Window, Token Bucket)
- 🔄 Modular architecture for easier extensibility
- 🧰 Added Redis store for distributed environments
- 🔍 Enhanced client identification options
- 🛡️ Improved production readiness 