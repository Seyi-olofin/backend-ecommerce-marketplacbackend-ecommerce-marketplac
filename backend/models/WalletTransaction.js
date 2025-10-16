const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['deposit', 'withdrawal', 'purchase', 'refund', 'admin_credit', 'admin_debit', 'vendor_payout'],
    index: true
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
      default: 'USDT'
    }
  },
  balanceBefore: {
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'USDT' }
  },
  balanceAfter: {
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'USDT' }
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed',
    index: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  reference: {
    type: String,
    trim: true,
    index: true
  },
  externalTransactionId: {
    type: String,
    trim: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor'
  },
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  failureReason: {
    type: String,
    trim: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes
walletTransactionSchema.index({ user: 1, createdAt: -1 });
walletTransactionSchema.index({ type: 1, status: 1, createdAt: -1 });
walletTransactionSchema.index({ reference: 1 });
walletTransactionSchema.index({ status: 1, createdAt: -1 });

// Compound indexes
walletTransactionSchema.index({ user: 1, type: 1, createdAt: -1 });

// Method to approve transaction
walletTransactionSchema.methods.approve = function(adminId) {
  if (this.status !== 'pending') {
    throw new Error('Only pending transactions can be approved');
  }
  this.status = 'completed';
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  return this.save();
};

// Method to reject transaction
walletTransactionSchema.methods.reject = function(adminId, reason) {
  if (this.status !== 'pending') {
    throw new Error('Only pending transactions can be rejected');
  }
  this.status = 'cancelled';
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  this.failureReason = reason;
  return this.save();
};

// Static method to get user transactions
walletTransactionSchema.statics.getUserTransactions = function(userId, limit = 20, offset = 0, type = null) {
  const query = { user: userId };
  if (type) {
    query.type = type;
  }
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset)
    .populate('initiatedBy', 'firstName lastName')
    .populate('approvedBy', 'firstName lastName')
    .populate('order', 'orderNumber')
    .populate('vendor', 'businessName');
};

// Static method to get pending withdrawals
walletTransactionSchema.statics.getPendingWithdrawals = function(limit = 50, offset = 0) {
  return this.find({ type: 'withdrawal', status: 'pending' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset)
    .populate('user', 'firstName lastName email')
    .populate('initiatedBy', 'firstName lastName');
};

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);