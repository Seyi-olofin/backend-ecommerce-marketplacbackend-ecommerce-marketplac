const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const AuditLog = require('../models/AuditLog');

// Create review
const createReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, orderId, rating, title, comment, images } = req.body;

    // Validate order and product
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      status: { $in: ['delivered', 'completed'] }
    });

    if (!order) {
      return res.status(400).json({ message: 'Invalid order or order not eligible for review' });
    }

    const productInOrder = order.items.find(item => item.productId === productId);
    if (!productInOrder) {
      return res.status(400).json({ message: 'Product not found in order' });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      user: userId,
      product: productInOrder.product,
      order: orderId
    });

    if (existingReview) {
      return res.status(400).json({ message: 'Review already exists for this product' });
    }

    // Create review
    const review = new Review({
      user: userId,
      product: productInOrder.product,
      order: orderId,
      rating,
      title,
      comment,
      images: images || []
    });

    await review.save();

    // Update product rating
    await updateProductRating(productInOrder.product);

    res.status(201).json({
      message: 'Review submitted successfully and pending approval',
      review
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ message: 'Failed to create review' });
  }
};

// Get product reviews
const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.getApprovedForProduct(productId, limit, (page - 1) * limit);
    const total = await Review.countDocuments({
      product: productId,
      status: 'approved'
    });

    res.json({
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching product reviews:', error);
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
};

// Get user reviews
const getUserReviews = async (req, res) => {
  try {
    const userId = req.user.id;
    const reviews = await Review.find({ user: userId })
      .populate('product', 'title images')
      .populate('order', 'orderNumber')
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    res.status(500).json({ message: 'Failed to fetch user reviews' });
  }
};

// Update review
const updateReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updates = req.body;

    const review = await Review.findOneAndUpdate(
      { _id: id, user: userId, status: 'pending' },
      updates,
      { new: true, runValidators: true }
    );

    if (!review) {
      return res.status(404).json({ message: 'Review not found or cannot be updated' });
    }

    res.json(review);
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ message: 'Failed to update review' });
  }
};

// Delete review
const deleteReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const review = await Review.findOneAndDelete({
      _id: id,
      user: userId,
      status: 'pending'
    });

    if (!review) {
      return res.status(404).json({ message: 'Review not found or cannot be deleted' });
    }

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ message: 'Failed to delete review' });
  }
};

// Approve review (Admin)
const approveReview = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    await review.approve(adminId);

    // Update product rating
    await updateProductRating(review.product);

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'UPDATE',
      resource: 'review',
      resourceId: id,
      endpoint: `/api/reviews/${id}/approve`,
      statusCode: 200,
      oldValues: { status: 'pending' },
      newValues: { status: 'approved' }
    });

    res.json({
      message: 'Review approved successfully',
      review
    });
  } catch (error) {
    console.error('Error approving review:', error);
    res.status(500).json({ message: 'Failed to approve review' });
  }
};

// Reject review (Admin)
const rejectReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    await review.reject(adminId, reason);

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'UPDATE',
      resource: 'review',
      resourceId: id,
      endpoint: `/api/reviews/${id}/reject`,
      statusCode: 200,
      oldValues: { status: 'pending' },
      newValues: { status: 'rejected', moderationReason: reason }
    });

    res.json({
      message: 'Review rejected successfully',
      review
    });
  } catch (error) {
    console.error('Error rejecting review:', error);
    res.status(500).json({ message: 'Failed to reject review' });
  }
};

// Mark review as helpful
const markHelpful = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    await review.markHelpful(userId);

    res.json({
      message: 'Review marked as helpful',
      review
    });
  } catch (error) {
    console.error('Error marking review as helpful:', error);
    res.status(500).json({ message: 'Failed to mark review as helpful' });
  }
};

// Report review
const reportReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { reason } = req.body;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Add report to review
    review.reported.reasons.push({
      user: userId,
      reason,
      reportedAt: new Date()
    });
    review.reported.count = review.reported.reasons.length;
    await review.save();

    res.json({
      message: 'Review reported successfully',
      review
    });
  } catch (error) {
    console.error('Error reporting review:', error);
    res.status(500).json({ message: 'Failed to report review' });
  }
};

// Helper function to update product rating
const updateProductRating = async (productId) => {
  try {
    const ratingData = await Review.getAverageRating(productId);
    await Product.findByIdAndUpdate(productId, {
      rating: ratingData.averageRating,
      reviewCount: ratingData.totalReviews
    });
  } catch (error) {
    console.error('Error updating product rating:', error);
  }
};

module.exports = {
  createReview,
  getProductReviews,
  getUserReviews,
  updateReview,
  deleteReview,
  approveReview,
  rejectReview,
  markHelpful,
  reportReview
};