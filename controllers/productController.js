const Product = require('../models/Product');
const Category = require('../models/Category');
const mongoose = require('mongoose');

// API Keys
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'cf4abd27d6msh72c8d36efaaa9cap102f71jsn6f72a525c88f';
const FREEPIK_API_KEY = process.env.FREEPIK_API_KEY || 'FPSXd81b0ffd0153d89de3907f37860de28c';

// AliExpress API integration
const getAliExpressProductDetails = async (itemId) => {
  try {
    const response = await fetch(`https://aliexpress-datahub.p.rapidapi.com/item_detail_2?itemId=${itemId}`, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'aliexpress-datahub.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      throw new Error(`AliExpress API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('AliExpress API error:', error);
    return null;
  }
};

// Amazon API integration
const getAmazonProductDetails = async (asin) => {
  try {
    const response = await fetch(`https://real-time-amazon-data.p.rapidapi.com/product-details?asin=${asin}&country=US`, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'real-time-amazon-data.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      throw new Error(`Amazon API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Amazon API error:', error);
    return null;
  }
};

// Alibaba API integration
const getAlibabaProductDetails = async (query) => {
  try {
    const response = await fetch(`https://alibaba-api2.p.rapidapi.com/search/products?query=${encodeURIComponent(query)}&country=US`, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'alibaba-api2.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      throw new Error(`Alibaba API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Alibaba API error:', error);
    return null;
  }
};

// Import adapters for fallback
const PriorityResolver = require('../services/PriorityResolver');
const FakeStoreAdapter = require('../adapters/FakeStoreAdapter');
const BestBuyAdapter = require('../adapters/BestBuyAdapter');
const EbayAdapter = require('../adapters/EbayAdapter');
const EtsyAdapter = require('../adapters/EtsyAdapter');
const DummyJSONAdapter = require('../adapters/DummyJSONAdapter');
const AliExpressAdapter = require('../adapters/AliExpressAdapter');
const AmazonAdapter = require('../adapters/AmazonAdapter');
const RealTimeProductSearchAdapter = require('../adapters/RealTimeProductSearchAdapter');
const TaobaoAdapter = require('../adapters/TaobaoAdapter');

// Initialize adapters
const adapters = {
  fakestore: new FakeStoreAdapter(),
  bestbuy: process.env.BESTBUY_API_KEY ? new BestBuyAdapter() : null,
  ebay: process.env.EBAY_ACCESS_TOKEN ? new EbayAdapter() : null,
  etsy: process.env.ETSY_API_KEY ? new EtsyAdapter() : null,
  dummyjson: new DummyJSONAdapter(),
  aliexpress: process.env.RAPIDAPI_KEY ? new AliExpressAdapter() : null,
  amazon: process.env.RAPIDAPI_KEY ? new AmazonAdapter() : null,
  realtime: process.env.RAPIDAPI_KEY ? new RealTimeProductSearchAdapter() : null,
  taobao: process.env.RAPIDAPI_KEY ? new TaobaoAdapter() : null,
};

const priorityResolver = new PriorityResolver();

// Check if MongoDB is connected
const isMongoConnected = () => mongoose.connection.readyState === 1;

// Get all products with filtering and pagination
const getProducts = async (req, res) => {
  try {
    const {
      limit = 20,
      offset = 0,
      category,
      subcategory,
      minPrice,
      maxPrice,
      rating,
      brand,
      isFlashSale,
      isFeatured,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      q // search query
    } = req.query;

    // Try MongoDB first if connected
    if (isMongoConnected()) {
      // Check if products exist in DB, if not seed from local JSON file
      const productCount = await Product.countDocuments();
      if (productCount === 0) {
        console.log('📦 No products found in database, seeding from local products.json...');
        try {
          // Import the local products data
          const fs = require('fs');
          const path = require('path');
          const productsPath = path.join(__dirname, '../../global-market/src/data/products.json');

          if (fs.existsSync(productsPath)) {
            const productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
            const mapped = productsData.map(item => ({
              id: item.id,
              title: item.title,
              description: item.description,
              price: item.price,
              images: [item.thumbnail],
              thumbnail: item.thumbnail,
              rating: item.rating,
              category: item.category,
              source: item.source,
              availability: { stock: 50, status: 'in_stock' },
              brand: '',
              isActive: item.isActive,
              isFeatured: Math.random() > 0.8,
              specifications: {},
              metadata: item
            }));
            await Product.insertMany(mapped);
            console.log(`📦 Seeded ${mapped.length} products from local data`);
          } else {
            console.log('⚠️  Local products.json not found, falling back to external APIs...');
            // Fallback to external APIs if local file doesn't exist
            const fallback = await adapters.dummyjson.getProductsByCategory('general', { limit: 100 });
            const mapped = fallback.map(item => ({
              id: `dummyjson_${item.id}`,
              title: item.title,
              description: item.description,
              price: {
                amount: item.price.amount,
                currency: item.price.currency
              },
              images: item.images,
              thumbnail: item.thumbnail,
              rating: item.rating,
              category: item.category,
              source: item.source,
              availability: item.availability,
              brand: item.brand,
              isActive: true,
              isFeatured: Math.random() > 0.8,
              specifications: item.specifications,
              metadata: item.metadata
            }));
            await Product.insertMany(mapped);
            console.log(`🌍 Seeded ${mapped.length} products from DummyJSON`);
          }
        } catch (seedError) {
          console.error('Failed to seed products:', seedError);
        }
      }

      // Build query
      let query = { isActive: true };

      if (category) query.category = category;
      if (subcategory) query.subcategory = subcategory;
      if (brand) query.brand = brand;
      if (isFlashSale === 'true') query.isFlashSale = true;
      if (isFeatured === 'true') query.isFeatured = true;
      if (minPrice || maxPrice) {
        query['price.amount'] = {};
        if (minPrice) query['price.amount'].$gte = parseFloat(minPrice);
        if (maxPrice) query['price.amount'].$lte = parseFloat(maxPrice);
      }
      if (rating) query.rating = { $gte: parseFloat(rating) };

      // Search functionality - use text index for better performance
      if (q) {
        query.$text = { $search: q };
        // Add text score to sorting if no specific sort is requested
        if (sortBy === 'createdAt') {
          sortOptions.score = { $meta: 'textScore' };
        }
      }

      // Sorting
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const products = await Product.find(query)
        .sort(sortOptions)
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .populate('category', 'name')
        .lean();

      const total = await Product.countDocuments(query);

      return res.json({
        products,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + parseInt(limit)) < total
        }
      });
    }

    // Fallback to adapter system if MongoDB not connected
    console.log('Using adapter system for products (MongoDB not connected)');

    let products = [];

    // Enhanced priority order with Alibaba integration
    const priorityAdapters = [
      { name: 'realtime', adapter: adapters.realtime },
      { name: 'taobao', adapter: adapters.taobao },
      { name: 'alibaba', adapter: { getProductsByCategory: getAlibabaProductDetails } },
      { name: 'bestbuy', adapter: adapters.bestbuy },
      { name: 'dummyjson', adapter: adapters.dummyjson },
      { name: 'fakestore', adapter: adapters.fakestore }
    ];

    for (const { name, adapter } of priorityAdapters) {
      if (!adapter) continue;

      try {
        if (q) {
          // Search query
          products = await adapter.searchProducts(q, { limit: parseInt(limit), offset: parseInt(offset) });
        } else if (category) {
          // Category filter
          products = await adapter.getProductsByCategory(category, { limit: parseInt(limit), offset: parseInt(offset) });
        } else {
          // General products
          products = await adapter.getProductsByCategory('general', { limit: parseInt(limit), offset: parseInt(offset) });
        }

        if (products && products.length > 0) {
          console.log(`Successfully fetched ${products.length} products from ${name}`);
          break; // Use the first successful adapter
        }
      } catch (error) {
        console.warn(`${name} adapter failed:`, error.message);
        continue; // Try next adapter
      }
    }

    res.json({
      products,
      pagination: {
        total: products.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: false // Adapter system doesn't support proper pagination
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
};

// Get single product by ID
const getProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Try MongoDB first if connected
    if (isMongoConnected()) {
      const product = await Product.findOne({ id, isActive: true })
        .populate('category', 'name description')
        .lean();

      if (product) {
        return res.json(product);
      }
    }

    // Enhanced fallback system with multiple APIs
    console.log('Product not found in database, trying enhanced API system for:', id);

    // Try AliExpress if ID looks like AliExpress item ID
    if (id.includes('aliexpress') || /^\d{10,}$/.test(id)) {
      try {
        const aliexpressData = await getAliExpressProductDetails(id);
        if (aliexpressData && aliexpressData.result) {
          const product = {
            id: `aliexpress_${id}`,
            title: aliexpressData.result.title || 'AliExpress Product',
            description: aliexpressData.result.description || 'Product from AliExpress',
            price: {
              amount: parseFloat(aliexpressData.result.price?.salePrice) || 0,
              currency: aliexpressData.result.price?.currency || 'USD'
            },
            images: aliexpressData.result.images || [],
            thumbnail: aliexpressData.result.images?.[0] || '',
            rating: aliexpressData.result.rating || 4.0,
            category: aliexpressData.result.category || 'general',
            source: 'aliexpress',
            availability: { stock: 10, status: 'in_stock' },
            brand: aliexpressData.result.brand || '',
            specifications: aliexpressData.result.specifications || {},
            // Add detailed product information
            details: {
              seller: aliexpressData.result.seller || {},
              shipping: aliexpressData.result.shipping || {},
              reviews: aliexpressData.result.reviews || [],
              variants: aliexpressData.result.variants || [],
              attributes: aliexpressData.result.attributes || {}
            }
          };
          return res.json(product);
        }
      } catch (error) {
        console.warn('AliExpress API failed:', error.message);
      }
    }

    // Try Amazon if ID looks like ASIN
    if (id.includes('amazon') || /^[A-Z0-9]{10}$/.test(id)) {
      try {
        const amazonData = await getAmazonProductDetails(id);
        if (amazonData && amazonData.data) {
          const product = {
            id: `amazon_${id}`,
            title: amazonData.data.product_title || 'Amazon Product',
            description: amazonData.data.product_description || 'Product from Amazon',
            price: {
              amount: parseFloat(amazonData.data.product_price?.replace('$', '')) || 0,
              currency: 'USD'
            },
            images: amazonData.data.product_photos || [],
            thumbnail: amazonData.data.product_photo || '',
            rating: parseFloat(amazonData.data.product_star_rating) || 4.0,
            category: amazonData.data.product_category || 'general',
            source: 'amazon',
            availability: { stock: 10, status: 'in_stock' },
            brand: amazonData.data.product_brand || '',
            specifications: amazonData.data.product_details || {},
            // Add detailed product information
            details: {
              asin: amazonData.data.product_asin,
              url: amazonData.data.product_url,
              reviews: amazonData.data.product_reviews || [],
              features: amazonData.data.product_features || [],
              dimensions: amazonData.data.product_dimensions || {},
              weight: amazonData.data.product_weight || ''
            }
          };
          return res.json(product);
        }
      } catch (error) {
        console.warn('Amazon API failed:', error.message);
      }
    }

    // FIRST: Try local products.json data (highest priority)
    try {
      const fs = require('fs');
      const path = require('path');
      const productsPath = path.join(__dirname, '../../global-market/src/data/products.json');
      console.log('🔍 Attempting to load products from:', productsPath);

      // Check if file exists first
      if (!fs.existsSync(productsPath)) {
        console.error('❌ Products file does not exist at path:', productsPath);
        throw new Error('Products file not found');
      }

      const fileContent = fs.readFileSync(productsPath, 'utf8');
      const localProducts = JSON.parse(fileContent);
      console.log('✅ Successfully loaded products.json with', localProducts.length, 'products');

      const foundProduct = localProducts.find(p => p.id === id);
      if (foundProduct) {
        console.log('✅ Found product in local products.json:', id, '- Title:', foundProduct.title, '- Price:', foundProduct.price.amount, foundProduct.price.currency);

        // Enhance product with additional images and details
        const enhancedProduct = {
          ...foundProduct,
          images: foundProduct.images || [foundProduct.thumbnail],
          // Add more images for better gallery experience
          gallery: [
            foundProduct.thumbnail,
            `https://source.unsplash.com/random/600x600/?${encodeURIComponent(foundProduct.title)},product,${foundProduct.category}`,
            `https://source.unsplash.com/random/601x601/?${encodeURIComponent(foundProduct.title)},item,${foundProduct.category}`,
            `https://source.unsplash.com/random/602x602/?${encodeURIComponent(foundProduct.title)},detail,${foundProduct.category}`
          ].filter(Boolean),
          // Add detailed specifications
          specifications: foundProduct.specifications || {
            'Brand': foundProduct.brand || 'Premium Brand',
            'Category': foundProduct.category || 'General',
            'Rating': foundProduct.rating || '4.5',
            'Source': foundProduct.source || 'Local'
          },
          // Add detailed product information
          details: {
            description: foundProduct.description,
            features: [
              'High-quality materials',
              'Premium craftsmanship',
              'Durable construction',
              'Satisfaction guaranteed'
            ],
            shipping: {
              freeShipping: true,
              estimatedDelivery: '3-5 business days',
              returnPolicy: '30-day returns'
            },
            warranty: '2-year limited warranty'
          }
        };

        return res.json(enhancedProduct);
      } else {
        console.log('❌ Product not found in local products.json:', id, '- Available IDs sample:', localProducts.slice(0, 10).map(p => p.id));
      }
    } catch (error) {
      console.error('❌ Local products.json failed to load:', error.message);
      console.error('Full error:', error);
    }

    // Try DummyJSON adapter as fallback
    try {
      const dummyAdapter = new DummyJSONAdapter();
      const product = await dummyAdapter.getProductDetails(id);
      return res.json(product);
    } catch (error) {
      console.warn('DummyJSON adapter failed for product details:', error.message);
    }

    // If DummyJSON fails, try other adapters via priority resolver
    try {
      const selectedAdapter = await priorityResolver.resolveAPI(adapters, { productId: id });
      const product = await selectedAdapter.getProductDetails(id);
      return res.json(product);
    } catch (adapterError) {
      console.warn('All adapters failed for product details:', adapterError.message);
    }

    return res.status(404).json({ message: 'Product not found' });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Failed to fetch product' });
  }
};

// Get featured products
const getFeaturedProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const products = await Product.find({
      isActive: true,
      isFeatured: true
    })
      .sort({ rating: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json(products);
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({ message: 'Failed to fetch featured products' });
  }
};

// Get flash sale products
const getFlashSaleProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const products = await Product.find({
      isActive: true,
      isFlashSale: true,
      flashSaleEndTime: { $gt: new Date() }
    })
      .sort({ discountPercentage: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json(products);
  } catch (error) {
    console.error('Error fetching flash sale products:', error);
    res.status(500).json({ message: 'Failed to fetch flash sale products' });
  }
};

// Create new product (Admin only)
const createProduct = async (req, res) => {
  try {
    const productData = req.body;

    // Validate category exists
    if (productData.category) {
      const category = await Category.findOne({ id: productData.category });
      if (!category) {
        return res.status(400).json({ message: 'Invalid category' });
      }
    }

    // Generate unique ID if not provided
    if (!productData.id) {
      productData.id = `${productData.category}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Check if product ID already exists
    const existingProduct = await Product.findOne({ id: productData.id });
    if (existingProduct) {
      return res.status(409).json({ message: 'Product ID already exists' });
    }

    const product = new Product(productData);
    await product.save();

    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create product' });
  }
};

// Update product (Admin only)
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate category if being updated
    if (updateData.category) {
      const category = await Category.findOne({ id: updateData.category });
      if (!category) {
        return res.status(400).json({ message: 'Invalid category' });
      }
    }

    const product = await Product.findOneAndUpdate(
      { id },
      updateData,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to update product' });
  }
};

// Delete product (Admin only)
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findOneAndUpdate(
      { id },
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Failed to delete product' });
  }
};

// Get product statistics (Admin only)
const getProductStats = async (req, res) => {
  try {
    const stats = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalValue: { $sum: '$price.amount' },
          averagePrice: { $avg: '$price.amount' },
          averageRating: { $avg: '$rating' },
          flashSaleCount: { $sum: { $cond: ['$isFlashSale', 1, 0] } },
          featuredCount: { $sum: { $cond: ['$isFeatured', 1, 0] } }
        }
      }
    ]);

    const categoryStats = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          averagePrice: { $avg: '$price.amount' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      overview: stats[0] || {},
      byCategory: categoryStats
    });
  } catch (error) {
    console.error('Error fetching product stats:', error);
    res.status(500).json({ message: 'Failed to fetch product statistics' });
  }
};

module.exports = {
  getProducts,
  getProduct,
  getFeaturedProducts,
  getFlashSaleProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStats
};