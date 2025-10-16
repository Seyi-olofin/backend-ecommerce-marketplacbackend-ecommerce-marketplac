const BaseAdapter = require('./BaseAdapter');

class DummyJSONAdapter extends BaseAdapter {
  constructor() {
    super({
      name: 'dummyjson',
      baseUrl: 'https://dummyjson.com',
      authType: 'public',
      rateLimit: { requests: 100, period: 60000 } // 100 requests per minute
    });
  }

  async getCategories() {
    return this.cachedRequest(`${this.name}_categories`, async () => {
      try {
        const data = await this.makeRequest(`${this.baseUrl}/products/categories`);

        if (!Array.isArray(data)) {
          console.error('DummyJSON categories response is not an array:', data);
          return [];
        }

        return data.slice(0, 20).map(category => {
          if (typeof category === 'string') {
            return this.normalizeCategory({
              id: category,
              name: category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, ' '),
              image: `https://picsum.photos/300/200?random=${category}`
            });
          } else if (category && typeof category === 'object' && category.slug) {
            return this.normalizeCategory({
              id: category.slug,
              name: category.name || category.slug.charAt(0).toUpperCase() + category.slug.slice(1).replace(/-/g, ' '),
              image: `https://picsum.photos/300/200?random=${category.slug}`
            });
          } else {
            console.warn('DummyJSON category is not a string or object with slug:', category);
            return null;
          }
        }).filter(cat => cat !== null);
      } catch (error) {
        console.error('DummyJSON categories error:', error);
        return [];
      }
    });
  }

  async searchProducts(query, options = {}) {
    const { limit = 20, offset = 0 } = options;

    try {
      const data = await this.makeRequest(
        `${this.baseUrl}/products/search?q=${encodeURIComponent(query)}&limit=${limit}&skip=${offset}`
      );

      return data.products.map(product => this.normalizeProduct(product));
    } catch (error) {
      console.error('DummyJSON search error:', error);
      return [];
    }
  }

  async getProductDetails(productId) {
    try {
      // Remove dummyjson_ prefix if present
      const cleanId = productId.replace('dummyjson_', '');
      const data = await this.makeRequest(`${this.baseUrl}/products/${cleanId}`);

      return this.normalizeProduct(data);
    } catch (error) {
      console.error('DummyJSON product details error:', error);
      throw error;
    }
  }

  async getProductsByCategory(categoryId, options = {}) {
    const { limit = 20, offset = 0 } = options;

    try {
      // Remove dummyjson_ prefix if present
      const cleanCategory = categoryId.replace('dummyjson_', '');

      // Handle 'general' as all products
      if (cleanCategory === 'general') {
        const data = await this.makeRequest(
          `${this.baseUrl}/products?limit=${limit}&skip=${offset}`
        );
        return data.products.map(product => this.normalizeProduct(product));
      }

      // Special handling for mens-watches - use general products and filter
      if (cleanCategory === 'mens-watches') {
        const data = await this.makeRequest(`${this.baseUrl}/products?limit=${limit * 3}&skip=${offset}`);
        const watches = data.products.filter(product =>
          product.title.toLowerCase().includes('watch') ||
          product.description.toLowerCase().includes('watch') ||
          product.category === 'mens-watches'
        );
        return watches.slice(0, limit).map(product => this.normalizeProduct(product));
      }

      const data = await this.makeRequest(
        `${this.baseUrl}/products/category/${encodeURIComponent(cleanCategory)}?limit=${limit}&skip=${offset}`
      );

      return data.products.map(product => this.normalizeProduct(product));
    } catch (error) {
      console.error('DummyJSON category products error:', error);
      return [];
    }
  }

  normalizeProduct(apiProduct) {
    return {
      id: `dummyjson_${apiProduct.id}`,
      title: apiProduct.title,
      description: apiProduct.description,
      price: {
        amount: apiProduct.price,
        currency: 'USD'
      },
      images: apiProduct.images || [],
      thumbnail: apiProduct.thumbnail,
      rating: apiProduct.rating,
      category: apiProduct.category,
      brand: apiProduct.brand,
      source: 'dummyjson',
      availability: {
        stock: apiProduct.stock,
        status: apiProduct.stock > 0 ? 'in_stock' : 'out_of_stock'
      },
      specifications: {},
      metadata: apiProduct
    };
  }

  normalizeCategory(apiCategory) {
    // Create a normalized slug for the category ID
    const normalizeSlug = (name) => {
      return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    };

    return {
      id: normalizeSlug(apiCategory.name || apiCategory.id),
      name: apiCategory.name,
      image: apiCategory.image || `https://picsum.photos/300/200?random=${apiCategory.id}`,
      description: `${apiCategory.name} products`,
      source: 'dummyjson',
      parentId: null
    };
  }
}

module.exports = DummyJSONAdapter;