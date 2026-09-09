const PasswordResetRequest = require('../models/PasswordResetRequest');
const ActivityLog = require('../models/ActivityLog');
const crypto = require('crypto');
const { notify } = require('../utils/notificationService');
const { sendResetApprovedEmail, sendResetRejectedEmail } = require('../utils/emailService');
const logActivity = async (userId, action, description, extras = {}) => {
  try {
    await ActivityLog.create({
      user: userId,
      action,
      description,
      ...extras
    });
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
};

// @desc    Get all password reset requests
// @route   GET /api/reset-requests
// @access  Private/Admin
const getResetRequests = async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};
    if (status) query.status = status;

    const requests = await PasswordResetRequest.find(query)
      .populate('user', 'name email role')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (error) {
    console.error('Get reset requests error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Approve password reset request
// @route   PUT /api/reset-requests/:id/approve
// @access  Private/Admin
const approveResetRequest = async (req, res) => {
  try {
    const request = await PasswordResetRequest.findById(req.params.id)
      .populate('user', 'name email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Request is already ${request.status}`
      });
    }

    // Generate reset token — valid for 1 hour
    const resetToken = crypto.randomBytes(32).toString('hex');

    request.status = 'approved';
    request.approvedBy = req.user._id;
    request.approvedAt = new Date();
    request.resetToken = resetToken;
    request.resetTokenExpire = new Date(Date.now() + 60 * 60 * 1000);
    await request.save();

    await logActivity(req.user._id, 'user_update',
      `Password reset request approved for: ${request.email}`, {
        resourceType: 'user',
        resourceId: request.user._id,
        resourceName: request.user.name
      });

    // Notify the user whose reset was approved
    await notify(request.user._id, {
      type: 'reset_approved',
      title: 'Password reset approved',
      message: 'Your password reset request has been approved. You can now reset your password.',
      icon: 'shield',
      link: '/forgot-password',
      priority: 'medium',
      metadata: { email: request.email }
    });

    try {
      await sendResetApprovedEmail(request.user);
    } catch (emailErr) {
      console.error('Reset approved email error:', emailErr.message);
    }

    res.status(200).json({
      success: true,
      message: `Password reset approved for ${request.email}. They can now reset their password.`
    });

  } catch (error) {
    console.error('Approve reset request error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Reject password reset request
// @route   PUT /api/reset-requests/:id/reject
// @access  Private/Admin
const rejectResetRequest = async (req, res) => {
  try {
    const { reason } = req.body;

    const request = await PasswordResetRequest.findById(req.params.id)
      .populate('user', 'name email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Request is already ${request.status}`
      });
    }

    request.status = 'rejected';
    request.rejectedReason = reason || 'Request rejected by administrator';
    request.approvedBy = req.user._id;
    request.approvedAt = new Date();
    await request.save();

    await logActivity(req.user._id, 'user_update',
      `Password reset request rejected for: ${request.email}`, {
        resourceType: 'user',
        resourceId: request.user._id,
        resourceName: request.user.name
      });

    // Notify the user — this was previously missing entirely
    await notify(request.user._id, {
      type: 'reset_rejected',
      title: 'Password reset rejected',
      message: request.rejectedReason,
      icon: 'x',
      link: '/login',
      priority: 'medium',
      metadata: { email: request.email }
    });

    try {
      await sendResetRejectedEmail(request.user, request.rejectedReason);
    } catch (emailErr) {
      console.error('Reset rejected email error:', emailErr.message);
    }

    res.status(200).json({
      success: true,
      message: `Password reset request rejected for ${request.email}`
    });

  } catch (error) {
    console.error('Reject reset request error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getResetRequests,
  approveResetRequest,
  rejectResetRequest
};
