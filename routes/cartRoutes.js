const express = require('express');
const {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart
} = require('../controllers/cartController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All cart routes require authentication
router.use(authenticateToken);

// GET /api/cart - Get user's cart
router.get('/', getCart);

// POST /api/cart - Add item to cart (legacy support)
router.post('/', addItem);

// PUT /api/cart/items/:id - Update item quantity in cart
router.put('/items/:id', updateItem);

// DELETE /api/cart/items/:id - Remove item from cart
router.delete('/items/:id', removeItem);

// DELETE /api/cart - Clear entire cart
router.delete('/', clearCart);

module.exports = router;