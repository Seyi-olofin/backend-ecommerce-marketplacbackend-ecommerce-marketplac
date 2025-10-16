const rateLimit = require('express-rate-limit');

// Different rate limits based on user type and endpoint
const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100,
    userTypeMultiplier = 1, // Premium users get higher limits
    endpointMultiplier = 1, // Some endpoints allow more requests
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return rateLimit({
    windowMs,
    max: (req, res) => {
      let limit = maxRequests;

      // Check user type (from JWT or session)
      const user = req.user; // Assuming user is attached by auth middleware
      if (user && user.isPremium) {
        limit *= 2; // Premium users get 2x limit
      }

      // Adjust based on endpoint
      const path = req.path;
      if (path.includes('/products') && req.method === 'GET') {
        limit *= 2; // Product listing endpoints get 2x limit
      } else if (path.includes('/search')) {
        limit *= 1.5; // Search endpoints get 1.5x limit
      } else if (path.includes('/auth')) {
        limit *= 0.5; // Auth endpoints get 0.5x limit (more restrictive)
      }

      return Math.floor(limit);
    },
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    skipFailedRequests,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Predefined rate limiters for different scenarios
const rateLimiters = {
  // General API rate limiter
  general: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100
  }),

  // Strict rate limiter for auth endpoints
  auth: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour for signup attempts
    maxRequests: 20 // Allow more signup attempts per hour
  }),

  // Lenient rate limiter for product browsing
  products: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 200 // More lenient for product browsing
  }),

  // Search endpoints
  search: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 150
  }),

  // Admin endpoints
  admin: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 500 // Higher limit for admin operations
  })
};

module.exports = {
  createRateLimiter,
  rateLimiters
};