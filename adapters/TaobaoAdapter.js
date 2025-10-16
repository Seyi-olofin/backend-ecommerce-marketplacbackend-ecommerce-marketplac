const RapidAPIAdapter = require('./RapidAPIAdapter');

class TaobaoAdapter extends RapidAPIAdapter {
  constructor() {
    super({
      name: 'taobao',
      baseUrl: 'https://taobao-api2.p.rapidapi.com'
    });
  }

  async searchProducts(query, options = {}) {
    const { limit = 20, offset = 0 } = options;
    const cacheKey = `taobao_search_${query}_${limit}_${offset}`;

    return this.cachedRequest(cacheKey, async () => {
      const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`;
      const data = await this.makeRequest(url);

      return (data.result_list || []).map(product => this.normalizeProduct(product));
    });
  }

  async getProductsByCategory(categoryId, options = {}) {
    const { limit = 20, offset = 0 } = options;
    const cacheKey = `taobao_category_${categoryId}_${limit}_${offset}`;

    return this.cachedRequest(cacheKey, async () => {
      // Map category IDs to search terms
      const categoryMap = {
        'electronics': 'electronics',
        'mens-shirts': 'mens clothing',
        'laptops': 'laptops',
        'womens-fashion': 'womens fashion',
        'beauty-skincare': 'beauty skincare',
        'home-garden': 'home garden',
        'sports': 'sports'
      };

      const searchTerm = categoryMap[categoryId] || categoryId;
      return this.searchProducts(searchTerm, options);
    });
  }

  normalizeProduct(apiProduct) {
    return {
      id: `taobao_${apiProduct.item_id || apiProduct.num_iid}`,
      title: apiProduct.title || apiProduct.item_title,
      description: apiProduct.description || '',
      price: {
        amount: parseFloat(apiProduct.price || apiProduct.item_price || 0),
        currency: 'CNY' // Taobao is Chinese, so prices are in CNY
      },
      images: apiProduct.item_imgs || [apiProduct.pic_url],
      thumbnail: apiProduct.pic_url || apiProduct.item_img,
      rating: 4.5, // Taobao doesn't provide ratings in basic API
      category: apiProduct.category || 'general',
      brand: apiProduct.brand || '',
      source: 'taobao',
      availability: {
        stock: parseInt(apiProduct.quantity) || 10,
        status: 'in_stock'
      },
      specifications: {},
      metadata: apiProduct
    };
  }
}

module.exports = TaobaoAdapter;