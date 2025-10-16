const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['buyer', 'vendor', 'admin', 'super_admin', 'marketing_admin', 'finance_admin', 'support_admin'],
      default: 'buyer'
    },
    isActive: { type: Boolean, default: true },
    isFrozen: { type: Boolean, default: false },
    walletBalance: {
      amount: { type: Number, default: 0, min: 0 },
      currency: { type: String, default: 'USDT' }
    },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String },
    lastLogin: { type: Date },
    impersonatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    vendorProfile: {
      businessName: { type: String },
      description: { type: String },
      status: { type: String, enum: ['pending', 'approved', 'blocked'], default: 'pending' },
      commissionRate: { type: Number, default: 0.1, min: 0, max: 1 }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);