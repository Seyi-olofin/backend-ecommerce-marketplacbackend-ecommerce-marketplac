const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product = require('../models/Product');
const connectDB = require('../config/db');

// Import adapters
const DummyJSONAdapter = require('../adapters/DummyJSONAdapter');
const EbayAdapter = require('../adapters/EbayAdapter');
const AliExpressAdapter = require('../adapters/AliExpressAdapter');
const AmazonAdapter = require('../adapters/AmazonAdapter');
const BestBuyAdapter = require('../adapters/BestBuyAdapter');
const EtsyAdapter = require('../adapters/EtsyAdapter');
const FakeStoreAdapter = require('../adapters/FakeStoreAdapter');

// Configuration
const CONFIG = {
  TARGET_PRODUCT_COUNT: parseInt(process.env.SEED_PRODUCT_COUNT) || 1000,
  PRODUCTS_PER_CATEGORY: parseInt(process.env.SEED_PRODUCTS_PER_CATEGORY) || 50,
  BATCH_SIZE: parseInt(process.env.SEED_BATCH_SIZE) || 100,
  CATEGORIES: [
    'beauty', 'fragrances', 'furniture', 'groceries', 'home-decoration',
    'kitchen-accessories', 'laptops', 'mens-shirts', 'mens-shoes', 'mens-watches',
    'mobile-accessories', 'motorcycle', 'skin-care', 'smartphones', 'sports-accessories',
    'sunglasses', 'tablets', 'tops', 'vehicle', 'womens-bags', 'womens-dresses',
    'womens-jewellery', 'womens-shoes', 'womens-watches', 'electronics', 'sports',
    'home-garden', 'womens-fashion', 'books', 'automotive', 'health', 'toys-games', 'jewelry'
  ],
  FLASH_SALE_PERCENTAGE: 0.15, // 15% of products
  FEATURED_PERCENTAGE: 0.10,   // 10% of products
  DISCOUNT_RANGES: [10, 15, 20, 25, 30, 40, 50]
};

// Initialize adapters based on environment variables
const initializeAdapters = () => {
  const adapters = [];

  // Always include DummyJSON as fallback
  adapters.push(new DummyJSONAdapter());

  // Add other adapters based on env flags
  if (process.env.ENABLE_EBAY === 'true') {
    adapters.push(new EbayAdapter());
  }
  if (process.env.ENABLE_ALIEXPRESS === 'true') {
    adapters.push(new AliExpressAdapter());
  }
  if (process.env.ENABLE_AMAZON === 'true') {
    adapters.push(new AmazonAdapter());
  }
  if (process.env.ENABLE_BESTBUY === 'true') {
    adapters.push(new BestBuyAdapter());
  }
  if (process.env.ENABLE_ETSY === 'true') {
    adapters.push(new EtsyAdapter());
  }
  if (process.env.ENABLE_FAKESTORE === 'true') {
    adapters.push(new FakeStoreAdapter());
  }

  console.log(`🔧 Initialized ${adapters.length} adapters: ${adapters.map(a => a.name).join(', ')}`);
  return adapters;
};

