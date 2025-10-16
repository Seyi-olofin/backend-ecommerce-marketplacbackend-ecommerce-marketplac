const express = require('express');
const {
  getUserOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  cancelOrder
} = require('../controllers/orderController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All order routes require authentication
router.use(authenticateToken);

// GET /api/orders - Get user's orders
router.get('/', getUserOrders);

// GET /api/orders/:id - Get single order
router.get('/:id', getOrder);

// POST /api/orders - Create new order
router.post('/', createOrder);

// PUT /api/orders/:id/status - Update order status (Admin only - in real app, add admin middleware)
router.put('/:id/status', updateOrderStatus);

// PUT /api/orders/:id/cancel - Cancel order
router.put('/:id/cancel', cancelOrder);

module.exports = router;