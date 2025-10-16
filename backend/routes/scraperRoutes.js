const express = require('express');
const {
  startScraping,
  getScrapingStatus,
  getScrapedProducts,
  importProduct,
  rejectProduct,
  getScrapingStats,
  updateScraperConfig
} = require('../controllers/scraperController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All scraper routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole(['admin', 'super_admin']));

// Scraping operations
router.post('/start', startScraping);
router.get('/status', getScrapingStatus);
router.get('/products', getScrapedProducts);
router.post('/products/:id/import', importProduct);
router.post('/products/:id/reject', rejectProduct);
router.get('/stats', getScrapingStats);
router.put('/config', updateScraperConfig);

module.exports = router;