// Normalize product data to match our schema
const normalizeProduct = (apiProduct, adapterName) => {
  // Generate unique ID
  const baseId = apiProduct.id || `${adapterName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const uniqueId = `${adapterName}_${baseId}`.replace(/[^a-zA-Z0-9-_]/g, '_');

  // Normalize price
  let price = { amount: 0, currency: 'USD' };
  if (apiProduct.price) {
    if (typeof apiProduct.price === 'object') {
      price.amount = parseFloat(apiProduct.price.amount || apiProduct.price.value || 0);
      price.currency = apiProduct.price.currency || 'USD';
      if (apiProduct.price.originalAmount) {
        price.originalAmount = parseFloat(apiProduct.price.originalAmount);
      }
    } else {
      price.amount = parseFloat(apiProduct.price);
    }
  }

  // Ensure minimum price
  if (price.amount <= 0) {
    price.amount = Math.floor(Math.random() * 500) + 10; // Random price between 10-510
  }

  // Normalize images
  let images = [];
  let thumbnail = '';
  if (apiProduct.images && Array.isArray(apiProduct.images)) {
    images = apiProduct.images.filter(img => img && typeof img === 'string');
  } else if (apiProduct.image) {
    images = [apiProduct.image];
  }

  if (!images.length) {
    // Generate static category-relevant placeholder images
    const category = normalizedCategory || 'general';
    const imageIndex = Math.floor(Math.random() * 10) + 1; // 1-10 for variety
    images = [`/images/${category}/${category.split('-')[0]}${imageIndex}.jpg`];
  }

  thumbnail = apiProduct.thumbnail || images[0];

  // Normalize category and subcategory
  const category = (apiProduct.category || 'general').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const subcategory = (apiProduct.subcategory || apiProduct.category || 'general').toLowerCase().replace(/[^a-z0-9-]/g, '-');

  // Map categories to match frontend expectations
  const categoryMapping = {
    'mens-shirts': 'mens-shirts',
    'mens-shoes': 'mens-shoes',
    'mens-watches': 'mens-watches',
    'womens-dresses': 'womens-fashion',
    'womens-bags': 'womens-fashion',
    'womens-jewellery': 'womens-fashion',
    'womens-shoes': 'womens-fashion',
    'womens-watches': 'womens-fashion',
    'beauty': 'beauty-skincare',
    'skin-care': 'beauty-skincare',
    'fragrances': 'beauty-skincare',
    'laptops': 'laptops',
    'smartphones': 'electronics',
    'mobile-accessories': 'electronics',
    'tablets': 'electronics',
    'sports-accessories': 'sports',
    'home-decoration': 'home-garden',
    'furniture': 'home-garden',
    'kitchen-accessories': 'home-garden',
    'groceries': 'home-garden'
  };

  const normalizedCategory = categoryMapping[category] || category;

  // Generate tags
  const tags = [];
  if (apiProduct.brand) tags.push(apiProduct.brand.toLowerCase());
  if (apiProduct.category) tags.push(apiProduct.category.toLowerCase());
  if (apiProduct.tags && Array.isArray(apiProduct.tags)) {
    tags.push(...apiProduct.tags.slice(0, 3));
  }

  return {
    id: uniqueId,
    title: apiProduct.title || apiProduct.name || `Product ${uniqueId}`,
    description: apiProduct.description || apiProduct.shortDescription || apiProduct.title || 'No description available',
    shortDescription: apiProduct.shortDescription || apiProduct.description?.substring(0, 100) || apiProduct.title,
    price,
    images,
    thumbnail,
    category: normalizedCategory,
    subcategory,
    rating: parseFloat(apiProduct.rating) || 4.0 + Math.random(),
    reviewCount: apiProduct.reviewCount || Math.floor(Math.random() * 1000),
    availability: {
      stock: apiProduct.availability?.stock || apiProduct.stock || Math.floor(Math.random() * 100) + 1,
      status: apiProduct.availability?.status || (apiProduct.stock > 0 ? 'in_stock' : 'in_stock')
    },
    brand: apiProduct.brand || '',
    tags: [...new Set(tags)], // Remove duplicates
    source: adapterName,
    isActive: true,
    specifications: apiProduct.specifications || {},
    metadata: apiProduct
  };
};

// Create dynamic categories from fetched products
const createCategoriesFromProducts = (products) => {
  const categoryMap = new Map();
  const subcategoryMap = new Map();

  products.forEach(product => {
    const catKey = product.category;
    const subKey = `${product.category}_${product.subcategory}`;

    if (!categoryMap.has(catKey)) {
      categoryMap.set(catKey, {
        id: catKey,
        name: catKey.charAt(0).toUpperCase() + catKey.slice(1).replace(/-/g, ' '),
        description: `${catKey.charAt(0).toUpperCase() + catKey.slice(1)} products`,
        image: `https://picsum.photos/800/600?random=${catKey}`,
        subcategories: [],
        source: product.source
      });
    }

    if (!subcategoryMap.has(subKey)) {
      subcategoryMap.set(subKey, {
        id: product.subcategory,
        name: product.subcategory.charAt(0).toUpperCase() + product.subcategory.slice(1).replace(/-/g, ' '),
        image: `https://picsum.photos/400/300?random=${subKey}`,
        description: `${product.subcategory.charAt(0).toUpperCase() + product.subcategory.slice(1)} products`
      });
    }
  });

  // Attach subcategories to categories
  categoryMap.forEach((category, catKey) => {
    const subs = Array.from(subcategoryMap.entries())
      .filter(([key]) => key.startsWith(`${catKey}_`))
      .map(([, sub]) => sub);
    category.subcategories = subs;
  });

  return Array.from(categoryMap.values());
};

