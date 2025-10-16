const SocialPost = require('../models/SocialPost');
const Product = require('../models/Product');
const Order = require('../models/Order');
const AuditLog = require('../models/AuditLog');

// Create social post
const createSocialPost = async (req, res) => {
  try {
    const { title, content, images, productId, platforms } = req.body;
    const userId = req.user.id;

    const socialPost = new SocialPost({
      title,
      content,
      images: images || [],
      product: productId,
      platforms: platforms || ['facebook', 'instagram'],
      createdBy: userId
    });

    await socialPost.save();

    // Populate product data
    await socialPost.populate('product', 'title images');
    await socialPost.populate('createdBy', 'firstName lastName');

    res.status(201).json({
      message: 'Social post created successfully',
      post: socialPost
    });
  } catch (error) {
    console.error('Error creating social post:', error);
    res.status(500).json({ message: 'Failed to create social post' });
  }
};

// Get social posts
const getSocialPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;
    const query = { createdBy: userId };

    if (status) query.status = status;

    const posts = await SocialPost.find(query)
      .populate('product', 'title images')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SocialPost.countDocuments(query);

    res.json({
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching social posts:', error);
    res.status(500).json({ message: 'Failed to fetch social posts' });
  }
};

// Update social post
const updateSocialPost = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    const post = await SocialPost.findOneAndUpdate(
      { _id: id, createdBy: userId, status: { $in: ['draft', 'rejected'] } },
      updates,
      { new: true }
    ).populate('product', 'title images');

    if (!post) {
      return res.status(404).json({ message: 'Social post not found or cannot be updated' });
    }

    res.json(post);
  } catch (error) {
    console.error('Error updating social post:', error);
    res.status(500).json({ message: 'Failed to update social post' });
  }
};

// Delete social post
const deleteSocialPost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const post = await SocialPost.findOneAndDelete({
      _id: id,
      createdBy: userId,
      status: { $in: ['draft', 'rejected'] }
    });

    if (!post) {
      return res.status(404).json({ message: 'Social post not found or cannot be deleted' });
    }

    res.json({ message: 'Social post deleted successfully' });
  } catch (error) {
    console.error('Error deleting social post:', error);
    res.status(500).json({ message: 'Failed to delete social post' });
  }
};

// Approve social post (Admin)
const approveSocialPost = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const post = await SocialPost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Social post not found' });
    }

    await post.approve(adminId);

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'UPDATE',
      resource: 'social_post',
      resourceId: id,
      endpoint: `/api/social/${id}/approve`,
      statusCode: 200,
      oldValues: { status: 'pending_approval' },
      newValues: { status: 'approved' }
    });

    res.json({
      message: 'Social post approved successfully',
      post
    });
  } catch (error) {
    console.error('Error approving social post:', error);
    res.status(500).json({ message: 'Failed to approve social post' });
  }
};

// Reject social post (Admin)
const rejectSocialPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    const post = await SocialPost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Social post not found' });
    }

    await post.reject(adminId, reason);

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'UPDATE',
      resource: 'social_post',
      resourceId: id,
      endpoint: `/api/social/${id}/reject`,
      statusCode: 200,
      oldValues: { status: 'pending_approval' },
      newValues: { status: 'rejected', rejectionReason: reason }
    });

    res.json({
      message: 'Social post rejected successfully',
      post
    });
  } catch (error) {
    console.error('Error rejecting social post:', error);
    res.status(500).json({ message: 'Failed to reject social post' });
  }
};

// Publish social post (Admin)
const publishSocialPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { externalIds } = req.body;
    const adminId = req.user.id;

    const post = await SocialPost.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Social post not found' });
    }

    await post.publish(adminId, externalIds);

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'UPDATE',
      resource: 'social_post',
      resourceId: id,
      endpoint: `/api/social/${id}/publish`,
      statusCode: 200,
      oldValues: { status: 'approved' },
      newValues: { status: 'published' }
    });

    res.json({
      message: 'Social post published successfully',
      post
    });
  } catch (error) {
    console.error('Error publishing social post:', error);
    res.status(500).json({ message: 'Failed to publish social post' });
  }
};

// Get social stats
const getSocialStats = async (req, res) => {
  try {
    const stats = await SocialPost.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalEngagement: {
            $sum: {
              $add: ['$engagement.likes', '$engagement.shares', '$engagement.comments']
            }
          }
        }
      }
    ]);

    const statusStats = {};
    let totalEngagement = 0;

    stats.forEach(stat => {
      statusStats[stat._id] = stat.count;
      totalEngagement += stat.totalEngagement;
    });

    res.json({
      statusBreakdown: statusStats,
      totalEngagement,
      totalPosts: stats.reduce((sum, stat) => sum + stat.count, 0)
    });
  } catch (error) {
    console.error('Error fetching social stats:', error);
    res.status(500).json({ message: 'Failed to fetch social stats' });
  }
};

// Update social settings
const updateSocialSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    const adminId = req.user.id;

    // In real implementation, save settings to database
    // For MVP, just log the action

    await AuditLog.logAction({
      user: adminId,
      action: 'UPDATE',
      resource: 'social_settings',
      endpoint: '/api/social/settings',
      statusCode: 200,
      metadata: settings
    });

    res.json({
      message: 'Social settings updated successfully',
      settings
    });
  } catch (error) {
    console.error('Error updating social settings:', error);
    res.status(500).json({ message: 'Failed to update social settings' });
  }
};

// Auto-create social post from product (called internally)
const createAutoSocialPost = async (productId, trigger = 'product_added') => {
  try {
    const product = await Product.findById(productId);
    if (!product) return;

    const post = await SocialPost.createFromProduct(product, trigger);
    console.log(`Auto social post created for product: ${product.title}`);
    return post;
  } catch (error) {
    console.error('Error creating auto social post:', error);
  }
};

// Auto-create social post from sale (called internally)
const createSaleSocialPost = async (orderId) => {
  try {
    const order = await Order.findById(orderId).populate('items.product');
    if (!order || !order.items.length) return;

    const product = order.items[0].product; // Use first product
    const post = await SocialPost.createFromSale(order, product);
    console.log(`Auto social post created for sale: ${product.title}`);
    return post;
  } catch (error) {
    console.error('Error creating sale social post:', error);
  }
};

module.exports = {
  createSocialPost,
  getSocialPosts,
  updateSocialPost,
  deleteSocialPost,
  approveSocialPost,
  rejectSocialPost,
  publishSocialPost,
  getSocialStats,
  updateSocialSettings,
  createAutoSocialPost,
  createSaleSocialPost
};