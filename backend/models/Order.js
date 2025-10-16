const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  price: {
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      default: 'USD'
    }
  },
  image: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  totalPrice: {
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      default: 'USD'
    }
  }
});

const shippingAddressSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  zipCode: {
    type: String,
    required: true,
    trim: true
  },
  country: {
    type: String,
    required: true,
    trim: true
  }
});

const paymentInfoSchema = new mongoose.Schema({
  method: {
    type: String,
    required: true,
    enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'cash_on_delivery']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  transactionId: {
    type: String,
    trim: true
  },
  paymentDate: {
    type: Date
  },
  amount: {
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      default: 'USD'
    }
  },
  paymentDetails: {
    type: mongoose.Schema.Types.Mixed // For storing payment provider specific data
  }
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  items: [orderItemSchema],
  status: {
    type: String,
    required: true,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending',
    index: true
  },
  shippingAddress: shippingAddressSchema,
  billingAddress: shippingAddressSchema, // Can be same as shipping or different
  payment: paymentInfoSchema,
  subtotal: {
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      default: 'USD'
    }
  },
  taxAmount: {
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  shippingCost: {
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  discountAmount: {
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  totalAmount: {
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      default: 'USD'
    }
  },
  notes: {
    type: String,
    trim: true
  },
  trackingNumber: {
    type: String,
    trim: true
  },
  estimatedDeliveryDate: {
    type: Date
  },
  deliveredAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  cancelReason: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

// Compound indexes for common query patterns
orderSchema.index({ user: 1, status: 1 });
orderSchema.index({ userId: 1, status: 1 });

// Pre-save middleware to calculate totals
orderSchema.pre('save', function(next) {
  // Calculate subtotal from items
  this.subtotal.amount = this.items.reduce((sum, item) => sum + item.totalPrice.amount, 0);

  // Calculate total
  this.totalAmount.amount = this.subtotal.amount + this.taxAmount.amount + this.shippingCost.amount - this.discountAmount.amount;

  next();
});

// Method to update status with validation
orderSchema.methods.updateStatus = function(newStatus, additionalData = {}) {
  const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
  const currentIndex = validStatuses.indexOf(this.status);
  const newIndex = validStatuses.indexOf(newStatus);

  if (newIndex === -1) {
    throw new Error('Invalid status');
  }

  // Prevent invalid status transitions
  if (newStatus === 'cancelled' && ['delivered', 'refunded'].includes(this.status)) {
    throw new Error('Cannot cancel a delivered or refunded order');
  }

  if (newStatus === 'refunded' && !['delivered', 'cancelled'].includes(this.status)) {
    throw new Error('Can only refund delivered or cancelled orders');
  }

  this.status = newStatus;

  // Set timestamps based on status
  if (newStatus === 'delivered' && !this.deliveredAt) {
    this.deliveredAt = new Date();
  }

  if (newStatus === 'cancelled' && !this.cancelledAt) {
    this.cancelledAt = new Date();
    if (additionalData.reason) {
      this.cancelReason = additionalData.reason;
    }
  }

  // Update payment status if applicable
  if (newStatus === 'cancelled' && this.payment) {
    this.payment.status = 'cancelled';
  }

  if (newStatus === 'refunded' && this.payment) {
    this.payment.status = 'refunded';
  }

  return this.save();
};

// Method to add tracking information
orderSchema.methods.addTracking = function(trackingNumber, estimatedDeliveryDate) {
  this.trackingNumber = trackingNumber;
  if (estimatedDeliveryDate) {
    this.estimatedDeliveryDate = estimatedDeliveryDate;
  }
  return this.save();
};

// Static method to generate order number
orderSchema.statics.generateOrderNumber = function() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD-${timestamp}-${random}`;
};

// Static method to find orders by user ID
orderSchema.statics.findByUserId = function(userId, limit = 20, offset = 0) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset)
    .populate('user', 'firstName lastName email')
    .populate('items.product', 'title images');
};

// Static method to find order by order number
orderSchema.statics.findByOrderNumber = function(orderNumber) {
  return this.findOne({ orderNumber })
    .populate('user', 'firstName lastName email')
    .populate('items.product', 'title images');
};

module.exports = mongoose.model('Order', orderSchema);