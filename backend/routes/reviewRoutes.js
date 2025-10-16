const express = require('express');
const {
  createReview,
  getProductReviews,
  getUserReviews,
  updateReview,
  deleteReview,
  approveReview,
  rejectReview,
  markHelpful,
  reportReview
} = require('../controllers/reviewController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/product/:productId', getProductReviews);

// User review management
router.post('/', authenticateToken, createReview);
router.get('/user', authenticateToken, getUserReviews);
router.put('/:id', authenticateToken, updateReview);
router.delete('/:id', authenticateToken, deleteReview);
router.post('/:id/helpful', authenticateToken, markHelpful);
router.post('/:id/report', authenticateToken, reportReview);

// Admin review moderation
router.put('/:id/approve', authenticateToken, requireRole(['admin', 'super_admin', 'support_admin']), approveReview);
router.put('/:id/reject', authenticateToken, requireRole(['admin', 'super_admin', 'support_admin']), rejectReview);

module.exports = router;