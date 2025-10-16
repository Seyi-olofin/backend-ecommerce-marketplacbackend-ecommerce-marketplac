const BaseAdapter = require('./BaseAdapter');

class EbayAdapter extends BaseAdapter {
  constructor() {
    super({
      name: 'ebay',
      baseUrl: 'https://api.ebay.com',
      authType: 'oauth',
      credentials: {
        accessToken: process.env.EBAY_ACCESS_TOKEN,
        appId: process.env.EBAY_APP_ID
      },
      rateLimit: { requests: 5000, period: 86400000 } // 5000 requests per day
    });
  }

  async getCategories() {
    try {
      const data = await this.makeRequest(
        `${this.baseUrl}/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=EBAY_US`
      );

      const treeId = data.categoryTreeId;

      const treeData = await this.makeRequest(
        `${this.baseUrl}/commerce/taxonomy/v1/category_tree/${treeId}`
      );

      // Get top-level categories
      const topCategories = treeData.categoryTreeNode.childCategoryTreeNodes || [];

      return topCategories.slice(0, 20).map(category =>
        this.normalizeCategory({
          id: category.category.categoryId,
          name: category.category.categoryName,
          image: `https://picsum.photos/300/200?random=${category.category.categoryId}`
        })
      );
    } catch (error) {
      console.error('eBay categories error:', error);
      return [];
    }
  }

  async searchProducts(query, options = {}) {
    const { limit = 20, offset = 0 } = options;

    try {
      const data = await this.makeRequest(
        `${this.baseUrl}/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`,
        {
          headers: {
            'Authorization': `Bearer ${this.credentials.accessToken}`,
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
          }
        }
      );

      return data.itemSummaries.map(item => this.normalizeProduct(item));
    } catch (error) {
      console.error('eBay search error:', error);
      return [];
    }
  }

  async getProductDetails(productId) {
    try {
      // Remove ebay_ prefix if present
      const cleanId = productId.replace('ebay_', '');
      const data = await this.makeRequest(
        `${this.baseUrl}/buy/browse/v1/item/${cleanId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.credentials.accessToken}`,
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
          }
        }
      );

      return this.normalizeProduct(data);
    } catch (error) {
      console.error('eBay product details error:', error);
      throw error;
    }
  }

  async getProductsByCategory(categoryId, options = {}) {
    const { limit = 20, offset = 0 } = options;

    try {
      // Remove ebay_ prefix if present
      const cleanCategory = categoryId.replace('ebay_', '');
      const data = await this.makeRequest(
        `${this.baseUrl}/buy/browse/v1/item_summary/search?category_ids=${cleanCategory}&limit=${limit}&offset=${offset}`,
        {
          headers: {
            'Authorization': `Bearer ${this.credentials.accessToken}`,
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
          }
        }
      );

      return data.itemSummaries.map(item => this.normalizeProduct(item));
    } catch (error) {
      console.error('eBay category products error:', error);
      return [];
    }
  }

  normalizeProduct(apiProduct) {
    return {
      id: `ebay_${apiProduct.itemId}`,
      title: apiProduct.title,
      description: apiProduct.shortDescription || apiProduct.description || apiProduct.title,
      price: {
        amount: parseFloat(apiProduct.price?.value || 0),
        currency: apiProduct.price?.currency || 'USD'
      },
      images: apiProduct.additionalImages ?
        [apiProduct.image?.imageUrl, ...apiProduct.additionalImages.map(img => img.imageUrl)].filter(Boolean) :
        [apiProduct.image?.imageUrl].filter(Boolean),
      thumbnail: apiProduct.thumbnailImages?.[0]?.imageUrl || apiProduct.image?.imageUrl,
      rating: apiProduct.seller?.feedbackPercentage ? Math.round(apiProduct.seller.feedbackPercentage / 20) : 4.5,
      category: apiProduct.categories?.[0]?.categoryName || 'General',
      source: 'ebay',
      availability: {
        stock: 10, // eBay doesn't provide stock in browse API
        status: 'in_stock'
      },
      specifications: apiProduct.localizedAspects || {},
      metadata: apiProduct
    };
  }

  normalizeCategory(apiCategory) {
    return {
      id: `ebay_${apiCategory.id}`,
      name: apiCategory.name,
      image: apiCategory.image || `https://picsum.photos/300/200?random=${apiCategory.id}`,
      description: `${apiCategory.name} products from eBay`,
      source: 'ebay',
      parentId: null
    };
  }
}

module.exports = EbayAdapter;