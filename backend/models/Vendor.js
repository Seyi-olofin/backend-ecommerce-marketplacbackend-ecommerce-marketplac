const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  businessName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  logo: {
    type: String
  },
  banner: {
    type: String
  },
  contactInfo: {
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      zipCode: { type: String },
      country: { type: String }
    }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'blocked'],
    default: 'pending',
    index: true
  },
  commissionRate: {
    type: Number,
    default: 0.1,
    min: 0,
    max: 1
  },
  totalEarnings: {
    amount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USDT' }
  },
  totalPaid: {
    amount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USDT' }
  },
  productCount: {
    type: Number,
    default: 0,
    min: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
vendorSchema.index({ status: 1, createdAt: -1 });
vendorSchema.index({ user: 1 });

// Virtual for pending payout
vendorSchema.virtual('pendingPayout').get(function() {
  return this.totalEarnings.amount - this.totalPaid.amount;
});

// Method to update earnings
vendorSchema.methods.addEarnings = function(amount) {
  this.totalEarnings.amount += amount;
  return this.save();
};

// Method to process payout
vendorSchema.methods.processPayout = function(amount) {
  if (amount > this.pendingPayout) {
    throw new Error('Payout amount exceeds pending earnings');
  }
  this.totalPaid.amount += amount;
  return this.save();
};

module.exports = mongoose.model('Vendor', vendorSchema);