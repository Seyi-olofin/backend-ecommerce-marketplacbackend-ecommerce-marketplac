const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  image: {
    type: String,
    required: true
  },
  parentId: {
    type: String,
    default: null
  },
  subcategories: [{
    id: String,
    name: String,
    image: String,
    description: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  source: {
    type: String,
    default: 'internal'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Index for better query performance
categorySchema.index({ parentId: 1, isActive: 1 });
categorySchema.index({ name: 'text' });
categorySchema.index({ source: 1, isActive: 1 });

module.exports = mongoose.model('Category', categorySchema);