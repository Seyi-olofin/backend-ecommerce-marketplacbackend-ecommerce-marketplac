const BaseAdapter = require('./BaseAdapter');

class AmazonAdapter extends BaseAdapter {
  constructor() {
    super({
      name: 'amazon',
      baseUrl: 'https://amazon-product-reviews-keywords.p.rapidapi.com',
      authType: 'apikey',
      credentials: {
        apiKey: process.env.RAPIDAPI_KEY
      },
      rateLimit: { requests: 100, period: 60000 } // Adjust based on RapidAPI plan
    });
  }

  async getCategories() {
    try {
      // Note: Update with actual RapidAPI Amazon categories endpoint
      const data = await this.makeRequest(
        `${this.baseUrl}/categories`,
        {
          headers: {
            'X-RapidAPI-Host': 'amazon-product-reviews-keywords.p.rapidapi.com',
            'X-RapidAPI-Key': this.credentials.apiKey
          }
        }
      );

      return data.categories?.slice(0, 20).map(category =>
        this.normalizeCategory({
          id: category.id,
          name: category.name,
          image: category.image || `https://picsum.photos/300/200?random=${category.id}`
        })
      ) || [];
    } catch (error) {
      console.error('Amazon categories error:', error);
      return [];
    }
  }

  async searchProducts(query, options = {}) {
    const { limit = 20, offset = 0 } = options;

    try {
      // Note: Update with actual RapidAPI Amazon search endpoint
      const data = await this.makeRequest(
        `${this.baseUrl}/product/search?keyword=${encodeURIComponent(query)}&page=${Math.floor(offset / limit) + 1}&limit=${limit}`,
        {
          headers: {
            'X-RapidAPI-Host': 'amazon-product-reviews-keywords.p.rapidapi.com',
            'X-RapidAPI-Key': this.credentials.apiKey
          }
        }
      );

      return data.products?.map(product => this.normalizeProduct(product)) || [];
    } catch (error) {
      console.error('Amazon search error:', error);
      return [];
    }
  }

  async getProductDetails(productId) {
    try {
      // Remove amazon_ prefix if present
      const cleanId = productId.replace('amazon_', '');
      // Note: Update with actual RapidAPI Amazon product details endpoint
      const data = await this.makeRequest(
        `${this.baseUrl}/product/${cleanId}`,
        {
          headers: {
            'X-RapidAPI-Host': 'amazon-product-reviews-keywords.p.rapidapi.com',
            'X-RapidAPI-Key': this.credentials.apiKey
          }
        }
      );

      return this.normalizeProduct(data);
    } catch (error) {
      console.error('Amazon product details error:', error);
      throw error;
    }
  }

  async getProductsByCategory(categoryId, options = {}) {
    const { limit = 20, offset = 0 } = options;

    try {
      // Remove amazon_ prefix if present
      const cleanCategory = categoryId.replace('amazon_', '');
      // Note: Update with actual RapidAPI Amazon category products endpoint
      const data = await this.makeRequest(
        `${this.baseUrl}/products/category/${cleanCategory}?page=${Math.floor(offset / limit) + 1}&limit=${limit}`,
        {
          headers: {
            'X-RapidAPI-Host': 'amazon-product-reviews-keywords.p.rapidapi.com',
            'X-RapidAPI-Key': this.credentials.apiKey
          }
        }
      );

      return data.products?.map(product => this.normalizeProduct(product)) || [];
    } catch (error) {
      console.error('Amazon category products error:', error);
      return [];
    }
  }

  normalizeProduct(apiProduct) {
    return {
      id: `amazon_${apiProduct.id || apiProduct.asin}`,
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
      source: 'amazon',
      availability: {
        stock: apiProduct.stock || apiProduct.quantity || 10,
        status: apiProduct.availability || 'in_stock'
      },
      specifications: apiProduct.specifications || {},
      metadata: apiProduct
    };
  }

  normalizeCategory(apiCategory) {
    return {
      id: `amazon_${apiCategory.id}`,
      name: apiCategory.name,
      image: apiCategory.image || `https://picsum.photos/300/200?random=${apiCategory.id}`,
      description: `${apiCategory.name} products from Amazon`,
      source: 'amazon',
      parentId: apiCategory.parentId || null
    };
  }
}

module.exports = AmazonAdapter;