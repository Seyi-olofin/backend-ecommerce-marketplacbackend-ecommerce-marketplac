const express = require('express');
const {
  getProfile,
  updateProfile,
  changePassword
} = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All user routes require authentication
router.use(authenticateToken);

// GET /api/users/profile - Get user profile
router.get('/profile', getProfile);

// PUT /api/users/profile - Update user profile
router.put('/profile', updateProfile);

// PUT /api/users/change-password - Change user password
router.put('/change-password', changePassword);

module.exports = router;