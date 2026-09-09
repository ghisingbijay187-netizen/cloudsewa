const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendRegistrationPendingEmail } = require('../utils/emailService');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { validateName, validatePassword } = require('../utils/validation');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Log activity helper
const logActivity = async (userId, action, description, req = null, extras = {}) => {
  try {
    await ActivityLog.create({
      user: userId,
      action,
      description,
      ipAddress: req ? (req.ip || null) : null,
      userAgent: req ? (req.headers?.['user-agent'] || null) : null,
      ...extras
    });
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public (first admin) / Private (admin only for employees)
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate string types to prevent NoSQL injection via query operators
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request format'
      });
    }

    // Validate name and password
    const nameError = validateName(name);
    if (nameError) {
      return res.status(400).json({ success: false, message: nameError });
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    // First user becomes admin; all subsequent public registrations are employees
    // whose accounts must be approved by an admin before they can sign in.
    // Role is intentionally not read from the request body to prevent privilege escalation.
    const userCount = await User.countDocuments();
    const isFirstUser = userCount === 0;
    const assignedRole = isFirstUser ? 'admin' : 'employee';
    const registrationStatus = isFirstUser ? 'approved' : 'pending';
    const registrationToken = isFirstUser ? null : crypto.randomBytes(32).toString('hex');

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: assignedRole,
      registrationStatus,
      registrationToken,
      createdBy: null
    });

    // Log activity
    await logActivity(user._id, 'register', `New user registered: ${email}`, req, {
      resourceType: 'user',
      resourceId: user._id,
      resourceName: name,
      registrationStatus
    });

    // If this registration needs admin approval, notify all admins and do NOT
    // issue a token — the user must wait for approval before signing in.
    if (registrationStatus === 'pending') {
      const { notifyMany } = require('../utils/notificationService');
      const admins = await User.find({ role: 'admin', registrationStatus: { $nin: ['pending', 'rejected'] } }).select('_id');
      await notifyMany(admins.map((a) => a._id), {
        type: 'registration_request',
        title: 'New registration awaiting approval',
        message: `${name} (${email}) registered and is waiting for your approval.`,
        icon: 'user',
        link: '/admin',
        priority: 'high',
        metadata: { userId: String(user._id) }
      });

      try {
        await sendRegistrationPendingEmail(user);
      } catch (emailErr) {
        console.error('Registration pending email error:', emailErr.message);
      }

      return res.status(201).json({
        success: true,
        message: 'Account created. An administrator must approve your account before you can sign in.',
        userId: user._id,
        registrationToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          registrationStatus,
          createdAt: user.createdAt
        }
      });
    }

    // Generate token (first user / admin)
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        registrationStatus: user.registrationStatus,
        storageUsed: user.storageUsed,
        storageLimit: user.storageLimit,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email and password provided and are strings (prevents NoSQL injection)
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user and include password
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is locked
    if (user.isLocked()) {
      await logActivity(user._id, 'account_locked',
        `Login attempt on locked account: ${email}`, req, {
          resourceType: 'auth'
        });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check registration approval status (before isActive, so rejected/pending
    // users get the accurate message instead of "deactivated")
    if (user.registrationStatus === 'pending') {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    if (user.registrationStatus === 'rejected') {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      // Increment login attempts
      await user.incrementLoginAttempts();

      await logActivity(user._id, 'login_failed',
        `Failed login attempt for: ${email}`, req, {
          resourceType: 'auth'
        });

      // If this attempt triggered the lockout, return the same generic message
      // so we don't reveal the email exists or that the password was correct.
      if (user.isLocked()) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      const remainingAttempts = 5 - user.loginAttempts;
      return res.status(401).json({
        success: false,
        message: `Invalid email or password. ${remainingAttempts} attempts remaining before account lockout`
      });
    }

    // Reset login attempts on success
    await user.resetLoginAttempts();

    // Log successful login
    await logActivity(user._id, 'login',
      `User logged in: ${email}`, req, {
        resourceType: 'auth'
      });

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        storageUsed: user.storageUsed,
        storageLimit: user.storageLimit,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        storageUsed: user.storageUsed,
        storageLimit: user.storageLimit,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('GetMe error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Check registration approval status (mirrors the forgot-password
//          status page — requires the token issued at registration time)
// @route   GET /api/auth/registration-status/:userId
// @access  Public
const checkRegistrationStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { token } = req.query;

    if (!userId || typeof token !== 'string' || !token) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status check request'
      });
    }

    const user = await User.findById(userId).select(
      '+registrationToken registrationStatus registrationRejectedReason'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    if (!user.registrationToken || token !== user.registrationToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    res.status(200).json({
      success: true,
      status: user.registrationStatus,
      rejectedReason: user.registrationRejectedReason || ''
    });
  } catch (error) {
    console.error('Check registration status error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    await logActivity(req.user._id, 'logout',
      `User logged out: ${req.user.email}`, req, {
        resourceType: 'auth'
      });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
};

// @desc    Update password
// @route   PUT /api/auth/password
// @access  Private
const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters'
      });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    // Log activity
    await logActivity(user._id, 'password_change',
      `Password changed for: ${user.email}`, req, {
        resourceType: 'user',
        resourceId: user._id
      });

    // Generate new token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
      token
    });

  } catch (error) {
    console.error('Update password error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during password update'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name } = req.body;

    const nameError = validateName(name);
    if (nameError) {
      return res.status(400).json({ success: false, message: nameError });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name },
      { returnDocument: 'after', runValidators: true }
    );

    await logActivity(user._id, 'settings_update',
      `Profile updated for: ${user.email}`, req, {
        resourceType: 'user',
        resourceId: user._id
      });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        storageUsed: user.storageUsed,
        storageLimit: user.storageLimit
      }
    });

  } catch (error) {
    console.error('Update profile error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during profile update'
    });
  }
};

