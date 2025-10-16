const WalletTransaction = require('../models/WalletTransaction');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// Get wallet balance
const getWalletBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('walletBalance isFrozen');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      balance: user.walletBalance,
      isFrozen: user.isFrozen
    });
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    res.status(500).json({ message: 'Failed to fetch wallet balance' });
  }
};

// Get wallet transactions
const getWalletTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, type } = req.query;

    const transactions = await WalletTransaction.getUserTransactions(userId, limit, (page - 1) * limit, type);
    const total = await WalletTransaction.countDocuments({ user: userId, ...(type && { type }) });

    res.json({
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    res.status(500).json({ message: 'Failed to fetch wallet transactions' });
  }
};

// Deposit funds (mock implementation)
const depositFunds = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, paymentMethod } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isFrozen) {
      return res.status(403).json({ message: 'Wallet is frozen' });
    }

    // Create pending transaction
    const transaction = new WalletTransaction({
      user: userId,
      type: 'deposit',
      amount: { amount, currency: 'USDT' },
      balanceBefore: user.walletBalance,
      description: `Deposit via ${paymentMethod || 'mock payment'}`,
      status: 'pending'
    });

    await transaction.save();

    // For MVP, auto-approve deposits
    await transaction.approve(userId);

    // Update user balance
    user.walletBalance.amount += amount;
    await user.save();

    // Log action
    await AuditLog.logAction({
      user: userId,
      action: 'CREATE',
      resource: 'wallet_transaction',
      resourceId: transaction._id,
      endpoint: '/api/wallet/deposit',
      statusCode: 200,
      metadata: { amount, paymentMethod }
    });

    res.json({
      message: 'Deposit successful',
      transaction,
      newBalance: user.walletBalance
    });
  } catch (error) {
    console.error('Error processing deposit:', error);
    res.status(500).json({ message: 'Failed to process deposit' });
  }
};

// Withdraw funds
const withdrawFunds = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, walletAddress } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isFrozen) {
      return res.status(403).json({ message: 'Wallet is frozen' });
    }

    if (user.walletBalance.amount < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Create pending withdrawal transaction
    const transaction = new WalletTransaction({
      user: userId,
      type: 'withdrawal',
      amount: { amount, currency: 'USDT' },
      balanceBefore: user.walletBalance,
      description: `Withdrawal to ${walletAddress}`,
      status: 'pending',
      metadata: { walletAddress }
    });

    await transaction.save();

    res.json({
      message: 'Withdrawal request submitted for approval',
      transaction
    });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(500).json({ message: 'Failed to process withdrawal' });
  }
};

// Approve withdrawal (Admin)
const approveWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const transaction = await WalletTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.type !== 'withdrawal' || transaction.status !== 'pending') {
      return res.status(400).json({ message: 'Invalid transaction for approval' });
    }

    await transaction.approve(adminId);

    // Update user balance
    const user = await User.findById(transaction.user);
    user.walletBalance.amount -= transaction.amount.amount;
    await user.save();

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'UPDATE',
      resource: 'wallet_transaction',
      resourceId: id,
      endpoint: `/api/wallet/admin/withdrawals/${id}/approve`,
      statusCode: 200,
      metadata: { approvedAmount: transaction.amount.amount }
    });

    res.json({
      message: 'Withdrawal approved successfully',
      transaction
    });
  } catch (error) {
    console.error('Error approving withdrawal:', error);
    res.status(500).json({ message: 'Failed to approve withdrawal' });
  }
};

// Reject withdrawal (Admin)
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

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'UPDATE',
      resource: 'wallet_transaction',
      resourceId: id,
      endpoint: `/api/wallet/admin/withdrawals/${id}/reject`,
      statusCode: 200,
      metadata: { rejectionReason: reason }
    });

    res.json({
      message: 'Withdrawal rejected successfully',
      transaction
    });
  } catch (error) {
    console.error('Error rejecting withdrawal:', error);
    res.status(500).json({ message: 'Failed to reject withdrawal' });
  }
};

// Credit wallet (Admin)
const creditWallet = async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;
    const adminId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const transaction = new WalletTransaction({
      user: userId,
      type: 'admin_credit',
      amount: { amount, currency: 'USDT' },
      balanceBefore: user.walletBalance,
      description: `Admin credit: ${reason}`,
      initiatedBy: adminId
    });

    await transaction.save();
    await transaction.approve(adminId);

    user.walletBalance.amount += amount;
    await user.save();

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'CREATE',
      resource: 'wallet_transaction',
      resourceId: transaction._id,
      endpoint: '/api/wallet/admin/credit',
      statusCode: 200,
      metadata: { creditedUser: userId, amount, reason }
    });

    res.json({
      message: 'Wallet credited successfully',
      transaction,
      newBalance: user.walletBalance
    });
  } catch (error) {
    console.error('Error crediting wallet:', error);
    res.status(500).json({ message: 'Failed to credit wallet' });
  }
};

// Debit wallet (Admin)
const debitWallet = async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;
    const adminId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.walletBalance.amount < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    const transaction = new WalletTransaction({
      user: userId,
      type: 'admin_debit',
      amount: { amount, currency: 'USDT' },
      balanceBefore: user.walletBalance,
      description: `Admin debit: ${reason}`,
      initiatedBy: adminId
    });

    await transaction.save();
    await transaction.approve(adminId);

    user.walletBalance.amount -= amount;
    await user.save();

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'CREATE',
      resource: 'wallet_transaction',
      resourceId: transaction._id,
      endpoint: '/api/wallet/admin/debit',
      statusCode: 200,
      metadata: { debitedUser: userId, amount, reason }
    });

    res.json({
      message: 'Wallet debited successfully',
      transaction,
      newBalance: user.walletBalance
    });
  } catch (error) {
    console.error('Error debiting wallet:', error);
    res.status(500).json({ message: 'Failed to debit wallet' });
  }
};

// Freeze wallet (Admin)
const freezeWallet = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id;

    const user = await User.findByIdAndUpdate(
      userId,
      { isFrozen: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'UPDATE',
      resource: 'user',
      resourceId: userId,
      endpoint: `/api/wallet/admin/${userId}/freeze`,
      statusCode: 200,
      oldValues: { isFrozen: false },
      newValues: { isFrozen: true }
    });

    res.json({
      message: 'Wallet frozen successfully',
      user: { id: user._id, isFrozen: user.isFrozen }
    });
  } catch (error) {
    console.error('Error freezing wallet:', error);
    res.status(500).json({ message: 'Failed to freeze wallet' });
  }
};

// Unfreeze wallet (Admin)
const unfreezeWallet = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id;

    const user = await User.findByIdAndUpdate(
      userId,
      { isFrozen: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'UPDATE',
      resource: 'user',
      resourceId: userId,
      endpoint: `/api/wallet/admin/${userId}/unfreeze`,
      statusCode: 200,
      oldValues: { isFrozen: true },
      newValues: { isFrozen: false }
    });

    res.json({
      message: 'Wallet unfrozen successfully',
      user: { id: user._id, isFrozen: user.isFrozen }
    });
  } catch (error) {
    console.error('Error unfreezing wallet:', error);
    res.status(500).json({ message: 'Failed to unfreeze wallet' });
  }
};

module.exports = {
  getWalletBalance,
  getWalletTransactions,
  depositFunds,
  withdrawFunds,
  approveWithdrawal,
  rejectWithdrawal,
  creditWallet,
  debitWallet,
  freezeWallet,
  unfreezeWallet
};