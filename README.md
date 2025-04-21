# 🔥 flame-limit

A smart and flexible rate-limiting middleware compatible with Express, Koa, Fastify, or plain Node.js HTTP servers.

## ✨ Features

- 🚀 Works with Express, Koa, Fastify, and vanilla Node.js HTTP servers
- 🎯 Path-based weight system for different rate limits per route
- 🔒 IP-based or token-based rate limiting
- ⏱️ Customizable time windows and request limits
- 🛠️ Custom handler for limited requests
- 💪 Zero dependencies
- 🧠 Intelligent rate-limiting with minimal overhead

## 📦 Installation

```bash
npm install flame-limit
```

## 🔧 Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `limit` | Number | 100 | Maximum number of requests allowed within the window |
| `windowMs` | Number | 60000 (1 minute) | Time window in milliseconds |
| `weightByPath` | Object | `{}` | Map of path patterns to request weights |
| `tokenBased` | Boolean | `false` | Use `Authorization` header instead of IP address |
| `onLimit` | Function | `null` | Custom handler function for limited requests |

## 📚 Examples

### Express.js

```javascript
const express = require('express');
const flameLimit = require('flame-limit');

const app = express();

// Basic usage with default settings
app.use(flameLimit());

// Advanced configuration
const limiter = flameLimit({
  limit: 50,
  windowMs: 15 * 60 * 1000, // 15 minutes
  weightByPath: {
    '/api/users': 5,         // Exact match
    '/api/products/*': 2,    // Wildcard matching
    '^/admin.*$': 10         // RegExp pattern
  },
  tokenBased: false,
  onLimit: (req, res) => {
    res.status(429).json({
      status: 'error',
      message: 'Custom rate limit exceeded message',
      retryAfter: '15 minutes'
    });
  }
});

// Apply to specific routes
app.use('/api', limiter);

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Node.js HTTP Server

```javascript
const http = require('http');
const flameLimit = require('flame-limit');

const limiter = flameLimit({
  limit: 100,
  windowMs: 60000 // 1 minute
});

const server = http.createServer((req, res) => {
  // Apply rate limiting
  if (!limiter(req, res, () => {})) {
    return; // Request was limited and response was sent
  }
  
  // Handle the request normally
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World!');
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Using Token-Based Rate Limiting

```javascript
const express = require('express');
const flameLimit = require('flame-limit');

const app = express();

const apiLimiter = flameLimit({
  limit: 300,
  windowMs: 15 * 60 * 1000, // 15 minutes
  tokenBased: true // Uses Authorization header instead of IP
});

app.use('/api', apiLimiter);

app.get('/api/data', (req, res) => {
  res.json({ data: 'This endpoint is protected by token-based rate limiting' });
});

app.listen(3000);
```

### Using Path Weights

```javascript
const express = require('express');
const flameLimit = require('flame-limit');

const app = express();

const limiter = flameLimit({
  limit: 100, // Base limit of 100 points
  windowMs: 60 * 1000, // 1 minute
  weightByPath: {
    '/api/read': 1,        // Low weight for read operations
    '/api/write': 5,       // Medium weight for write operations
    '/api/admin/*': 10     // High weight for admin operations
  }
});

app.use(limiter);

app.listen(3000);
```

## 📋 Response Example

When a request is blocked, the following response is sent (unless `onLimit` is defined):

```json
{
  "status": "error",
  "statusCode": 429,
  "message": "Too Many Requests",
  "limitResetAt": 1622548800000
}
```

The response also includes a `Retry-After` header indicating how many seconds until the rate limit resets.

## 🚀 Performance and Production Usage

### Memory Usage

flame-limit stores all rate-limiting data in-memory, which means:

- Fast access and low latency
- No additional database dependencies
- Data is lost on application restart
- Memory usage increases with the number of clients

For high-volume production applications, consider:

1. Setting appropriate limits to prevent memory exhaustion
2. Deploying behind a load balancer with sticky sessions if using multiple instances
3. Implementing custom storage adapters for distributed environments (planned for future versions)

### Security Considerations

- When using IP-based limiting, be aware of potential issues with clients behind shared IPs
- For API rate limiting, token-based limiting is recommended
- Implement proper validation for tokens if using token-based limiting

### Monitoring

To monitor rate limiting in production:

- Track 429 responses in your monitoring system
- Consider implementing a custom `onLimit` handler that logs rate limit events
- Set up alerts for unusual spikes in rate-limited requests

## 📄 License

MIT 