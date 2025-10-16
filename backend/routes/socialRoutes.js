const express = require('express');
const {
  createSocialPost,
  getSocialPosts,
  updateSocialPost,
  deleteSocialPost,
  approveSocialPost,
  rejectSocialPost,
  publishSocialPost,
  getSocialStats,
  updateSocialSettings
} = require('../controllers/socialController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All social routes require authentication
router.use(authenticateToken);

// User social post management
router.post('/', createSocialPost);
router.get('/', getSocialPosts);
router.put('/:id', updateSocialPost);
router.delete('/:id', deleteSocialPost);

// Admin social post moderation
router.put('/:id/approve', requireRole(['admin', 'super_admin', 'marketing_admin']), approveSocialPost);
router.put('/:id/reject', requireRole(['admin', 'super_admin', 'marketing_admin']), rejectSocialPost);
router.post('/:id/publish', requireRole(['admin', 'super_admin', 'marketing_admin']), publishSocialPost);

// Social analytics and settings
router.get('/stats', requireRole(['admin', 'super_admin', 'marketing_admin']), getSocialStats);
router.put('/settings', requireRole(['admin', 'super_admin', 'marketing_admin']), updateSocialSettings);

module.exports = router;