const redis = require('redis');

class RedisCache {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.errorLogged = false; // Prevent spam logging
  }

  async connect() {
    try {
      this.client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      this.client.on('error', (err) => {
        if (!this.errorLogged) {
          console.warn('Redis connection error (falling back to in-memory cache):', err.message);
          this.errorLogged = true;
        }
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected');
        this.isConnected = true;
        this.errorLogged = false; // Reset error flag on successful connection
      });

      await this.client.connect();
    } catch (error) {
      if (!this.errorLogged) {
        console.warn('Redis connection failed, falling back to in-memory cache:', error.message);
        this.errorLogged = true;
      }
      this.isConnected = false;
    }
  }

  async get(key) {
    if (!this.isConnected || !this.client) return null;

    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn('Redis get error:', error.message);
      return null;
    }
  }

  async set(key, value, ttlSeconds = 300) { // 5 minutes default TTL
    if (!this.isConnected || !this.client) return false;

    try {
      await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('Redis set error:', error.message);
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected || !this.client) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.warn('Redis del error:', error.message);
      return false;
    }
  }

  async exists(key) {
    if (!this.isConnected || !this.client) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.warn('Redis exists error:', error.message);
      return false;
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }
}

module.exports = new RedisCache();