class PriorityResolver {
  constructor() {
    // Priority configuration by region and category
    this.priorities = {
      // Global APIs (highest priority for general searches)
      global: ['ebay', 'amazon', 'aliexpress', 'etsy', 'dummyjson', 'fakestore'],

      // Regional priorities
      regions: {
        'US': ['bestbuy', 'ebay', 'amazon', 'aliexpress', 'etsy', 'dummyjson', 'fakestore'],
        'CA': ['ebay', 'etsy', 'fakestore'],
        'GB': ['ebay', 'etsy', 'fakestore'],
        'EU': ['ebay', 'etsy', 'fakestore'],
        'IN': ['flipkart', 'ebay', 'etsy', 'fakestore'],
        'ID': ['tokopedia', 'shopee', 'lazada', 'ebay', 'fakestore'],
        'SG': ['lazada', 'shopee', 'ebay', 'fakestore'],
        'MY': ['lazada', 'shopee', 'ebay', 'fakestore'],
        'TH': ['lazada', 'shopee', 'ebay', 'fakestore'],
        'VN': ['lazada', 'shopee', 'ebay', 'fakestore'],
        'PH': ['lazada', 'shopee', 'ebay', 'fakestore'],
        'BR': ['mercadolibre', 'ebay', 'etsy', 'fakestore'],
        'MX': ['mercadolibre', 'ebay', 'etsy', 'fakestore'],
        'AR': ['mercadolibre', 'ebay', 'etsy', 'fakestore'],
        'CL': ['mercadolibre', 'ebay', 'etsy', 'fakestore'],
        'CO': ['mercadolibre', 'ebay', 'etsy', 'fakestore'],
        'PE': ['mercadolibre', 'ebay', 'etsy', 'fakestore'],
        'PL': ['olx', 'ebay', 'etsy', 'fakestore']
      },

      // Category-specific priorities
      categories: {
        'electronics': ['bestbuy', 'ebay', 'amazon', 'aliexpress', 'digikey', 'octopart', 'etsy', 'dummyjson', 'fakestore'],
        'phones': ['bestbuy', 'ebay', 'etsy', 'fakestore'],
        'computers': ['bestbuy', 'ebay', 'etsy', 'fakestore'],
        'laptops': ['bestbuy', 'ebay', 'etsy', 'fakestore'],
        'tablets': ['bestbuy', 'ebay', 'etsy', 'fakestore'],
        'headphones': ['bestbuy', 'ebay', 'etsy', 'fakestore'],
        'cameras': ['bestbuy', 'ebay', 'etsy', 'fakestore'],
        'gaming': ['bestbuy', 'ebay', 'etsy', 'fakestore'],
        'fashion': ['etsy', 'ebay', 'fakestore'],
        'clothing': ['etsy', 'ebay', 'fakestore'],
        'shoes': ['etsy', 'ebay', 'fakestore'],
        'jewelry': ['etsy', 'ebay', 'fakestore'],
        'handmade': ['etsy', 'ebay', 'fakestore'],
        'home': ['etsy', 'ebay', 'fakestore'],
        'garden': ['etsy', 'ebay', 'fakestore'],
        'sports': ['ebay', 'etsy', 'fakestore'],
        'books': ['ebay', 'etsy', 'fakestore'],
        'toys': ['ebay', 'etsy', 'fakestore'],
        'beauty': ['ebay', 'etsy', 'fakestore'],
        'health': ['ebay', 'etsy', 'fakestore']
      }
    };

    // Feature flags to enable/disable APIs
    this.featureFlags = {
      ebay: process.env.ENABLE_EBAY === 'true',
      bestbuy: process.env.ENABLE_BESTBUY === 'true',
      etsy: process.env.ENABLE_ETSY === 'true',
      flipkart: process.env.ENABLE_FLIPKART === 'true',
      lazada: process.env.ENABLE_LAZADA === 'true',
      shopee: process.env.ENABLE_SHOPEE === 'true',
      tokopedia: process.env.ENABLE_TOKOPEDIA === 'true',
      mercadolibre: process.env.ENABLE_MERCADOLIBRE === 'true',
      olx: process.env.ENABLE_OLX === 'true',
      digikey: process.env.ENABLE_DIGIKEY === 'true',
      octopart: process.env.ENABLE_OCTOPART === 'true',
      dummyjson: true, // Always enabled as free API
      aliexpress: process.env.ENABLE_ALIEXPRESS === 'true',
      amazon: process.env.ENABLE_AMAZON === 'true',
      fakestore: true // Always enabled as fallback
    };
  }

  // Get available APIs for a given context
  getAvailableAPIs(region = null, category = null) {
    let candidates = [...this.priorities.global];

    // Add region-specific APIs
    if (region && this.priorities.regions[region]) {
      candidates = [...this.priorities.regions[region], ...candidates];
    }

    // Add category-specific APIs
    if (category) {
      const categoryKey = this.normalizeCategory(category);
      if (this.priorities.categories[categoryKey]) {
        candidates = [...this.priorities.categories[categoryKey], ...candidates];
      }
    }

    // Remove duplicates while preserving order
    const seen = new Set();
    candidates = candidates.filter(api => {
      if (seen.has(api)) return false;
      seen.add(api);
      return this.featureFlags[api] !== false; // Include if flag is not explicitly false
    });

    return candidates;
  }

  // Normalize category name for matching
  normalizeCategory(category) {
    const normalized = category.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();

    // Map common variations
    const mappings = {
      'electronic': 'electronics',
      'phone': 'phones',
      'computer': 'computers',
      'laptop': 'laptops',
      'tablet': 'tablets',
      'headphone': 'headphones',
      'camera': 'cameras',
      'game': 'gaming',
      'cloth': 'clothing',
      'shoe': 'shoes',
      'jewelry': 'jewelry',
      'handmade': 'handmade',
      'home': 'home',
      'garden': 'garden',
      'sport': 'sports',
      'book': 'books',
      'toy': 'toys',
      'beauty': 'beauty',
      'health': 'health'
    };

    for (const [key, value] of Object.entries(mappings)) {
      if (normalized.includes(key)) {
        return value;
      }
    }

    return normalized;
  }

  // Determine region from IP or user preference
  async getRegionFromIP(ip) {
    // Simple region detection - in production, use a geolocation service
    // For now, return null to use global priorities
    return null;
  }

  // Resolve which API to use for a request
  async resolveAPI(adapters, options = {}) {
    const { region, category, query, productId } = options;

    let availableAPIs = this.getAvailableAPIs(region, category);

    // Try APIs in priority order
    for (const apiName of availableAPIs) {
      const adapter = adapters[apiName];
      if (!adapter) continue;

      try {
        // Test if adapter can handle the request
        if (productId) {
          await adapter.getProductDetails(productId);
        } else if (category) {
          await adapter.getProductsByCategory(category, { limit: 1 });
        } else if (query) {
          await adapter.searchProducts(query, { limit: 1 });
        }

        console.log(`Selected API: ${apiName} for request`, options);
        return adapter;
      } catch (error) {
        console.warn(`${apiName} API failed, trying next priority...`, error.message);
        continue;
      }
    }

    // Fallback to dummyjson if all else fails (DummyJSON as universal fallback)
    console.warn('All prioritized APIs failed, using dummyjson fallback');
    return adapters.dummyjson;
  }

  // Update feature flags dynamically
  updateFeatureFlag(apiName, enabled) {
    this.featureFlags[apiName] = enabled;
  }

  // Get current feature flags
  getFeatureFlags() {
    return { ...this.featureFlags };
  }
}

module.exports = PriorityResolver;