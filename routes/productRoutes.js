const express = require('express');
const {
  getProducts,
  getProduct,
  getFeaturedProducts,
  getFlashSaleProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStats
} = require('../controllers/productController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/flash-sales', getFlashSaleProducts);
router.get('/:id', getProduct);

// Admin routes (require authentication)
router.post('/', authenticateToken, createProduct);
router.put('/:id', authenticateToken, updateProduct);
router.delete('/:id', authenticateToken, deleteProduct);
router.get('/admin/stats', authenticateToken, getProductStats);

module.exports = router;