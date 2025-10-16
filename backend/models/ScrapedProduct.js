const mongoose = require('mongoose');

const scrapedProductSchema = new mongoose.Schema({
  externalId: {
    type: String,
    required: true,
    index: true
  },
  externalUrl: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  source: {
    type: String,
    required: true,
    enum: ['aliexpress', 'taobao', 'amazon', 'ebay', 'other'],
    index: true
  },
  supplier: {
    type: String,
    required: true,
    index: true
  },
  rawData: {
    title: { type: String },
    description: { type: String },
    price: {
      amount: { type: Number },
      currency: { type: String },
      originalAmount: { type: Number }
    },
    images: [{ type: String }],
    thumbnail: { type: String },
    category: { type: String },
    subcategory: { type: String },
    specifications: { type: mongoose.Schema.Types.Mixed },
    shipping: {
      cost: { type: Number },
      currency: { type: String },
      estimatedDays: { type: Number }
    },
    stock: { type: Number },
    rating: { type: Number },
    reviewCount: { type: Number },
    brand: { type: String },
    sku: { type: String },
    variants: [{ type: mongoose.Schema.Types.Mixed }],
    metadata: { type: mongoose.Schema.Types.Mixed }
  },
  processedData: {
    title: { type: String },
    description: { type: String },
    shortDescription: { type: String },
    price: {
      amount: { type: Number },
      currency: { type: String, default: 'USD' },
      originalAmount: { type: Number }
    },
    images: [{ type: String }],
    thumbnail: { type: String },
    category: { type: String },
    subcategory: { type: String },
    specifications: { type: mongoose.Schema.Types.Mixed },
    shipping: {
      cost: { type: Number },
      currency: { type: String },
      estimatedDays: { type: Number }
    },
    stock: { type: Number, default: 10 },
    rating: { type: Number, default: 4.0 },
    reviewCount: { type: Number, default: 0 },
    brand: { type: String },
    tags: [{ type: String }],
    source: { type: String, default: 'scraped' }
  },
  status: {
    type: String,
    enum: ['scraped', 'processing', 'processed', 'imported', 'rejected', 'duplicate'],
    default: 'scraped',
    index: true
  },
  importStatus: {
    imported: { type: Boolean, default: false },
    importedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    importedAt: { type: Date },
    importedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  quality: {
    score: { type: Number, min: 0, max: 100 },
    issues: [{
      type: { type: String },
      severity: { type: String, enum: ['low', 'medium', 'high'] },
      message: { type: String }
    }]
  },
  scrapedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  processedAt: {
    type: Date
  },
  lastAttemptedAt: {
    type: Date
  },
  attemptCount: {
    type: Number,
    default: 0,
    max: 5
  },
  error: {
    message: { type: String },
    stack: { type: String }
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes
scrapedProductSchema.index({ source: 1, status: 1, scrapedAt: -1 });
scrapedProductSchema.index({ externalId: 1, source: 1 });
scrapedProductSchema.index({ status: 1, createdAt: -1 });
scrapedProductSchema.index({ 'quality.score': -1 });
scrapedProductSchema.index({ supplier: 1, scrapedAt: -1 });

// Compound indexes
scrapedProductSchema.index({ source: 1, supplier: 1, status: 1 });

// Method to mark as processed
scrapedProductSchema.methods.markProcessed = function(processedData, quality = null) {
  this.processedData = processedData;
  this.status = 'processed';
  this.processedAt = new Date();
  if (quality) {
    this.quality = quality;
  }
  return this.save();
};

// Method to mark as imported
scrapedProductSchema.methods.markImported = function(productId, userId) {
  this.importStatus.imported = true;
  this.importStatus.importedProduct = productId;
  this.importStatus.importedAt = new Date();
  this.importStatus.importedBy = userId;
  this.status = 'imported';
  return this.save();
};

// Method to mark as rejected
scrapedProductSchema.methods.markRejected = function(reason) {
  this.status = 'rejected';
  this.error = { message: reason };
  return this.save();
};

// Method to increment attempt count
scrapedProductSchema.methods.incrementAttempt = function(error = null) {
  this.attemptCount += 1;
  this.lastAttemptedAt = new Date();
  if (error) {
    this.error = error;
  }
  return this.save();
};

// Static method to find duplicates
scrapedProductSchema.statics.findDuplicates = function(externalId, source, excludeId = null) {
  const query = { externalId, source };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  return this.find(query);
};

// Static method to get pending processing
scrapedProductSchema.statics.getPendingProcessing = function(limit = 50) {
  return this.find({
    status: 'scraped',
    attemptCount: { $lt: 5 }
  })
    .sort({ scrapedAt: 1 })
    .limit(limit);
};

// Static method to get ready for import
scrapedProductSchema.statics.getReadyForImport = function(limit = 20, minQuality = 70) {
  return this.find({
    status: 'processed',
    'importStatus.imported': false,
    'quality.score': { $gte: minQuality }
  })
    .sort({ 'quality.score': -1, scrapedAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('ScrapedProduct', scrapedProductSchema);