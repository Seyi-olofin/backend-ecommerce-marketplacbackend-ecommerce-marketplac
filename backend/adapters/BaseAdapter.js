const axios = require('axios');
const redisCache = require('../services/RedisCache');

class BaseAdapter {
  constructor(config) {
    this.name = config.name;
    this.baseUrl = config.baseUrl;
    this.authType = config.authType; // 'oauth', 'apikey', 'public'
    this.credentials = config.credentials || {};
    this.rateLimit = config.rateLimit || { requests: 100, period: 60000 }; // 100 requests per minute
    this.requestCount = 0;
    this.lastReset = Date.now();

    // In-memory cache fallback
    this.cache = new Map();
    this.cacheTTL = config.cacheTTL || 5 * 60 * 1000; // 5 minutes default TTL
    this.redisCache = redisCache;
  }

  // Check if rate limit allows request
  canMakeRequest() {
    const now = Date.now();
    if (now - this.lastReset > this.rateLimit.period) {
      this.requestCount = 0;
      this.lastReset = now;
    }
    return this.requestCount < this.rateLimit.requests;
  }

  // Record a request
  recordRequest() {
    this.requestCount++;
  }

  // Get cached data if available and not expired
  async getCached(key) {
    // Try Redis first
    if (this.redisCache.isConnected) {
      const redisData = await this.redisCache.get(key);
      if (redisData) return redisData;
    }

    // Fallback to in-memory cache
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    // Remove expired cache
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  // Set cache data with timestamp
  async setCached(key, data) {
    // Try Redis first
    if (this.redisCache.isConnected) {
      await this.redisCache.set(key, data, Math.floor(this.cacheTTL / 1000));
    }

    // Also store in memory as backup
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  // Clear expired cache entries periodically
  cleanExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }

  // Helper method for cached API calls
  async cachedRequest(cacheKey, apiCall) {
    const cached = await this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await apiCall();
    await this.setCached(cacheKey, data);
    return data;
  }

  // Get authentication headers
  getAuthHeaders() {
    switch (this.authType) {
      case 'oauth':
        return {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json'
        };
      case 'apikey':
        return {
          'X-API-Key': this.credentials.apiKey,
          'Content-Type': 'application/json'
        };
      default:
        return { 'Content-Type': 'application/json' };
    }
  }

  // Make authenticated request with retry logic
  async makeRequest(url, options = {}, retries = 3) {
    if (!this.canMakeRequest()) {
      throw new Error(`Rate limit exceeded for ${this.name}`);
    }

    const headers = { ...this.getAuthHeaders(), ...options.headers };
    const config = {
      ...options,
      headers,
      timeout: 10000
    };

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        this.recordRequest();
        const response = await axios(url, config);
        return response.data;
      } catch (error) {
        console.warn(`${this.name} API request failed (attempt ${attempt + 1}/${retries}):`, error.message);

        if (attempt === retries - 1) {
          throw error;
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // Abstract methods to be implemented by subclasses
  async getCategories() {
    const cacheKey = `${this.name}_categories`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    // Implementation should be in subclass
    throw new Error('getCategories must be implemented by subclass');
  }

  async searchProducts(query, options = {}) {
    throw new Error('searchProducts must be implemented by subclass');
  }

  async getProductDetails(productId) {
    throw new Error('getProductDetails must be implemented by subclass');
  }

  async getProductsByCategory(categoryId, options = {}) {
    throw new Error('getProductsByCategory must be implemented by subclass');
  }

  // Normalize product data to standard schema
  normalizeProduct(apiProduct) {
    return {
      id: `${this.name}_${apiProduct.id || apiProduct.itemId}`,
      title: apiProduct.title || apiProduct.name,
      description: apiProduct.description || apiProduct.shortDescription,
      price: {
        amount: parseFloat(apiProduct.price?.value || apiProduct.price || 0),
        currency: apiProduct.price?.currency || 'USD'
      },
      images: apiProduct.images || [apiProduct.image] || [],
      thumbnail: apiProduct.thumbnail || apiProduct.image,
      rating: apiProduct.rating || apiProduct.averageRating || 4.5,
      category: apiProduct.category || apiProduct.categoryName,
      brand: apiProduct.brand || apiProduct.brandName || '',
      source: this.name,
      availability: {
        stock: apiProduct.stock || apiProduct.quantity || 10,
        status: apiProduct.availability || 'in_stock'
      },
      specifications: apiProduct.specifications || apiProduct.specs || {},
      metadata: apiProduct // Keep original data for debugging
    };
  }

  // Normalize category data
  normalizeCategory(apiCategory) {
    return {
      id: `${this.name}_${apiCategory.id || apiCategory.categoryId}`,
      name: apiCategory.name || apiCategory.categoryName,
      image: apiCategory.image || `https://picsum.photos/300/200?random=${Math.random()}`,
      description: apiCategory.description || '',
      source: this.name,
      parentId: apiCategory.parentId || null,
      subcategories: apiCategory.subcategories ? apiCategory.subcategories.map(sub => this.normalizeCategory(sub)) : []
    };
  }
}

module.exports = BaseAdapter;