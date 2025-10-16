const Vendor = require('../models/Vendor');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// Create vendor application
const createVendor = async (req, res) => {
  try {
    const userId = req.user.id;
    const { businessName, description, contactInfo, commissionRate } = req.body;

    // Check if user already has a vendor profile
    const existingVendor = await Vendor.findOne({ user: userId });
    if (existingVendor) {
      return res.status(400).json({ message: 'Vendor profile already exists' });
    }

    // Create vendor profile
    const vendor = new Vendor({
      user: userId,
      businessName,
      description,
      contactInfo,
      commissionRate: commissionRate || 0.1
    });

    await vendor.save();

    // Update user role to vendor
    await User.findByIdAndUpdate(userId, { role: 'vendor' });

    // Log action
    await AuditLog.logAction({
      user: userId,
      action: 'CREATE',
      resource: 'vendor',
      resourceId: vendor._id,
      endpoint: '/api/vendors/apply',
      statusCode: 201
    });

    res.status(201).json({
      message: 'Vendor application submitted successfully',
      vendor
    });
  } catch (error) {
    console.error('Error creating vendor:', error);
    res.status(500).json({ message: 'Failed to create vendor profile' });
  }
};

// Get vendor profile
const getVendorProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const vendor = await Vendor.findOne({ user: userId }).populate('user', 'firstName lastName email');

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }

    res.json(vendor);
  } catch (error) {
    console.error('Error fetching vendor profile:', error);
    res.status(500).json({ message: 'Failed to fetch vendor profile' });
  }
};

// Update vendor profile
const updateVendorProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    const vendor = await Vendor.findOneAndUpdate(
      { user: userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor profile not found' });
    }

    // Log action
    await AuditLog.logAction({
      user: userId,
      action: 'UPDATE',
      resource: 'vendor',
      resourceId: vendor._id,
      endpoint: '/api/vendors/profile',
      statusCode: 200,
      oldValues: {},
      newValues: updates
    });

    res.json(vendor);
  } catch (error) {
    console.error('Error updating vendor profile:', error);
    res.status(500).json({ message: 'Failed to update vendor profile' });
  }
};

// Get all vendors (Admin)
const getVendors = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    const vendors = await Vendor.find(query)
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Vendor.countDocuments(query);

    res.json({
      vendors,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ message: 'Failed to fetch vendors' });
  }
};

// Approve vendor
const approveVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const vendor = await Vendor.findByIdAndUpdate(
      id,
      { status: 'approved' },
      { new: true }
    ).populate('user', 'firstName lastName email');

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'UPDATE',
      resource: 'vendor',
      resourceId: id,
      endpoint: `/api/vendors/${id}/approve`,
      statusCode: 200,
      oldValues: { status: vendor.status },
      newValues: { status: 'approved' }
    });

    res.json({
      message: 'Vendor approved successfully',
      vendor
    });
  } catch (error) {
    console.error('Error approving vendor:', error);
    res.status(500).json({ message: 'Failed to approve vendor' });
  }
};

// Reject vendor
const rejectVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const vendor = await Vendor.findByIdAndUpdate(
      id,
      { status: 'blocked' },
      { new: true }
    );

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'UPDATE',
      resource: 'vendor',
      resourceId: id,
      endpoint: `/api/vendors/${id}/reject`,
      statusCode: 200,
      oldValues: { status: vendor.status },
      newValues: { status: 'blocked' }
    });

    res.json({
      message: 'Vendor rejected successfully',
      vendor
    });
  } catch (error) {
    console.error('Error rejecting vendor:', error);
    res.status(500).json({ message: 'Failed to reject vendor' });
  }
};

// Get vendor products
const getVendorProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const Product = require('../models/Product');

    const products = await Product.find({ vendor: id })
      .sort({ createdAt: -1 });

    res.json(products);
  } catch (error) {
    console.error('Error fetching vendor products:', error);
    res.status(500).json({ message: 'Failed to fetch vendor products' });
  }
};

// Get vendor earnings
const getVendorEarnings = async (req, res) => {
  try {
    const { id } = req.params;
    const vendor = await Vendor.findById(id);

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    res.json({
      totalEarnings: vendor.totalEarnings,
      totalPaid: vendor.totalPaid,
      pendingPayout: vendor.pendingPayout
    });
  } catch (error) {
    console.error('Error fetching vendor earnings:', error);
    res.status(500).json({ message: 'Failed to fetch vendor earnings' });
  }
};

// Process vendor payout
const processVendorPayout = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const adminId = req.user.id;

    const vendor = await Vendor.findById(id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    if (amount > vendor.pendingPayout) {
      return res.status(400).json({ message: 'Payout amount exceeds pending earnings' });
    }

    await vendor.processPayout(amount);

    // Log action
    await AuditLog.logAction({
      user: adminId,
      action: 'CREATE',
      resource: 'vendor_payout',
      resourceId: id,
      endpoint: `/api/vendors/${id}/payout`,
      statusCode: 200,
      metadata: { amount }
    });

    res.json({
      message: 'Payout processed successfully',
      vendor
    });
  } catch (error) {
    console.error('Error processing vendor payout:', error);
    res.status(500).json({ message: 'Failed to process payout' });
  }
};

module.exports = {
  createVendor,
  getVendorProfile,
  updateVendorProfile,
  getVendors,
  approveVendor,
  rejectVendor,
  getVendorProducts,
  getVendorEarnings,
  processVendorPayout
};