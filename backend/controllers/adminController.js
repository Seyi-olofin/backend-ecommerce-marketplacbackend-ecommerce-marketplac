const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const WalletTransaction = require('../models/WalletTransaction');
const AuditLog = require('../models/AuditLog');

// Get dashboard stats
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalOrders,
      totalProducts,
      totalRevenue,
      pendingOrders,
      pendingWithdrawals
    ] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Product.countDocuments(),
      Order.aggregate([
        { $match: { status: { $in: ['delivered', 'completed'] } } },
        { $group: { _id: null, total: { $sum: '$totalAmount.amount' } } }
      ]),
      Order.countDocuments({ status: 'pending' }),
      WalletTransaction.countDocuments({ type: 'withdrawal', status: 'pending' })
    ]);

    res.json({
      totalUsers,
      totalOrders,
      totalProducts,
      totalRevenue: totalRevenue[0]?.total || 0,
      pendingOrders,
      pendingWithdrawals
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard stats' });
  }
};

// Helper function to get mongoose
const mongoose = require('mongoose');

// Get users with pagination
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const query = {};

    if (role) query.role = role;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

// Get user details
const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user stats
    const [orderCount, totalSpent, walletTransactions] = await Promise.all([
      Order.countDocuments({ user: id }),
      Order.aggregate([
        { $match: { user: mongoose.Types.ObjectId(id), status: { $in: ['delivered', 'completed'] } } },
        { $group: { _id: null, total: { $sum: '$totalAmount.amount' } } }
      ]),
      WalletTransaction.find({ user: id }).sort({ createdAt: -1 }).limit(5)
    ]);

    res.json({
      user,
      stats: {
        orderCount,
        totalSpent: totalSpent[0]?.total || 0,
        recentTransactions: walletTransactions
      }
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ message: 'Failed to fetch user details' });
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const adminId = req.user.id;

    // Prevent updating sensitive fields
    delete updates.password;
    delete updates.walletBalance;

    const user = await User.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'UPDATE',
      resource: 'user',
      resourceId: id,
      endpoint: `/api/admin/users/${id}`,
      statusCode: 200,
      oldValues: {},
      newValues: updates
    });

    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'DELETE',
      resource: 'user',
      resourceId: id,
      endpoint: `/api/admin/users/${id}`,
      statusCode: 200
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
};

// Impersonate user
const impersonateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const user = await User.findById(id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update impersonation status
    await User.findByIdAndUpdate(id, { impersonatedBy: adminId });

    // Generate impersonation token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      {
        id: user._id,
        impersonatedBy: adminId
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'IMPERSONATE',
      resource: 'user',
      resourceId: id,
      endpoint: `/api/admin/users/${id}/impersonate`,
      statusCode: 200,
      impersonatedUser: user._id
    });

    res.json({
      message: 'Impersonation started successfully',
      token,
      user
    });
  } catch (error) {
    console.error('Error impersonating user:', error);
    res.status(500).json({ message: 'Failed to impersonate user' });
  }
};

// Freeze user
const freezeUser = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const user = await User.findByIdAndUpdate(
      id,
      { isFrozen: true },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'UPDATE',
      resource: 'user',
      resourceId: id,
      endpoint: `/api/admin/users/${id}/freeze`,
      statusCode: 200,
      oldValues: { isFrozen: false },
      newValues: { isFrozen: true }
    });

    res.json({
      message: 'User frozen successfully',
      user
    });
  } catch (error) {
    console.error('Error freezing user:', error);
    res.status(500).json({ message: 'Failed to freeze user' });
  }
};

// Unfreeze user
const unfreezeUser = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const user = await User.findByIdAndUpdate(
      id,
      { isFrozen: false, impersonatedBy: null },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'UPDATE',
      resource: 'user',
      resourceId: id,
      endpoint: `/api/admin/users/${id}/unfreeze`,
      statusCode: 200,
      oldValues: { isFrozen: true },
      newValues: { isFrozen: false }
    });

    res.json({
      message: 'User unfrozen successfully',
      user
    });
  } catch (error) {
    console.error('Error unfreezing user:', error);
    res.status(500).json({ message: 'Failed to unfreeze user' });
  }
};

// Get orders
const getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const query = {};

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'shippingAddress.email': { $regex: search, $options: 'i' } }
      ];
    }

    const orders = await Order.find(query)
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
};

// Update order
const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const adminId = req.user.id;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const oldStatus = order.status;
    order.status = status;
    if (notes) order.notes = notes;

    await order.save();

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'UPDATE',
      resource: 'order',
      resourceId: id,
      endpoint: `/api/admin/orders/${id}`,
      statusCode: 200,
      oldValues: { status: oldStatus },
      newValues: { status }
    });

    res.json(order);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ message: 'Failed to update order' });
  }
};

// Get products
const getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(query);

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
};

// Update product
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const adminId = req.user.id;

    const product = await Product.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'UPDATE',
      resource: 'product',
      resourceId: id,
      endpoint: `/api/admin/products/${id}`,
      statusCode: 200,
      oldValues: {},
      newValues: updates
    });

    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Failed to update product' });
  }
};

// Delete product
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'DELETE',
      resource: 'product',
      resourceId: id,
      endpoint: `/api/admin/products/${id}`,
      statusCode: 200
    });

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Failed to delete product' });
  }
};

// Get audit logs
const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, user, action, resource } = req.query;

    const query = {};
    if (user) query.user = user;
    if (action) query.action = action;
    if (resource) query.resource = resource;

    const logs = await AuditLog.find(query)
      .populate('user', 'firstName lastName email')
      .populate('impersonatedUser', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await AuditLog.countDocuments(query);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
};

// Get pending withdrawals
const getPendingWithdrawals = async (req, res) => {
  try {
    const withdrawals = await WalletTransaction.getPendingWithdrawals();
    res.json(withdrawals);
  } catch (error) {
    console.error('Error fetching pending withdrawals:', error);
    res.status(500).json({ message: 'Failed to fetch pending withdrawals' });
  }
};

// Approve withdrawal
const approveWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const transaction = await WalletTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    await transaction.approve(adminId);

    // Update user balance
    const user = await User.findById(transaction.user);
    user.walletBalance.amount -= transaction.amount.amount;
    await user.save();

    res.json({
      message: 'Withdrawal approved successfully',
      transaction
    });
  } catch (error) {
    console.error('Error approving withdrawal:', error);
    res.status(500).json({ message: 'Failed to approve withdrawal' });
  }
};

// Reject withdrawal
const rejectWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    const transaction = await WalletTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    await transaction.reject(adminId, reason);

    res.json({
      message: 'Withdrawal rejected successfully',
      transaction
    });
  } catch (error) {
    console.error('Error rejecting withdrawal:', error);
    res.status(500).json({ message: 'Failed to reject withdrawal' });
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  getUserDetails,
  updateUser,
  deleteUser,
  impersonateUser,
  freezeUser,
  unfreezeUser,
  getOrders,
  updateOrder,
  getProducts,
  updateProduct,
  deleteProduct,
  getAuditLogs,
  getPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal
};