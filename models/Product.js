const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  shortDescription: {
    type: String,
    trim: true
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
    },
    originalAmount: {
      type: Number,
      min: 0
    }
  },
  images: [{
    type: String,
    required: true
  }],
  thumbnail: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    index: true
  },
  subcategory: {
    type: String,
    index: true
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 4.0
  },
  reviewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  availability: {
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 10
    },
    status: {
      type: String,
      enum: ['in_stock', 'out_of_stock', 'discontinued'],
      default: 'in_stock'
    }
  },
  specifications: {
    type: mongoose.Schema.Types.Mixed
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  brand: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  isFlashSale: {
    type: Boolean,
    default: false,
    index: true
  },
  flashSaleEndTime: {
    type: Date
  },
  discountPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isFeatured: {
    type: Boolean,
    default: false,
    index: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  source: {
    type: String,
    default: 'internal'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
productSchema.index({ category: 1, subcategory: 1, isActive: 1 });
productSchema.index({ isFlashSale: 1, isActive: 1 });
productSchema.index({ isFeatured: 1, isActive: 1 });
productSchema.index({ title: 'text', description: 'text' });
productSchema.index({ 'price.amount': 1 });
productSchema.index({ rating: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ brand: 1, isActive: 1 });
productSchema.index({ tags: 1, isActive: 1 });
productSchema.index({ source: 1, isActive: 1 });

// Compound indexes for common query patterns
productSchema.index({ category: 1, 'price.amount': 1, isActive: 1 });
productSchema.index({ 'price.amount': 1, rating: -1, isActive: 1 });
productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.index({ category: 1, rating: -1, isActive: 1 });

// Virtual for discounted price
productSchema.virtual('discountedPrice').get(function() {
  if (this.discountPercentage > 0) {
    return this.price.amount * (1 - this.discountPercentage / 100);
  }
  return this.price.amount;
});

// Method to check if flash sale is active
productSchema.methods.isFlashSaleActive = function() {
  if (!this.isFlashSale || !this.flashSaleEndTime) {
    return false;
  }
  return new Date() < this.flashSaleEndTime;
};

module.exports = mongoose.model('Product', productSchema);