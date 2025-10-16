const express = require("express");
const {
  signup,
  login,
  getMe,
  logout,
} = require("../controllers/authController");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// @route   POST /api/auth/signup
// @desc    Register a new user
router.post("/signup", signup);

// @route   POST /api/auth/login
// @desc    Log user in and return token
router.post("/login", login);

// @route   GET /api/auth/me
// @desc    Get logged-in user data
router.get("/me", authenticateToken, getMe);

// @route   POST /api/auth/logout
// @desc    Log user out
router.post("/logout", logout);

module.exports = router;
