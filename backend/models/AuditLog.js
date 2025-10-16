const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  resource: {
    type: String,
    required: true,
    index: true
  },
  resourceId: {
    type: String,
    index: true
  },
  method: {
    type: String,
    required: true,
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  },
  endpoint: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  },
  statusCode: {
    type: Number,
    required: true
  },
  responseTime: {
    type: Number, // in milliseconds
    min: 0
  },
  oldValues: {
    type: mongoose.Schema.Types.Mixed
  },
  newValues: {
    type: mongoose.Schema.Types.Mixed
  },
  changes: [{
    field: { type: String, required: true },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed }
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  error: {
    message: { type: String },
    stack: { type: String }
  },
  sessionId: {
    type: String,
    index: true
  },
  impersonatedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ sessionId: 1, createdAt: -1 });

// Compound indexes
auditLogSchema.index({ user: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1, createdAt: -1 });

// Static method to log action
auditLogSchema.statics.logAction = function(data) {
  return new this(data).save();
};

// Static method to get user activity
auditLogSchema.statics.getUserActivity = function(userId, limit = 50, offset = 0) {
  return this.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset)
    .populate('user', 'firstName lastName email')
    .populate('impersonatedUser', 'firstName lastName email');
};

// Static method to get resource changes
auditLogSchema.statics.getResourceChanges = function(resource, resourceId, limit = 50, offset = 0) {
  return this.find({
    resource,
    resourceId,
    action: { $in: ['UPDATE', 'DELETE', 'CREATE'] }
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset)
    .populate('user', 'firstName lastName email');
};

// Static method to get admin actions
auditLogSchema.statics.getAdminActions = function(limit = 100, offset = 0, userId = null) {
  const query = {
    user: { $exists: true },
    action: { $nin: ['LOGIN', 'LOGOUT', 'VIEW'] }
  };

  if (userId) {
    query.user = userId;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset)
    .populate('user', 'firstName lastName email role')
    .populate('impersonatedUser', 'firstName lastName email');
};

module.exports = mongoose.model('AuditLog', auditLogSchema);