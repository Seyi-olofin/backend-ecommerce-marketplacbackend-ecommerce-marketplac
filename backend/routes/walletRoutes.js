const express = require('express');
const {
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
} = require('../controllers/walletController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// User wallet operations
router.get('/balance', authenticateToken, getWalletBalance);
router.get('/transactions', authenticateToken, getWalletTransactions);
router.post('/deposit', authenticateToken, depositFunds);
router.post('/withdraw', authenticateToken, withdrawFunds);

// Admin wallet management
router.get('/admin/transactions', authenticateToken, requireRole(['admin', 'super_admin', 'finance_admin']), getWalletTransactions);
router.put('/admin/withdrawals/:id/approve', authenticateToken, requireRole(['admin', 'super_admin', 'finance_admin']), approveWithdrawal);
router.put('/admin/withdrawals/:id/reject', authenticateToken, requireRole(['admin', 'super_admin', 'finance_admin']), rejectWithdrawal);
router.post('/admin/credit', authenticateToken, requireRole(['admin', 'super_admin', 'finance_admin']), creditWallet);
router.post('/admin/debit', authenticateToken, requireRole(['admin', 'super_admin', 'finance_admin']), debitWallet);
router.put('/admin/:userId/freeze', authenticateToken, requireRole(['admin', 'super_admin']), freezeWallet);
router.put('/admin/:userId/unfreeze', authenticateToken, requireRole(['admin', 'super_admin']), unfreezeWallet);

module.exports = router;