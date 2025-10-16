const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

// Get user's orders
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0, status } = req.query;

    let query = { userId };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .populate('items.product', 'title images');

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
};

// Get single order by ID
const getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({ _id: id, userId })
      .populate('items.product', 'title images price')
      .populate('user', 'firstName lastName email');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ message: 'Failed to fetch order' });
  }
};

// Create order from cart
const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      shippingAddress,
      billingAddress,
      paymentMethod,
      shippingMethod,
      notes
    } = req.body;

    // Validate required fields
    if (!shippingAddress || !paymentMethod) {
      return res.status(400).json({
        message: 'Shipping address and payment method are required'
      });
    }

    // Get user's cart
    const cart = await Cart.findByUserId(userId).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Validate products availability and calculate totals
    const orderItems = [];
    let subtotal = 0;

    for (const cartItem of cart.items) {
      const product = cartItem.product;

      if (!product || !product.isActive) {
        return res.status(400).json({
          message: `Product ${cartItem.title} is no longer available`
        });
      }

      if (product.availability.stock < cartItem.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${cartItem.title}. Available: ${product.availability.stock}`
        });
      }

      const itemTotal = product.price.amount * cartItem.quantity;
      subtotal += itemTotal;

      orderItems.push({
        product: product._id,
        productId: cartItem.productId,
        title: cartItem.title,
        price: product.price,
        image: cartItem.image,
        quantity: cartItem.quantity,
        totalPrice: {
          amount: itemTotal,
          currency: product.price.currency
        }
      });
    }

    // Calculate totals (simplified - in real app, you'd calculate tax, shipping, etc.)
    const taxAmount = subtotal * 0.1; // 10% tax
    const shippingCost = shippingMethod === 'express' ? 15 : (subtotal > 100 ? 0 : 5); // Express: $15, Standard: $5 or free over $100
    const totalAmount = subtotal + taxAmount + shippingCost;

    // Generate order number
    const orderNumber = Order.generateOrderNumber();

    // Create order
    const order = new Order({
      orderNumber,
      user: req.user.id, // This is the string id from JWT
      userId,
      items: orderItems,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      payment: {
        method: paymentMethod,
        status: 'pending',
        amount: {
          amount: totalAmount,
          currency: 'USD'
        }
      },
      subtotal: { amount: subtotal, currency: 'USD' },
      taxAmount: { amount: taxAmount, currency: 'USD' },
      shippingCost: { amount: shippingCost, currency: 'USD' },
      totalAmount: { amount: totalAmount, currency: 'USD' },
      notes
    });

    await order.save();

    // Send new order notification to admin
    try {
      await fetch('http://localhost:5000/api/notifications/new-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: orderNumber,
          customerName: `${shippingAddress.firstName} ${shippingAddress.lastName || ''}`.trim(),
          total: totalAmount.toFixed(2),
          paymentMethod: paymentMethod
        })
      });
      console.log(`New order notification sent for: ${orderNumber}`);
    } catch (notificationError) {
      console.error('Failed to send new order notification:', notificationError);
    }

    // Update product stock
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { 'availability.stock': -item.quantity }
      });
    }

    // Clear user's cart
    cart.clearCart();
    await cart.save();

    // Populate product details for response
    await order.populate('items.product', 'title images');

    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create order' });
  }
};

// Update order status (Admin only)
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber, estimatedDeliveryDate, cancelReason } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Update status using the model's method
    await order.updateStatus(status, { reason: cancelReason });

    // Add tracking info if provided
    if (trackingNumber || estimatedDeliveryDate) {
      await order.addTracking(trackingNumber, estimatedDeliveryDate);
    }

    await order.populate('items.product', 'title images');

    res.json(order);
  } catch (error) {
    console.error('Error updating order status:', error);
    if (error.message.includes('Invalid status') || error.message.includes('Cannot')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to update order status' });
  }
};

// Cancel order
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    const order = await Order.findOne({ _id: id, userId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if order can be cancelled
    if (['delivered', 'cancelled', 'refunded'].includes(order.status)) {
      return res.status(400).json({
        message: 'Order cannot be cancelled at this stage'
      });
    }

    // Cancel order
    await order.updateStatus('cancelled', { reason });

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { 'availability.stock': item.quantity }
      });
    }

    await order.populate('items.product', 'title images');

    res.json(order);
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ message: 'Failed to cancel order' });
  }
};

module.exports = {
  getUserOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  cancelOrder
};