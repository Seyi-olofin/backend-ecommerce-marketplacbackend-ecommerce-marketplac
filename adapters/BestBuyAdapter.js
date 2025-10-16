const RapidAPIAdapter = require('./RapidAPIAdapter');

class BestBuyAdapter extends RapidAPIAdapter {
  constructor() {
    super({
      name: 'bestbuy',
      baseUrl: 'https://bestbuyraygorodskijv1.p.rapidapi.com',
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
        const url = `${this.baseUrl}/getSimilarProducts?query=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`;
        const data = await this.makeRequest(url);

        return (data.products || data.results || []).map(product => this.normalizeProduct(product));
      } catch (error) {
        console.warn('BestBuy search failed:', error.message);
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
          'mens-shirts': 'mens clothing',
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
        console.warn('BestBuy category failed:', error.message);
        return [];
      }
    });
  }

  async getProductDetails(productId) {
    const cacheKey = `${this.name}_product_${productId}`;

    return this.cachedRequest(cacheKey, async () => {
      try {
        const url = `${this.baseUrl}/getProductDetails?productId=${encodeURIComponent(productId)}`;
        const data = await this.makeRequest(url);

        return this.normalizeProduct(data.product || data);
      } catch (error) {
        console.warn('BestBuy product details failed:', error.message);
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
      id: `${this.name}_${apiProduct.id || apiProduct.sku || Math.random().toString(36).substr(2, 9)}`,
      title: apiProduct.title || apiProduct.name || 'Unknown Product',
      description: apiProduct.description || apiProduct.shortDescription || '',
      price: {
        amount: parseFloat(apiProduct.price || apiProduct.salePrice || 0),
        currency: 'USD'
      },
      images: apiProduct.images || [apiProduct.image],
      thumbnail: apiProduct.thumbnail || apiProduct.image || 'https://picsum.photos/300/300?random=product',
      rating: parseFloat(apiProduct.rating || apiProduct.customerReviewAverage || 4.5),
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

module.exports = BestBuyAdapter;