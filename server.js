const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const { rateLimiters } = require('./middleware/rateLimiter');
require('dotenv').config();
const path = require('path'); // <-- added

// Import adapters and services - Make optional to prevent deployment failures
let PriorityResolver, APICache, RedisCache, RealTimeProductSearchAdapter, TaobaoAPIAdapter, BestBuyAdapter, DummyJSONAdapter;

try {
  PriorityResolver = require('./services/PriorityResolver');
  APICache = require('./services/APICache');
  RedisCache = require('./services/RedisCache');
  RealTimeProductSearchAdapter = require('./adapters/RealTimeProductSearchAdapter');
  TaobaoAPIAdapter = require('./adapters/TaobaoAPIAdapter');
  BestBuyAdapter = require('./adapters/BestBuyAdapter');
  DummyJSONAdapter = require('./adapters/DummyJSONAdapter');
} catch (error) {
  console.warn('Some optional services/adapters failed to load:', error.message);
  // Set defaults
  PriorityResolver = null;
  APICache = null;
  RedisCache = null;
  RealTimeProductSearchAdapter = null;
  TaobaoAPIAdapter = null;
  BestBuyAdapter = null;
  DummyJSONAdapter = null;
}

// Import routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const userRoutes = require('./routes/userRoutes');
const translationRoutes = require('./routes/translationRoutes');

// Import payment and notification routes
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB - optional
connectDB().catch((error) => {
  console.warn('MongoDB connection failed, continuing without database:', error.message);
});

// Auto-seed data if collections are empty (after connection is established)
setTimeout(async () => {
  try {
    const { seedDatabase } = require('./utils/seedUtils');
    await seedDatabase();
  } catch (error) {
    console.error('❌ Auto-seeding failed:', error.message);
  }
}, 2000); // Wait 2 seconds for connection to establish

// Initialize Redis cache - optional
if (RedisCache && RedisCache.connect) {
  try {
    RedisCache.connect();
  } catch (error) {
    console.warn('Redis connection failed:', error.message);
  }
}

