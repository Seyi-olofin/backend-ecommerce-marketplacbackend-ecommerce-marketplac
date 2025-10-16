const Cart = require('../models/Cart');
const Product = require('../models/Product');

// Get user's cart
const getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = await Cart.findByUserId(userId).populate('items.product', 'title images price availability');

    if (!cart) {
      // Return empty cart if none exists
      return res.json({
        items: [],
        totalItems: 0,
        totalAmount: { amount: 0, currency: 'USD' }
      });
    }

    res.json(cart);
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ message: 'Failed to fetch cart' });
  }
};

// Add item to cart
const addItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity = 1 } = req.body;

    // Validate input
    if (!productId || quantity < 1) {
      return res.status(400).json({
        message: 'Product ID and valid quantity are required'
      });
    }

    // Find product
    const product = await Product.findOne({ id: productId, isActive: true });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check stock availability
    if (product.availability.stock < quantity) {
      return res.status(400).json({
        message: `Only ${product.availability.stock} items available in stock`
      });
    }

    // Find or create cart
    let cart = await Cart.findByUserId(userId);
    if (!cart) {
      // Get user ObjectId for reference
      const User = require('../models/User');
      const user = await User.findById(userId);
      cart = new Cart({
        user: user._id,
        userId: userId,
        items: []
      });
    }

    // Add item to cart
    cart.addItem(product, quantity);
    await cart.save();

    // Populate product details
    await cart.populate('items.product', 'title images price availability');

    res.json(cart);
  } catch (error) {
    console.error('Error adding item to cart:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to add item to cart' });
  }
};

// Update item quantity in cart
const updateItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { quantity } = req.body;
    const productId = id;

    // Validate input
    if (!productId || quantity < 0) {
      return res.status(400).json({
        message: 'Product ID and valid quantity are required'
      });
    }

    // Find cart
    const cart = await Cart.findByUserId(userId);
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    // If quantity is 0, remove the item
    if (quantity === 0) {
      const removed = cart.removeItem(productId);
      if (!removed) {
        return res.status(404).json({ message: 'Item not found in cart' });
      }
    } else {
      // Check product availability
      const product = await Product.findOne({ id: productId, isActive: true });
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      if (product.availability.stock < quantity) {
        return res.status(400).json({
          message: `Only ${product.availability.stock} items available in stock`
        });
      }

      const updated = cart.updateItemQuantity(productId, quantity);
      if (!updated) {
        return res.status(404).json({ message: 'Item not found in cart' });
      }
    }

    await cart.save();
    await cart.populate('items.product', 'title images price availability');

    res.json(cart);
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({ message: 'Failed to update cart item' });
  }
};

// Remove item from cart
const removeItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const productId = id;

    // Find cart
    const cart = await Cart.findByUserId(userId);
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    // Remove item
    const removed = cart.removeItem(productId);
    if (!removed) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    await cart.save();
    await cart.populate('items.product', 'title images price availability');

    res.json(cart);
  } catch (error) {
    console.error('Error removing cart item:', error);
    res.status(500).json({ message: 'Failed to remove cart item' });
  }
};

// Clear cart
const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find cart
    const cart = await Cart.findByUserId(userId);
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    // Clear cart
    cart.clearCart();
    await cart.save();

    res.json({
      message: 'Cart cleared successfully',
      cart: {
        items: [],
        totalItems: 0,
        totalAmount: { amount: 0, currency: 'USD' }
      }
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ message: 'Failed to clear cart' });
  }
};

module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart
};