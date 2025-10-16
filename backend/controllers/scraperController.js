const ScrapedProduct = require('../models/ScrapedProduct');
const Product = require('../models/Product');
const AuditLog = require('../models/AuditLog');

// Start scraping process
const startScraping = async (req, res) => {
  try {
    const { supplier, url, category } = req.body;
    const adminId = req.user.id;

    // For MVP, simulate scraping process
    // In real implementation, this would trigger actual scraping
    const mockProducts = [
      {
        externalId: `mock_${Date.now()}_1`,
        externalUrl: url,
        source: supplier,
        supplier,
        rawData: {
          title: 'Mock Product 1',
          description: 'Mock product description',
          price: { amount: 29.99, currency: 'USD' },
          images: ['https://example.com/image1.jpg'],
          category,
          stock: 100
        }
      },
      {
        externalId: `mock_${Date.now()}_2`,
        externalUrl: `${url}/2`,
        source: supplier,
        supplier,
        rawData: {
          title: 'Mock Product 2',
          description: 'Another mock product',
          price: { amount: 49.99, currency: 'USD' },
          images: ['https://example.com/image2.jpg'],
          category,
          stock: 50
        }
      }
    ];

    // Save scraped products
    const savedProducts = [];
    for (const productData of mockProducts) {
      const scrapedProduct = new ScrapedProduct(productData);
      await scrapedProduct.save();
      savedProducts.push(scrapedProduct);
    }

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'CREATE',
      resource: 'scraped_products',
      endpoint: '/api/scraper/start',
      statusCode: 200,
      metadata: { supplier, url, productsCount: savedProducts.length }
    });

    res.json({
      message: 'Scraping completed successfully',
      products: savedProducts
    });
  } catch (error) {
    console.error('Error starting scraping:', error);
    res.status(500).json({ message: 'Failed to start scraping' });
  }
};

// Get scraping status
const getScrapingStatus = async (req, res) => {
  try {
    const stats = await ScrapedProduct.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCounts = {};
    stats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });

    res.json({
      status: 'idle', // In real implementation, track active scraping jobs
      stats: {
        scraped: statusCounts.scraped || 0,
        processing: statusCounts.processing || 0,
        processed: statusCounts.processed || 0,
        imported: statusCounts.imported || 0,
        rejected: statusCounts.rejected || 0,
        duplicate: statusCounts.duplicate || 0
      }
    });
  } catch (error) {
    console.error('Error fetching scraping status:', error);
    res.status(500).json({ message: 'Failed to fetch scraping status' });
  }
};

// Get scraped products
const getScrapedProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, supplier } = req.query;
    const query = {};

    if (status) query.status = status;
    if (supplier) query.supplier = supplier;

    const products = await ScrapedProduct.find(query)
      .sort({ scrapedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ScrapedProduct.countDocuments(query);

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching scraped products:', error);
    res.status(500).json({ message: 'Failed to fetch scraped products' });
  }
};

// Import product
const importProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const scrapedProduct = await ScrapedProduct.findById(id);
    if (!scrapedProduct) {
      return res.status(404).json({ message: 'Scraped product not found' });
    }

    if (scrapedProduct.status !== 'processed') {
      return res.status(400).json({ message: 'Product must be processed before import' });
    }

    // Create product from scraped data
    const product = new Product({
      id: `imported_${Date.now()}`,
      title: scrapedProduct.processedData.title,
      description: scrapedProduct.processedData.description,
      shortDescription: scrapedProduct.processedData.shortDescription,
      price: scrapedProduct.processedData.price,
      images: scrapedProduct.processedData.images,
      thumbnail: scrapedProduct.processedData.thumbnail,
      category: scrapedProduct.processedData.category,
      subcategory: scrapedProduct.processedData.subcategory,
      availability: {
        stock: scrapedProduct.processedData.stock,
        status: scrapedProduct.processedData.stock > 0 ? 'in_stock' : 'out_of_stock'
      },
      source: 'scraped',
      isActive: false // Admin needs to review before activating
    });

    await product.save();
    await scrapedProduct.markImported(product._id, adminId);

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'CREATE',
      resource: 'product',
      resourceId: product._id,
      endpoint: `/api/scraper/products/${id}/import`,
      statusCode: 200,
      metadata: { scrapedProductId: id, source: 'scraper' }
    });

    res.json({
      message: 'Product imported successfully',
      product,
      scrapedProduct
    });
  } catch (error) {
    console.error('Error importing product:', error);
    res.status(500).json({ message: 'Failed to import product' });
  }
};

// Reject product
const rejectProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    const scrapedProduct = await ScrapedProduct.findById(id);
    if (!scrapedProduct) {
      return res.status(404).json({ message: 'Scraped product not found' });
    }

    await scrapedProduct.markRejected(reason);

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'UPDATE',
      resource: 'scraped_product',
      resourceId: id,
      endpoint: `/api/scraper/products/${id}/reject`,
      statusCode: 200,
      metadata: { rejectionReason: reason }
    });

    res.json({
      message: 'Product rejected successfully',
      scrapedProduct
    });
  } catch (error) {
    console.error('Error rejecting product:', error);
    res.status(500).json({ message: 'Failed to reject product' });
  }
};

// Get scraping stats
const getScrapingStats = async (req, res) => {
  try {
    const stats = await ScrapedProduct.aggregate([
      {
        $group: {
          _id: { supplier: '$supplier', status: '$status' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.supplier',
          stats: {
            $push: {
              status: '$_id.status',
              count: '$count'
            }
          },
          total: { $sum: '$count' }
        }
      }
    ]);

    res.json(stats);
  } catch (error) {
    console.error('Error fetching scraping stats:', error);
    res.status(500).json({ message: 'Failed to fetch scraping stats' });
  }
};

// Update scraper config
const updateScraperConfig = async (req, res) => {
  try {
    const { config } = req.body;
    const adminId = req.user.id;

    // In real implementation, save config to database
    // For MVP, just log the action

    await AuditLog.logAction({
      user: adminId,
      action: 'UPDATE',
      resource: 'scraper_config',
      endpoint: '/api/scraper/config',
      statusCode: 200,
      metadata: config
    });

    res.json({
      message: 'Scraper configuration updated successfully',
      config
    });
  } catch (error) {
    console.error('Error updating scraper config:', error);
    res.status(500).json({ message: 'Failed to update scraper configuration' });
  }
};

module.exports = {
  startScraping,
  getScrapingStatus,
  getScrapedProducts,
  importProduct,
  rejectProduct,
  getScrapingStats,
  updateScraperConfig
};