// Middleware
app.use(helmet());
// Use permissive CORS in development so frontend can fetch without issues
// In production set FRONTEND_URL and restrict origins
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true
}));
app.options('*', cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(cookieParser());

// Serve static files (images) from backend/public/images
// Put category images in: backend/public/images/<file>
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// Intelligent rate limiting
app.use('/api/auth', rateLimiters.auth);
app.use('/api/products', rateLimiters.products);
app.use('/api/categories', rateLimiters.products);
app.use('/api/search', rateLimiters.search);
app.use('/api/admin', rateLimiters.admin);
app.use('/api/', rateLimiters.general);

// Initialize adapters - Make optional to prevent deployment failures
const adapters = {};

if (DummyJSONAdapter) {
  try {
    adapters.dummyjson = new DummyJSONAdapter();
  } catch (error) {
    console.warn('DummyJSONAdapter failed to initialize:', error.message);
  }
}

// Initialize priority resolver - optional
let priorityResolver = null;
if (PriorityResolver) {
  try {
    priorityResolver = new PriorityResolver();
  } catch (error) {
    console.warn('PriorityResolver failed to initialize:', error.message);
  }
}

// API Cache service - optional
let apiCache = null;
if (APICache) {
  try {
    apiCache = APICache; // APICache is likely a class, not a constructor
  } catch (error) {
    console.warn('APICache failed to initialize:', error.message);
  }
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', translationRoutes);

// API Routes

// Get all products - Enhanced with local data priority
app.get('/api/products', async (req, res) => {
  try {
    const { limit = 20, offset = 0, q, category } = req.query;
    const cacheKey = `products_${limit}_${offset}_${q || ''}_${category || ''}`;

    let products = apiCache ? await apiCache.get('products', { limit, offset, q, category }) : null;

    if (!products) {
      try {
        // FIRST: Try local products.json (highest priority) - ALWAYS TRY THIS FIRST
        try {
          const fs = require('fs');
          const path = require('path');
          const productsPath = path.join(__dirname, '../global-market/src/data/products.json');
          console.log('🔍 Loading products from:', productsPath);

          // Check if file exists first
          if (!fs.existsSync(productsPath)) {
            console.error('❌ Products file does not exist at path:', productsPath);
            throw new Error('Products file not found');
          }

          const fileContent = fs.readFileSync(productsPath, 'utf8');
          const localProducts = JSON.parse(fileContent);
          console.log(`✅ Found local products.json with ${localProducts.length} products`);

          if (category) {
            // Filter by category
            const categoryProducts = localProducts.filter(p => p.category === category);
            products = categoryProducts.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
            console.log(`✅ Using local products.json for category: ${category}, found ${categoryProducts.length} products, returning ${products.length}`);
          } else if (q) {
            // Search functionality
            const searchResults = localProducts.filter(p =>
              p.title.toLowerCase().includes(q.toLowerCase()) ||
              p.description.toLowerCase().includes(q.toLowerCase())
            );
            products = searchResults.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
            console.log(`✅ Using local products.json for search: "${q}", found ${searchResults.length} results, returning ${products.length}`);
          } else {
            // General products
            products = localProducts.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
            console.log(`✅ Using local products.json for general products, returning ${products.length} of ${localProducts.length} total`);
          }
        } catch (error) {
          console.error('❌ Local products.json failed to load:', error.message);
          console.error('Full error:', error);
        }

        // SECOND: Try MongoDB if connected and no local data found
        if (!products) {
          try {
            const mongoose = require('mongoose');
            if (mongoose.connection.readyState === 1) {
              const Product = require('./models/Product');
              let query = { isActive: true };

              if (category) {
                query.category = category;
              }

              if (q) {
                query.title = { $regex: q, $options: 'i' };
              }

              const dbProducts = await Product.find(query)
                .limit(parseInt(limit))
                .skip(parseInt(offset))
                .sort({ createdAt: -1 });

              if (dbProducts && dbProducts.length > 0) {
                products = dbProducts.map(p => p.toObject());
                console.log('✅ Using MongoDB products');
              }
            }
          } catch (error) {
            console.warn('MongoDB query failed:', error.message);
          }
        }

        // THIRD: Fallback to DummyJSON API
        if (!products) {
          if (q) {
            products = await adapters.dummyjson.searchProducts(q, { limit: parseInt(limit), offset: parseInt(offset) });
            console.log('✅ Using DummyJSON for search');
          } else if (category) {
            try {
              products = await adapters.dummyjson.getProductsByCategory(category, { limit: parseInt(limit), offset: parseInt(offset) });
              console.log(`✅ Using DummyJSON for category: ${category}`);
            } catch (error) {
              console.warn('DummyJSON category failed:', error.message);
            }
          } else {
            products = await adapters.dummyjson.getProductsByCategory('general', { limit: parseInt(limit), offset: parseInt(offset) });
            console.log('✅ Using DummyJSON for general products');
          }
        }

        // FOURTH: Final fallback to fallback-products.json
        if (!products) {
          console.warn('All data sources failed, using fallback-products.json');
          const fallbackData = require('../global-market/src/data/fallback-products.json');
          if (category && fallbackData.products[category]) {
            products = fallbackData.products[category].slice(parseInt(offset), parseInt(offset) + parseInt(limit));
          } else {
            const allProducts = Object.values(fallbackData.products).flat();
            products = allProducts.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
          }
        }

        if (apiCache) await apiCache.set('products', { limit, offset, q, category }, products);
      } catch (error) {
        console.error('All product sources failed:', error);
        // Emergency fallback
        products = [];
      }
    }

    // Ensure we return an object with products array for consistency
    if (Array.isArray(products)) {
      res.json({ products, total: products.length });
    } else {
      res.json(products);
    }
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});

// Get featured products - Simplified to DummyJSON + Fallback
app.get('/api/products/featured', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const featuredProducts = apiCache ? await apiCache.get('featured_products', { limit }) : null;

    if (featuredProducts) {
      return res.json(featuredProducts);
    }

    let allFeatured = [];

    // Try DummyJSON first
    try {
      const featured = await adapters.dummyjson.getProductsByCategory('general', { limit: parseInt(limit) });
      allFeatured.push(...featured);
    } catch (error) {
      console.warn('DummyJSON failed for featured products, using fallback:', error.message);
    }

    // If DummyJSON fails or returns empty, use fallback JSON
    if (allFeatured.length === 0) {
      const fallbackData = require('../global-market/src/data/fallback-products.json');
      const allProducts = Object.values(fallbackData.products).flat();
      allFeatured = allProducts.slice(0, parseInt(limit));
    }

    if (apiCache) await apiCache.set('featured_products', { limit }, allFeatured);

    res.json(allFeatured);
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({ error: 'Failed to fetch featured products' });
  }
});

// Get single product by ID - Enhanced with local data priority
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = apiCache ? await apiCache.get('product', { id }) : null;

    if (product) {
      return res.json(product);
    }

    // FIRST: Try local products.json data (highest priority)
    try {
      const fs = require('fs');
      const path = require('path');
      const productsPath = path.join(__dirname, '../global-market/src/data/products.json');
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
        if (apiCache) await apiCache.set('product', { id }, foundProduct);
        return res.json(foundProduct);
      } else {
        console.log('❌ Product not found in local products.json:', id, '- Available IDs sample:', localProducts.slice(0, 10).map(p => p.id));
      }
    } catch (error) {
      console.error('❌ Local products.json failed to load:', error.message);
      console.error('Full error:', error);
      console.error('__dirname:', __dirname);
    }

    // SECOND: Try MongoDB if connected
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState === 1) {
        const Product = require('./models/Product');
        const dbProduct = await Product.findOne({ id, isActive: true });
        if (dbProduct) {
          console.log('✅ Found product in MongoDB:', id);
          const productData = dbProduct.toObject();
          if (apiCache) await apiCache.set('product', { id }, productData);
          return res.json(productData);
        }
      }
    } catch (error) {
      console.warn('MongoDB lookup failed:', error.message);
    }

    // THIRD: Try DummyJSON API
    const [source, productId] = id.includes('_') ? id.split('_', 2) : ['unknown', id];
    if (adapters.dummyjson) {
      try {
        const foundProduct = await adapters.dummyjson.getProductDetails(productId);
        if (foundProduct) {
          console.log('✅ Found product via DummyJSON API:', id);
          if (apiCache) await apiCache.set('product', { id }, foundProduct);
          return res.json(foundProduct);
        }
      } catch (error) {
        console.warn('DummyJSON failed for product details:', error.message);
      }
    }

    // FOURTH: Fallback to fallback-products.json
    try {
      const fallbackData = require('../global-market/src/data/fallback-products.json');
      const allProducts = Object.values(fallbackData.products).flat();
      const foundProduct = allProducts.find(p => p.id === id);
      if (foundProduct) {
        console.log('✅ Found product in fallback-products.json:', id);
        if (apiCache) await apiCache.set('product', { id }, foundProduct);
        return res.json(foundProduct);
      }
    } catch (error) {
      console.warn('Fallback JSON failed:', error.message);
    }

    console.log('❌ Product not found:', id);
    res.status(404).json({ error: 'Product not found' });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Function to find an available port
const findAvailablePort = (startPort) => {
  return new Promise((resolve, reject) => {
    const server = require('net').createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      // Port is busy, try next port
      findAvailablePort(startPort + 1).then(resolve).catch(reject);
    });
  });
};

// Start server with port conflict handling
const startServer = async (port) => {
  try {
    const availablePort = await findAvailablePort(parseInt(port));
    app.listen(availablePort, () => {
      console.log(`🚀 Server running on port ${availablePort}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('Configured API Adapters:');

      Object.entries(adapters).forEach(([name, adapter]) => {
        const status = adapter ? '✅ Configured' : '❌ Not configured';
        console.log(`  ${name}: ${status}`);
      });

      console.log('\nFallback JSON: ✅ Active');
      console.log('Rate Limiting: ✅ Active');
      console.log('Caching: ✅ Active');

      if (availablePort !== parseInt(port)) {
        console.log(`\n⚠️  Original port ${port} was busy, using port ${availablePort} instead.`);
        console.log(`💡 Update your frontend API_BASE to: http://localhost:${availablePort}/api`);
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer(PORT);

module.exports = app;