// Fetch products from all adapters
const fetchProductsFromAdapters = async (adapters) => {
  const allProducts = [];
  const categories = CONFIG.CATEGORIES;

  console.log(`📥 Starting product fetch from ${adapters.length} adapters...`);

  for (const adapter of adapters) {
    console.log(`🔄 Fetching from ${adapter.name}...`);

    try {
      for (const category of categories) {
        if (allProducts.length >= CONFIG.TARGET_PRODUCT_COUNT) break;

        console.log(`  📂 Fetching ${category} from ${adapter.name}...`);

        try {
          let offset = 0;
          let fetched = 0;

          while (fetched < CONFIG.PRODUCTS_PER_CATEGORY && allProducts.length < CONFIG.TARGET_PRODUCT_COUNT) {
            const products = await adapter.getProductsByCategory(category, {
              limit: Math.min(50, CONFIG.PRODUCTS_PER_CATEGORY - fetched),
              offset
            });

            if (!products || products.length === 0) break;

            const normalized = products.map(p => normalizeProduct(p, adapter.name));
            allProducts.push(...normalized);

            fetched += products.length;
            offset += products.length;

            console.log(`    ✅ Fetched ${products.length} products (${allProducts.length} total)`);

            // Small delay to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.warn(`  ⚠️  Error fetching ${category} from ${adapter.name}:`, error.message);
        }
      }
    } catch (error) {
      console.warn(`❌ Error with ${adapter.name}:`, error.message);
    }
  }

  console.log(`📦 Total products fetched: ${allProducts.length}`);
  return allProducts;
};

// Deduplicate products based on title similarity and other factors
const deduplicateProducts = (products) => {
  const seen = new Set();
  const unique = [];

  for (const product of products) {
    // Create a signature for deduplication
    const signature = `${product.title.toLowerCase().trim()}_${product.brand || ''}_${product.price.amount}`.replace(/\s+/g, ' ');

    if (!seen.has(signature)) {
      seen.add(signature);
      unique.push(product);
    }
  }

  console.log(`🧹 Deduplicated: ${products.length} -> ${unique.length} products`);
  return unique;
};

// Generate flash sales and featured products
const enhanceProducts = (products) => {
  const flashSaleCount = Math.floor(products.length * CONFIG.FLASH_SALE_PERCENTAGE);
  const featuredCount = Math.floor(products.length * CONFIG.FEATURED_PERCENTAGE);

  // Shuffle array
  const shuffled = [...products].sort(() => Math.random() - 0.5);

  // Mark flash sales
  for (let i = 0; i < flashSaleCount; i++) {
    const product = shuffled[i];
    const discount = CONFIG.DISCOUNT_RANGES[Math.floor(Math.random() * CONFIG.DISCOUNT_RANGES.length)];
    const duration = Math.floor(Math.random() * 7) + 1; // 1-7 days

    product.isFlashSale = true;
    product.discountPercentage = discount;
    product.price.originalAmount = product.price.amount;
    product.price.amount = Math.round(product.price.amount * (1 - discount / 100));
    product.flashSaleEndTime = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
  }

  // Mark featured products (different from flash sales)
  const featuredStart = flashSaleCount;
  for (let i = featuredStart; i < featuredStart + featuredCount; i++) {
    if (shuffled[i]) {
      shuffled[i].isFeatured = true;
    }
  }

  console.log(`✨ Enhanced products: ${flashSaleCount} flash sales, ${featuredCount} featured`);
  return products;
};

// Batch insert products
const batchInsertProducts = async (products) => {
  const batches = [];
  for (let i = 0; i < products.length; i += CONFIG.BATCH_SIZE) {
    batches.push(products.slice(i, i + CONFIG.BATCH_SIZE));
  }

  let inserted = 0;
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      await Product.insertMany(batch, { ordered: false });
      inserted += batch.length;
      console.log(`📦 Inserted batch ${i + 1}/${batches.length} (${inserted}/${products.length} products)`);
    } catch (error) {
      console.warn(`⚠️  Error inserting batch ${i + 1}:`, error.message);
      // Continue with next batch
    }
  }

  return inserted;
};

