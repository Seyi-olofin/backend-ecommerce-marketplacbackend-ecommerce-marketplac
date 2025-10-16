const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
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
    min: 1,
    default: 1
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  items: [cartItemSchema],
  totalItems: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
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
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
cartSchema.index({ user: 1, isActive: 1 });
cartSchema.index({ userId: 1, isActive: 1 });

// Pre-save middleware to calculate totals
cartSchema.pre('save', function(next) {
  this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
  this.totalAmount.amount = this.items.reduce((sum, item) => sum + (item.price.amount * item.quantity), 0);
  next();
});

// Method to add item to cart
cartSchema.methods.addItem = function(productData, quantity = 1) {
  const existingItemIndex = this.items.findIndex(item =>
    item.productId === productData.id
  );

  if (existingItemIndex >= 0) {
    // Update existing item quantity
    this.items[existingItemIndex].quantity += quantity;
    this.items[existingItemIndex].addedAt = new Date();
  } else {
    // Add new item
    this.items.push({
      product: productData._id,
      productId: productData.id,
      title: productData.title,
      price: productData.price,
      image: productData.images?.[0] || productData.thumbnail,
      quantity: quantity
    });
  }
};

// Method to update item quantity
cartSchema.methods.updateItemQuantity = function(productId, quantity) {
  const itemIndex = this.items.findIndex(item => item.productId === productId);
  if (itemIndex >= 0) {
    if (quantity <= 0) {
      this.items.splice(itemIndex, 1);
    } else {
      this.items[itemIndex].quantity = quantity;
      this.items[itemIndex].addedAt = new Date();
    }
    return true;
  }
  return false;
};

// Method to remove item from cart
cartSchema.methods.removeItem = function(productId) {
  const itemIndex = this.items.findIndex(item => item.productId === productId);
  if (itemIndex >= 0) {
    this.items.splice(itemIndex, 1);
    return true;
  }
  return false;
};

// Method to clear cart
cartSchema.methods.clearCart = function() {
  this.items = [];
};

// Static method to find cart by user ID
cartSchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId, isActive: true });
};

// Static method to find or create cart for user
cartSchema.statics.findOrCreateByUserId = async function(userId, userObjectId) {
  let cart = await this.findOne({ userId, isActive: true });
  if (!cart) {
    cart = new this({
      user: userObjectId,
      userId: userId,
      items: [],
      totalItems: 0,
      totalAmount: { amount: 0, currency: 'USD' }
    });
    await cart.save();
  }
  return cart;
};

module.exports = mongoose.model('Cart', cartSchema);