const mongoose = require('mongoose');

const socialPostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  images: [{
    type: String
  }],
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  trigger: {
    type: String,
    enum: ['manual', 'product_added', 'sale_event', 'review_approved'],
    default: 'manual'
  },
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'approved', 'published', 'rejected'],
    default: 'draft',
    index: true
  },
  platforms: [{
    type: String,
    enum: ['facebook', 'twitter', 'instagram', 'linkedin', 'tiktok']
  }],
  scheduledFor: {
    type: Date
  },
  publishedAt: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  engagement: {
    likes: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 }
  },
  externalPostIds: {
    facebook: { type: String },
    twitter: { type: String },
    instagram: { type: String },
    linkedin: { type: String },
    tiktok: { type: String }
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes
socialPostSchema.index({ status: 1, createdAt: -1 });
socialPostSchema.index({ createdBy: 1, createdAt: -1 });
socialPostSchema.index({ scheduledFor: 1 });
socialPostSchema.index({ trigger: 1, status: 1 });

// Method to approve post
socialPostSchema.methods.approve = function(adminId) {
  this.status = 'approved';
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  return this.save();
};

// Method to reject post
socialPostSchema.methods.reject = function(adminId, reason) {
  this.status = 'rejected';
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  this.rejectionReason = reason;
  return this.save();
};

// Method to publish post
socialPostSchema.methods.publish = function(adminId, externalIds = {}) {
  this.status = 'published';
  this.publishedBy = adminId;
  this.publishedAt = new Date();
  this.externalPostIds = { ...this.externalPostIds, ...externalIds };
  return this.save();
};

// Static method to create auto-post from product
socialPostSchema.statics.createFromProduct = function(product, trigger = 'product_added') {
  const title = `New Product: ${product.title}`;
  const content = `Check out our latest product: ${product.title}\n\n${product.description}\n\nPrice: $${product.price.amount}\n\n#NewProduct #Shopping`;

  return new this({
    title,
    content,
    images: product.images.slice(0, 4), // Max 4 images
    product: product._id,
    trigger,
    status: 'pending_approval',
    platforms: ['facebook', 'instagram'] // Default platforms
  });
};

// Static method to create auto-post from sale
socialPostSchema.statics.createFromSale = function(order, product) {
  const title = `New Sale!`;
  const content = `🎉 Someone just purchased ${product.title}!\n\nDon't miss out on this amazing product.\n\n#Sale #Shopping #Deal`;

  return new this({
    title,
    content,
    images: product.images.slice(0, 1),
    product: product._id,
    trigger: 'sale_event',
    status: 'pending_approval',
    platforms: ['facebook', 'instagram']
  });
};

// Static method to get pending posts
socialPostSchema.statics.getPendingPosts = function(limit = 20, offset = 0) {
  return this.find({ status: 'pending_approval' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset)
    .populate('product', 'title images')
    .populate('createdBy', 'firstName lastName')
    .populate('approvedBy', 'firstName lastName');
};

module.exports = mongoose.model('SocialPost', socialPostSchema);