// @desc    Submit password reset request (no email — admin approval required)
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please provide your email address'
      });
    }

    const user = await User.findOne({ email, isActive: true });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, your request has been submitted.'
      });
    }

    const PasswordResetRequest = require('../models/PasswordResetRequest');

    // Poll token: high entropy and not derived from the _id, so it can't be enumerated.
    const requestToken = crypto.randomBytes(32).toString('hex');

    // Check if there is already a pending request
    const existingRequest = await PasswordResetRequest.findOne({
      user: user._id,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(200).json({
        success: true,
        status: 'pending',
        requestId: existingRequest._id,
        requestToken,
        message: 'You already have a pending password reset request. Please wait for admin approval.'
      });
    }

    // Create new request
    const request = await PasswordResetRequest.create({
      user: user._id,
      email: user.email,
      requestToken
    });

    // Notify admins
    const { notifyMany } = require('../utils/notificationService');
    const { sendResetRequestPendingEmail } = require('../utils/emailService');
    const admins = await User.find({ role: 'admin', registrationStatus: { $nin: ['pending', 'rejected'] } }).select('_id');
    await notifyMany(admins.map((a) => a._id), {
      type: 'reset_request',
      title: 'Password reset request awaiting approval',
      message: `${user.name} (${user.email}) has requested a password reset.`,
      icon: 'shield',
      link: '/admin',
      priority: 'high',
      metadata: { userId: String(user._id) }
    });
    try {
      await sendResetRequestPendingEmail(user);
    } catch (emailErr) {
      console.error('Reset request pending email error:', emailErr.message);
    }

    res.status(200).json({
      success: true,
      status: 'pending',
      requestId: request._id,
      requestToken,
      message: 'Your password reset request has been submitted. Please wait for admin approval.'
    });

  } catch (error) {
    console.error('Forgot password error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.'
    });
  }
};

// @desc    Check password reset request status
// @route   GET /api/auth/reset-status/:requestId
// @access  Public
const checkResetStatus = async (req, res) => {
  try {
    const { requestToken } = req.query;
    const PasswordResetRequest = require('../models/PasswordResetRequest');

    const request = await PasswordResetRequest.findById(req.params.requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found or expired'
      });
    }

    // Require the request token issued at submission time. Without it we
    // only report harmless public state; the reset token is never revealed.
    const isVerified = Boolean(requestToken) && requestToken === request.requestToken;

    res.status(200).json({
      success: true,
      status: request.status,
      rejectedReason: request.rejectedReason,
      resetToken: isVerified && request.status === 'approved' && !request.used
        ? request.resetToken
        : null
    });

  } catch (error) {
    console.error('Check reset status error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Reset password using approved token
// @route   PUT /api/auth/reset-password/:token
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const { token } = req.params;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a new password'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }

    const PasswordResetRequest = require('../models/PasswordResetRequest');

    const request = await PasswordResetRequest.findOne({
      resetToken: token,
      status: 'approved',
      used: false,
      resetTokenExpire: { $gt: Date.now() }
    });

    if (!request) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token. Please submit a new request.'
      });
    }

    // Update password
    const user = await User.findById(request.user);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.password = password;
    user.loginAttempts = 0;
    user.lockUntil = null;
    user.passwordChangedAt = new Date();
    await user.save();

    // Mark request as used
    request.used = true;
    await request.save();

    await logActivity(user._id, 'password_change',
      `Password reset via admin approval for: ${user.email}`,
      req, {
        resourceType: 'user',
        resourceId: user._id
      });

    const jwtToken = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now log in.',
      token: jwtToken
    });

  } catch (error) {
    console.error('Reset password error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset'
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  logout,
  updatePassword,
  updateProfile,
  forgotPassword,
  checkResetStatus,
  checkRegistrationStatus,
  resetPassword
};
