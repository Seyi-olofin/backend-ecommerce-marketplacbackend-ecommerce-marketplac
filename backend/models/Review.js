const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  images: [{
    type: String
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  moderatedAt: {
    type: Date
  },
  moderationReason: {
    type: String,
    trim: true
  },
  isVerifiedPurchase: {
    type: Boolean,
    default: true
  },
  helpful: {
    count: { type: Number, default: 0 },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  reported: {
    count: { type: Number, default: 0 },
    reasons: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: { type: String, trim: true },
      reportedAt: { type: Date, default: Date.now }
    }]
  }
}, {
  timestamps: true
});

// Indexes
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });
reviewSchema.index({ user: 1, createdAt: -1 });
reviewSchema.index({ status: 1, createdAt: -1 });

// Compound indexes
reviewSchema.index({ product: 1, rating: -1, status: 1 });

// Method to approve review
reviewSchema.methods.approve = function(adminId) {
  this.status = 'approved';
  this.moderatedBy = adminId;
  this.moderatedAt = new Date();
  return this.save();
};

// Method to reject review
reviewSchema.methods.reject = function(adminId, reason) {
  this.status = 'rejected';
  this.moderatedBy = adminId;
  this.moderatedAt = new Date();
  this.moderationReason = reason;
  return this.save();
};

// Method to mark as helpful
reviewSchema.methods.markHelpful = function(userId) {
  if (!this.helpful.users.includes(userId)) {
    this.helpful.users.push(userId);
    this.helpful.count = this.helpful.users.length;
    return this.save();
  }
  return this;
};

// Static method to get approved reviews for product
reviewSchema.statics.getApprovedForProduct = function(productId, limit = 10, offset = 0) {
  return this.find({ product: productId, status: 'approved' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset)
    .populate('user', 'firstName lastName')
    .populate('order', 'orderNumber');
};

// Static method to calculate average rating for product
reviewSchema.statics.getAverageRating = async function(productId) {
  const result = await this.aggregate([
    { $match: { product: mongoose.Types.ObjectId(productId), status: 'approved' } },
    {
      $group: {
        _id: '$product',
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);
  return result[0] || { averageRating: 0, totalReviews: 0 };
};

module.exports = mongoose.model('Review', reviewSchema);