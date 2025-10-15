const BaseAdapter = require('./BaseAdapter');

class RapidAPIAdapter extends BaseAdapter {
  constructor(config) {
    super({
      name: config.name,
      baseUrl: config.baseUrl,
      authType: 'apikey',
      credentials: { apiKey: process.env.RAPIDAPI_KEY },
      rateLimit: { requests: 100, period: 60000 }, // 100 requests per minute
      cacheTTL: 10 * 60 * 1000, // 10 minutes
      ...config
    });
  }

  getAuthHeaders() {
    return {
      'X-RapidAPI-Key': this.credentials.apiKey,
      'X-RapidAPI-Host': this.baseUrl.replace('https://', '').split('/')[0],
      'Content-Type': 'application/json'
    };
  }

  async searchProducts(query, options = {}) {
    const { limit = 20, offset = 0 } = options;
    const cacheKey = `${this.name}_search_${query}_${limit}_${offset}`;

    return this.cachedRequest(cacheKey, async () => {
      const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`;
      const data = await this.makeRequest(url);

      return (data.products || data.results || []).map(product => this.normalizeProduct(product));
    });
  }

  async getProductsByCategory(categoryId, options = {}) {
    const { limit = 20, offset = 0 } = options;
    const cacheKey = `${this.name}_category_${categoryId}_${limit}_${offset}`;

    return this.cachedRequest(cacheKey, async () => {
      const url = `${this.baseUrl}/category/${encodeURIComponent(categoryId)}?limit=${limit}&offset=${offset}`;
      const data = await this.makeRequest(url);

      return (data.products || data.results || []).map(product => this.normalizeProduct(product));
    });
  }

  async getProductDetails(productId) {
    const cacheKey = `${this.name}_product_${productId}`;

    return this.cachedRequest(cacheKey, async () => {
      const url = `${this.baseUrl}/product/${productId}`;
      const data = await this.makeRequest(url);

      return this.normalizeProduct(data.product || data);
    });
  }

  async getCategories() {
    const cacheKey = `${this.name}_categories`;

    return this.cachedRequest(cacheKey, async () => {
      const url = `${this.baseUrl}/categories`;
      const data = await this.makeRequest(url);

      return (data.categories || []).map(category => this.normalizeCategory(category));
    });
  }
}

module.exports = RapidAPIAdapter;