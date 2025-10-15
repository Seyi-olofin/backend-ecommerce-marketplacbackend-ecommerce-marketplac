const BaseAdapter = require('./BaseAdapter');

class FakeStoreAdapter extends BaseAdapter {
  constructor() {
    super({
      name: 'fakestore',
      baseUrl: 'https://fakestoreapi.com',
      authType: 'public',
      rateLimit: { requests: 100, period: 60000 } // 100 requests per minute
    });
  }

  async getCategories() {
    try {
      const data = await this.makeRequest(`${this.baseUrl}/products/categories`);

      // Create hierarchical categories with subcategories
      const categoryHierarchy = {
        "electronics": {
          name: "Electronics & Smart Gadgets",
          image: "/assets/category-electronics.jpg",
          subcategories: [
            { id: "smartphones", name: "Smartphones", image: "https://picsum.photos/300/200?random=1" },
            { id: "laptops", name: "Laptops", image: "https://picsum.photos/300/200?random=2" },
            { id: "cameras", name: "Cameras", image: "https://picsum.photos/300/200?random=3" },
            { id: "headphones", name: "Headphones", image: "https://picsum.photos/300/200?random=4" }
          ]
        },
        "jewelery": {
          name: "Jewelry & Accessories",
          image: "/assets/category-fashion.jpg",
          subcategories: [
            { id: "necklaces", name: "Necklaces", image: "https://picsum.photos/300/200?random=5" },
            { id: "rings", name: "Rings", image: "https://picsum.photos/300/200?random=6" },
            { id: "earrings", name: "Earrings", image: "https://picsum.photos/300/200?random=7" }
          ]
        },
        "men's clothing": {
          name: "Men's Fashion",
          image: "/assets/category-fashion.jpg",
          subcategories: [
            { id: "mens-shirts", name: "Shirts", image: "https://picsum.photos/300/200?random=8" },
            { id: "mens-pants", name: "Pants", image: "https://picsum.photos/300/200?random=9" },
            { id: "mens-shoes", name: "Shoes", image: "https://picsum.photos/300/200?random=10" }
          ]
        },
        "women's clothing": {
          name: "Women's Fashion",
          image: "/assets/category-fashion.jpg",
          subcategories: [
            { id: "womens-dresses", name: "Dresses", image: "https://picsum.photos/300/200?random=11" },
            { id: "womens-tops", name: "Tops", image: "https://picsum.photos/300/200?random=12" },
            { id: "womens-shoes", name: "Shoes", image: "https://picsum.photos/300/200?random=13" }
          ]
        }
      };

      return Object.entries(categoryHierarchy).map(([key, category], index) =>
        this.normalizeCategory({
          id: key,
          name: category.name,
          image: category.image,
          subcategories: category.subcategories.map(sub => this.normalizeCategory(sub))
        })
      );
    } catch (error) {
      console.error('FakeStore categories error:', error);
      return [];
    }
  }

  async searchProducts(query, options = {}) {
    const { limit = 20, offset = 0 } = options;

    try {
      // FakeStore doesn't have search, so get all products and filter
      const data = await this.makeRequest(`${this.baseUrl}/products`);
      const filtered = data.filter(product =>
        product.title.toLowerCase().includes(query.toLowerCase()) ||
        product.description.toLowerCase().includes(query.toLowerCase()) ||
        product.category.toLowerCase().includes(query.toLowerCase())
      );

      return filtered
        .slice(offset, offset + limit)
        .map(product => this.normalizeProduct(product));
    } catch (error) {
      console.error('FakeStore search error:', error);
      return [];
    }
  }

  async getProductDetails(productId) {
    try {
      // Remove fakestore_ prefix if present
      const cleanId = productId.replace('fakestore_', '');
      const data = await this.makeRequest(`${this.baseUrl}/products/${cleanId}`);
      return this.normalizeProduct(data);
    } catch (error) {
      console.error('FakeStore product details error:', error);
      throw error;
    }
  }

  async getProductsByCategory(categoryId, options = {}) {
    const { limit = 20, offset = 0 } = options;

    try {
      // Remove fakestore_ prefix if present
      const cleanCategory = categoryId.replace('fakestore_', '');

      // Handle 'general' as all products
      if (cleanCategory === 'general') {
        const data = await this.makeRequest(`${this.baseUrl}/products`);
        return data
          .slice(offset, offset + limit)
          .map(product => this.normalizeProduct(product));
      }

      const data = await this.makeRequest(`${this.baseUrl}/products/category/${cleanCategory}`);

      return data
        .slice(offset, offset + limit)
        .map(product => this.normalizeProduct(product));
    } catch (error) {
      console.error('FakeStore category products error:', error);
      return [];
    }
  }

  // Override normalize methods for FakeStore specific format
  normalizeProduct(apiProduct) {
    return {
      id: `fakestore_${apiProduct.id}`,
      title: apiProduct.title,
      description: apiProduct.description,
      price: {
        amount: apiProduct.price,
        currency: 'USD'
      },
      images: [apiProduct.image],
      thumbnail: apiProduct.image,
      rating: apiProduct.rating?.rate || 4.5,
      category: apiProduct.category,
      source: 'fakestore',
      availability: {
        stock: 10, // FakeStore doesn't provide stock
        status: 'in_stock'
      },
      specifications: {},
      metadata: apiProduct
    };
  }

  normalizeCategory(apiCategory) {
    return {
      id: `fakestore_${apiCategory.id}`,
      name: apiCategory.name.charAt(0).toUpperCase() + apiCategory.name.slice(1),
      image: apiCategory.image,
      description: `${apiCategory.name} products`,
      source: 'fakestore',
      parentId: null
    };
  }
}

module.exports = FakeStoreAdapter;