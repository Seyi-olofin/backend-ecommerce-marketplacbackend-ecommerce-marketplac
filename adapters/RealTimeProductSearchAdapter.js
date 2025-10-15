const RapidAPIAdapter = require('./RapidAPIAdapter');

class RealTimeProductSearchAdapter extends RapidAPIAdapter {
  constructor() {
    super({
      name: 'realtimeproductsearch',
      baseUrl: 'https://real-time-product-search.p.rapidapi.com',
      authType: 'apikey',
      credentials: { apiKey: process.env.RAPIDAPI_KEY },
      rateLimit: { requests: 100, period: 60000 },
      cacheTTL: 10 * 60 * 1000
    });
  }

  async searchProducts(query, options = {}) {
    const { limit = 20, offset = 0 } = options;
    const cacheKey = `${this.name}_search_${query}_${limit}_${offset}`;

    return this.cachedRequest(cacheKey, async () => {
      try {
        const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&country=US&language=en&limit=${limit}&offset=${offset}`;
        const data = await this.makeRequest(url);

        return (data.data || []).map(product => this.normalizeProduct(product));
      } catch (error) {
        console.warn('RealTimeProductSearch search failed:', error.message);
        return [];
      }
    });
  }

  async getProductsByCategory(categoryId, options = {}) {
    const { limit = 20, offset = 0 } = options;
    const cacheKey = `${this.name}_category_${categoryId}_${limit}_${offset}`;

    return this.cachedRequest(cacheKey, async () => {
      try {
        // Map category names to search terms
        const categoryMap = {
          'electronics': 'electronics',
          'laptops': 'laptop',
          'mens-shirts': 'mens shirt',
          'womens-fashion': 'womens fashion',
          'beauty-skincare': 'beauty skincare',
          'home-garden': 'home garden',
          'sports': 'sports',
          'automotive': 'automotive',
          'motorcycle': 'motorcycle',
          'general': 'popular products'
        };

        const searchTerm = categoryMap[categoryId] || categoryId;
        return await this.searchProducts(searchTerm, options);
      } catch (error) {
        console.warn('RealTimeProductSearch category failed:', error.message);
        return [];
      }
    });
  }

  async getProductDetails(productId) {
    const cacheKey = `${this.name}_product_${productId}`;

    return this.cachedRequest(cacheKey, async () => {
      try {
        const url = `${this.baseUrl}/product-details?product_id=${encodeURIComponent(productId)}&country=US&language=en`;
        const data = await this.makeRequest(url);

        return this.normalizeProduct(data.data || data);
      } catch (error) {
        console.warn('RealTimeProductSearch product details failed:', error.message);
        throw error;
      }
    });
  }

  async getCategories() {
    const cacheKey = `${this.name}_categories`;

    return this.cachedRequest(cacheKey, async () => {
      // Return predefined categories since this API doesn't provide categories endpoint
      return [
        { id: 'electronics', name: 'Electronics', image: 'https://picsum.photos/300/200?random=electronics' },
        { id: 'laptops', name: 'Laptops', image: 'https://picsum.photos/300/200?random=laptops' },
        { id: 'mens-shirts', name: 'Men\'s Shirts', image: 'https://picsum.photos/300/200?random=mens-shirts' },
        { id: 'womens-fashion', name: 'Women\'s Fashion', image: 'https://picsum.photos/300/200?random=womens-fashion' },
        { id: 'beauty-skincare', name: 'Beauty & Skincare', image: 'https://picsum.photos/300/200?random=beauty-skincare' },
        { id: 'home-garden', name: 'Home & Garden', image: 'https://picsum.photos/300/200?random=home-garden' },
        { id: 'sports', name: 'Sports', image: 'https://picsum.photos/300/200?random=sports' },
        { id: 'automotive', name: 'Automotive', image: 'https://picsum.photos/300/200?random=automotive' },
        { id: 'motorcycle', name: 'Motorcycle', image: 'https://picsum.photos/300/200?random=motorcycle' }
      ].map(category => this.normalizeCategory(category));
    });
  }

  normalizeProduct(apiProduct) {
    return {
      id: `${this.name}_${apiProduct.product_id || apiProduct.asin || Math.random().toString(36).substr(2, 9)}`,
      title: apiProduct.product_title || apiProduct.title || 'Unknown Product',
      description: apiProduct.product_description || apiProduct.description || '',
      price: {
        amount: parseFloat(apiProduct.product_price || apiProduct.price || 0),
        currency: apiProduct.currency || 'USD'
      },
      images: apiProduct.product_photos || [apiProduct.product_photo],
      thumbnail: apiProduct.product_photo || apiProduct.thumbnail || 'https://picsum.photos/300/300?random=product',
      rating: parseFloat(apiProduct.product_star_rating || apiProduct.rating || 4.5),
      category: apiProduct.category || 'general',
      brand: apiProduct.brand || '',
      source: this.name,
      availability: {
        stock: apiProduct.stock || 10,
        status: 'in_stock'
      },
      specifications: apiProduct.specifications || {},
      metadata: apiProduct
    };
  }

  normalizeCategory(apiCategory) {
    return {
      id: `${this.name}_${apiCategory.id}`,
      name: apiCategory.name,
      image: apiCategory.image,
      description: `${apiCategory.name} products`,
      source: this.name,
      parentId: null
    };
  }
}

module.exports = RealTimeProductSearchAdapter;