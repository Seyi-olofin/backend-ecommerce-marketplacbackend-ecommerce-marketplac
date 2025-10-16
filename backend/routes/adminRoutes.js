const express = require('express');
const {
  getUsers,
  getUserDetails,
  updateUser,
  deleteUser,
  impersonateUser,
  getOrders,
  updateOrder,
  getProducts,
  updateProduct,
  deleteProduct,
  getDashboardStats,
  getAuditLogs,
  freezeUser,
  unfreezeUser,
  getPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal
} = require('../controllers/adminController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole(['admin', 'super_admin', 'marketing_admin', 'finance_admin', 'support_admin']));

// Dashboard stats
router.get('/dashboard/stats', getDashboardStats);

// User management
router.get('/users', getUsers);
router.get('/users/:id', getUserDetails);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.post('/users/:id/impersonate', requireRole(['admin', 'super_admin']), impersonateUser);
router.put('/users/:id/freeze', requireRole(['admin', 'super_admin']), freezeUser);
router.put('/users/:id/unfreeze', requireRole(['admin', 'super_admin']), unfreezeUser);

// Order management
router.get('/orders', getOrders);
router.put('/orders/:id', updateOrder);

// Product management
router.get('/products', getProducts);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

// Wallet/Finance management (Finance admin or higher)
router.get('/withdrawals/pending', requireRole(['admin', 'super_admin', 'finance_admin']), getPendingWithdrawals);
router.put('/withdrawals/:id/approve', requireRole(['admin', 'super_admin', 'finance_admin']), approveWithdrawal);
router.put('/withdrawals/:id/reject', requireRole(['admin', 'super_admin', 'finance_admin']), rejectWithdrawal);

// Audit logs (Super admin only)
router.get('/audit-logs', requireRole(['super_admin']), getAuditLogs);

module.exports = router;