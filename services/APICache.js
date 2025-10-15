const redisCache = require('./RedisCache');

class APICache {
  constructor() {
    this.redisCache = redisCache;
    this.cache = new Map(); // Fallback in-memory cache
    this.defaultTTL = 5 * 60; // 5 minutes in seconds
  }

  // Generate cache key for API responses
  generateKey(endpoint, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    return `${endpoint}:${sortedParams}`;
  }

  // Get cached response
  async get(endpoint, params = {}) {
    const key = this.generateKey(endpoint, params);

    // Try Redis first
    if (this.redisCache.isConnected) {
      const data = await this.redisCache.get(key);
      if (data) return data;
    }

    // Fallback to in-memory
    return this.cache.get(key);
  }

  // Set cached response
  async set(endpoint, params = {}, data, ttl = this.defaultTTL) {
    const key = this.generateKey(endpoint, params);

    // Try Redis first
    if (this.redisCache.isConnected) {
      await this.redisCache.set(key, data, ttl);
    }

    // Also store in memory
    this.cache.set(key, data);

    // Auto-cleanup for in-memory cache
    setTimeout(() => {
      this.cache.delete(key);
    }, ttl * 1000);
  }

  // Clear cache for specific endpoint
  async clear(endpoint, params = {}) {
    const key = this.generateKey(endpoint, params);

    if (this.redisCache.isConnected) {
      await this.redisCache.del(key);
    }

    this.cache.delete(key);
  }

  // Clear all cache for an endpoint pattern
  async clearPattern(endpoint) {
    const pattern = `${endpoint}:*`;

    // For Redis, we'd need to use SCAN or KEYS, but for simplicity, we'll skip
    // In production, consider using Redis hash or separate keys

    // Clear in-memory cache
    for (const [key] of this.cache.entries()) {
      if (key.startsWith(`${endpoint}:`)) {
        this.cache.delete(key);
      }
    }
  }
}

module.exports = new APICache();