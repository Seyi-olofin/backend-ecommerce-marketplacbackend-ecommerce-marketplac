const BaseAdapter = require('./BaseAdapter');

class EtsyAdapter extends BaseAdapter {
  constructor() {
    super({
      name: 'etsy',
      baseUrl: 'https://api.etsy.com/v3/application',
      authType: 'apikey', // Etsy uses API key in header
      credentials: {
        apiKey: process.env.ETSY_API_KEY
      },
      rateLimit: { requests: 10000, period: 86400000 } // 10,000 requests per day
    });
  }

  async getCategories() {
    // Etsy doesn't have traditional categories, but we can create some based on common types
    const categories = [
      { id: 'handmade', name: 'Handmade & Unique' },
      { id: 'fashion', name: 'Fashion & Accessories' },
      { id: 'home', name: 'Home & Living' },
      { id: 'jewelry', name: 'Jewelry & Accessories' },
      { id: 'art', name: 'Art & Collectibles' },
      { id: 'crafts', name: 'Craft Supplies' }
    ];

    return categories.map(cat => this.normalizeCategory({
      id: cat.id,
      name: cat.name,
      image: `https://picsum.photos/300/200?random=${cat.id}`
    }));
  }

  async searchProducts(query, options = {}) {
    const { limit = 20, offset = 0 } = options;

    try {
      const data = await this.makeRequest(
        `${this.baseUrl}/listings/active?keywords=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`,
        {
          headers: {
            'x-api-key': this.credentials.apiKey
          }
        }
      );

      return data.results.map(listing => this.normalizeProduct(listing));
    } catch (error) {
      console.error('Etsy search error:', error);
      return [];
    }
  }

  async getProductDetails(productId) {
    try {
      // Remove etsy_ prefix if present
      const cleanId = productId.replace('etsy_', '');
      const data = await this.makeRequest(
        `${this.baseUrl}/listings/${cleanId}`,
        {
          headers: {
            'x-api-key': this.credentials.apiKey
          }
        }
      );

      return this.normalizeProduct(data);
    } catch (error) {
      console.error('Etsy product details error:', error);
      throw error;
    }
  }

  async getProductsByCategory(categoryId, options = {}) {
    const { limit = 20, offset = 0 } = options;

    try {
      // Etsy doesn't have strict categories, so we'll search by keywords
      const categoryKeywords = {
        'handmade': 'handmade',
        'fashion': 'fashion accessories',
        'home': 'home living',
        'jewelry': 'jewelry',
        'art': 'art collectibles',
        'crafts': 'craft supplies'
      };

      const keyword = categoryKeywords[categoryId] || categoryId;

      return await this.searchProducts(keyword, options);
    } catch (error) {
      console.error('Etsy category products error:', error);
      return [];
    }
  }

  normalizeProduct(apiProduct) {
    return {
      id: `etsy_${apiProduct.listing_id}`,
      title: apiProduct.title,
      description: apiProduct.description || apiProduct.title,
      price: {
        amount: parseFloat(apiProduct.price?.amount || 0) / 100, // Etsy prices are in cents
        currency: apiProduct.price?.currency_code || 'USD'
      },
      images: apiProduct.images ? apiProduct.images.map(img => img.url_fullxfull) : [],
      thumbnail: apiProduct.images?.[0]?.url_170x135 || apiProduct.images?.[0]?.url_fullxfull,
      rating: 4.5, // Etsy doesn't provide ratings in basic API
      category: 'Handmade', // Default category for Etsy
      source: 'etsy',
      availability: {
        stock: apiProduct.quantity || 1,
        status: apiProduct.quantity > 0 ? 'in_stock' : 'out_of_stock'
      },
      specifications: {},
      metadata: apiProduct
    };
  }

  normalizeCategory(apiCategory) {
    return {
      id: `etsy_${apiCategory.id}`,
      name: apiCategory.name,
      image: apiCategory.image || `https://picsum.photos/300/200?random=${apiCategory.id}`,
      description: `${apiCategory.name} from Etsy artisans`,
      source: 'etsy',
      parentId: null
    };
  }
}

module.exports = EtsyAdapter;