const express = require('express');
const {
  createVendor,
  getVendorProfile,
  updateVendorProfile,
  getVendors,
  approveVendor,
  rejectVendor,
  getVendorProducts,
  getVendorEarnings,
  processVendorPayout
} = require('../controllers/vendorController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Vendor application and management
router.post('/apply', authenticateToken, createVendor);
router.get('/profile', authenticateToken, getVendorProfile);
router.put('/profile', authenticateToken, updateVendorProfile);

// Admin vendor management
router.get('/', authenticateToken, requireRole(['admin', 'super_admin']), getVendors);
router.put('/:id/approve', authenticateToken, requireRole(['admin', 'super_admin']), approveVendor);
router.put('/:id/reject', authenticateToken, requireRole(['admin', 'super_admin']), rejectVendor);

// Vendor products and earnings
router.get('/:id/products', authenticateToken, getVendorProducts);
router.get('/:id/earnings', authenticateToken, getVendorEarnings);
router.post('/:id/payout', authenticateToken, requireRole(['admin', 'super_admin', 'finance_admin']), processVendorPayout);

module.exports = router;