// Simulate seeding for testing without MongoDB
const simulateSeeding = async () => {
  const simStartTime = Date.now();
  console.log('🔄 Simulating seeding process (no database connection)...');

  const adapters = initializeAdapters();
  console.log(`🔧 Initialized ${adapters.length} adapters: ${adapters.map(a => a.name).join(', ')}`);

  // Simulate fetching products
  const rawProducts = await fetchProductsFromAdapters(adapters);

  if (rawProducts.length === 0) {
    console.log('⚠️  No products fetched from any adapter');
    return;
  }

  // Simulate processing
  const deduplicatedProducts = deduplicateProducts(rawProducts);
  const enhancedProducts = enhanceProducts(deduplicatedProducts);
  const categories = createCategoriesFromProducts(enhancedProducts);

  const duration = ((Date.now() - simStartTime) / 1000).toFixed(2);
  console.log('✅ Seeding simulation completed successfully!');
  console.log(`   📊 Summary:`);
  console.log(`      - Duration: ${duration}s`);
  console.log(`      - ${categories.length} categories would be created`);
  console.log(`      - ${enhancedProducts.length} products would be inserted`);
  console.log(`      - ${enhancedProducts.filter(p => p.isFlashSale).length} flash sale items`);
  console.log(`      - ${enhancedProducts.filter(p => p.isFeatured).length} featured items`);
  console.log(`      - Sources: ${[...new Set(enhancedProducts.map(p => p.source))].join(', ')}`);

  console.log('\n📋 Sample products:');
  enhancedProducts.slice(0, 3).forEach((product, i) => {
    console.log(`   ${i + 1}. ${product.title} - $${product.price.amount} (${product.source})`);
  });

  return enhancedProducts;
};

// Main seeding function
const seedDatabase = async () => {
  const startTime = Date.now();

  try {
    console.log('🌱 Starting enhanced database seeding...');
    console.log(`🎯 Target: ${CONFIG.TARGET_PRODUCT_COUNT} products from ${CONFIG.CATEGORIES.length} categories`);

    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.error('❌ MongoDB not connected. Please ensure MongoDB is running and MONGODB_URI is set.');
      console.log('💡 For testing without MongoDB, the script will simulate the seeding process.');
      return await simulateSeeding();
    }

    // Initialize adapters
    const adapters = initializeAdapters();

    // Check existing data for incremental seeding
    const existingProducts = await Product.countDocuments();
    const existingCategories = await Category.countDocuments();

    console.log(`📊 Existing data: ${existingProducts} products, ${existingCategories} categories`);

    if (existingProducts > 0 && process.env.INCREMENTAL_SEED !== 'true') {
      console.log('🗑️  Clearing existing data (set INCREMENTAL_SEED=true to preserve)');
      await Product.deleteMany({});
      await Category.deleteMany({});
    }

    // Fetch products from adapters
    const rawProducts = await fetchProductsFromAdapters(adapters);

    if (rawProducts.length === 0) {
      throw new Error('No products fetched from any adapter');
    }

    // Deduplicate
    const deduplicatedProducts = deduplicateProducts(rawProducts);

    // Enhance with flash sales and featured items
    const enhancedProducts = enhanceProducts(deduplicatedProducts);

    // Create categories dynamically
    const categories = createCategoriesFromProducts(enhancedProducts);

    // Insert categories
    console.log(`📁 Inserting ${categories.length} categories...`);
    await Category.insertMany(categories, { ordered: false });
    console.log(`✅ Inserted ${categories.length} categories`);

    // Insert products in batches
    console.log(`📦 Inserting ${enhancedProducts.length} products...`);
    const insertedProducts = await batchInsertProducts(enhancedProducts);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('✅ Database seeding completed successfully!');
    console.log(`   📊 Summary:`);
    console.log(`      - Duration: ${duration}s`);
    console.log(`      - ${categories.length} categories`);
    console.log(`      - ${insertedProducts} products`);
    console.log(`      - ${enhancedProducts.filter(p => p.isFlashSale).length} flash sale items`);
    console.log(`      - ${enhancedProducts.filter(p => p.isFeatured).length} featured items`);
    console.log(`      - Sources: ${[...new Set(enhancedProducts.map(p => p.source))].join(', ')}`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    console.error(error.stack);
    process.exit(1);
  }
};

// Run seeder if called directly
if (require.main === module) {
  // Load environment variables
  require('dotenv').config();

  connectDB().then(() => {
    seedDatabase().then(() => {
      console.log('🎉 Seeding complete! Exiting...');
      process.exit(0);
    }).catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
  }).catch((error) => {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  });
}

module.exports = { seedDatabase, initializeAdapters, normalizeProduct };