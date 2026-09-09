const User = require('../models/User');
const File = require('../models/File');
const Folder = require('../models/Folder');
const ActivityLog = require('../models/ActivityLog');
const { escapeRegExp } = require('../utils/regexUtil');
const { validateName, validatePassword } = require('../utils/validation');
const { notify } = require('../utils/notificationService');
const { sendRegistrationApprovedEmail, sendRegistrationRejectedEmail } = require('../utils/emailService');
// Log activity helper
const logActivity = async (userId, action, description, req, extras = {}) => {
  try {
    await ActivityLog.create({
      user: userId,
      action,
      description,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      ...extras
    });
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
};

// Returns true when <userId> is currently the only active, approved admin, so
// demoting/deactivating/deleting them would lock the system out of all admin
// functions with no recovery path short of direct DB edits.
const isSoleActiveAdmin = async (userId) => {
  const others = await User.countDocuments({
    _id: { $ne: userId },
    role: 'admin',
    registrationStatus: { $nin: ['pending', 'rejected'] },
    isActive: true
  });
  return others === 0;
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;

    let query = { registrationStatus: { $nin: ['pending', 'rejected'] } };

    if (search) {
      const safe = escapeRegExp(search);
      query.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { email: { $regex: safe, $options: 'i' } }
      ];
    }

    if (role) {
      query.role = role;
    }

    const skip = (page - 1) * limit;

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      users
    });

  } catch (error) {
    console.error('Get users error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users'
    });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Get user error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user'
    });
  }
};

// @desc    Create user (Admin only)
// @route   POST /api/users
// @access  Private/Admin
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, storageLimit } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
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

    // Validate storageLimit if provided
    if (storageLimit !== undefined) {
      const limitError = validateStorageLimit(storageLimit);
      if (limitError) {
        return res.status(400).json({ success: false, message: limitError });
      }
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'employee',
      ...(storageLimit !== undefined && { storageLimit }),
      createdBy: req.user.id
    });

    await logActivity(req.user.id, 'user_create',
      `New user created: ${email} with role ${role || 'employee'}`,
      req, {
        resourceType: 'user',
        resourceId: user._id,
        resourceName: name
      });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        storageUsed: user.storageUsed,
        storageLimit: user.storageLimit,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Create user error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while creating user'
    });
  }
};

// Storage limit bounds — 1GB minimum, 10TB maximum
const MIN_STORAGE_LIMIT = 1024 * 1024 * 1024; // 1GB in bytes
const MAX_STORAGE_LIMIT = 10 * 1024 * 1024 * 1024 * 1024; // 10TB in bytes

// Validate that a storageLimit (in bytes) is a positive integer within bounds.
// Returns an error message string, or null if valid.
const validateStorageLimit = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || Number.isNaN(value)) {
    return 'Storage limit must be a number';
  }
  if (!Number.isInteger(value)) {
    return 'Storage limit must be a whole number of bytes';
  }
  if (value < MIN_STORAGE_LIMIT) {
    return 'Storage limit must be at least 1GB';
  }
  if (value > MAX_STORAGE_LIMIT) {
    return 'Storage limit cannot exceed 10TB';
  }
  return null;
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
  try {
    const { name, email, role, isActive, storageLimit } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deactivating themselves
    if (req.params.id === req.user.id && isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account'
      });
    }

    // Last-admin guard: never let an update stop an active approved admin from
    // being one (demotion or deactivation) when they are the last one.
    const stillAdmin = (role || user.role) === 'admin';
    const stillActive = isActive !== undefined ? isActive : user.isActive;
    const isActiveApprovedAdmin = user.role === 'admin' &&
      user.registrationStatus !== 'pending' &&
      user.registrationStatus !== 'rejected' &&
      user.isActive;
    if (isActiveApprovedAdmin && (!stillAdmin || !stillActive) && (await isSoleActiveAdmin(user._id))) {
      return res.status(400).json({
        success: false,
        message: 'Cannot demote or deactivate the last active administrator'
      });
    }

    // Validate storageLimit if provided
    if (storageLimit !== undefined) {
      const limitError = validateStorageLimit(storageLimit);
      if (limitError) {
        return res.status(400).json({ success: false, message: limitError });
      }
    }

    // Validate name if provided and changed
    if (name && name !== user.name) {
      const nameError = validateName(name);
      if (nameError) {
        return res.status(400).json({ success: false, message: nameError });
      }
    }

    // Track what changed
    const changes = [];
    if (name && name !== user.name) changes.push(`name: ${user.name} → ${name}`);
    if (email && email !== user.email) changes.push(`email: ${user.email} → ${email}`);
    if (role && role !== user.role) changes.push(`role: ${user.role} → ${role}`);
    if (isActive !== undefined && isActive !== user.isActive) changes.push(`status: ${user.isActive ? 'active' : 'inactive'} → ${isActive ? 'active' : 'inactive'}`);
    if (storageLimit !== undefined && storageLimit !== user.storageLimit) changes.push(`storageLimit: ${user.storageLimit} → ${storageLimit}`);

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      {
        ...(name && { name }),
        ...(email && { email }),
        ...(role && { role }),
        ...(isActive !== undefined && { isActive }),
        ...(storageLimit !== undefined && { storageLimit })
      },
      { returnDocument: 'after', runValidators: true }
    ).select('-password');

    await logActivity(req.user.id, 'user_update',
      `User updated: ${updatedUser.email} — Changes: ${changes.join(', ')}`,
      req, {
        resourceType: 'user',
        resourceId: updatedUser._id,
        resourceName: updatedUser.name,
        metadata: { changes }
      });

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Update user error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while updating user'
    });
  }
};

// @desc    Deactivate user
// @route   PUT /api/users/:id/deactivate
// @access  Private/Admin
const deactivateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deactivating themselves
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account'
      });
    }

    // Last-admin guard: never deactivate the last active administrator
    const isActiveApprovedAdmin = user.role === 'admin' &&
      user.registrationStatus !== 'pending' &&
      user.registrationStatus !== 'rejected' &&
      user.isActive;
    if (isActiveApprovedAdmin && (await isSoleActiveAdmin(user._id))) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate the last active administrator'
      });
    }

    user.isActive = false;
    await user.save();

    await logActivity(req.user.id, 'user_deactivate',
      `User deactivated: ${user.email}`,
      req, {
        resourceType: 'user',
        resourceId: user._id,
        resourceName: user.name
      });

    res.status(200).json({
      success: true,
      message: 'User deactivated successfully'
    });

  } catch (error) {
    console.error('Deactivate user error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while deactivating user'
    });
  }
};

// @desc    Delete user permanently
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deleting themselves
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }
    
    // Protected system account — cannot be deleted by any admin, including itself
    if (user.email.toLowerCase() === 'admin@cloudsewa.com') {
      return res.status(400).json({
        success: false,
        message: 'This account is protected and cannot be deleted'
      });
    }
     
    // Only the protected system account may delete other admin accounts —
    // regular admins may only remove Employee accounts
    if (user.role === 'admin') {
      const requestingAdmin = await User.findById(req.user.id).select('email');
      if (!requestingAdmin || requestingAdmin.email.toLowerCase() !== 'admin@cloudsewa.com') {
        return res.status(403).json({
          success: false,
          message: 'Only the system administrator account can remove admin accounts'
        });
      }
    }

    // Last-admin guard: never delete the last active administrator
    const isActiveApprovedAdmin = user.role === 'admin' &&
      user.registrationStatus !== 'pending' &&
      user.registrationStatus !== 'rejected' &&
      user.isActive;
    if (isActiveApprovedAdmin && (await isSoleActiveAdmin(user._id))) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the last active administrator'
      });
    }

    const adminId = req.user.id;

    // Collect total bytes being reassigned (live blob + distinct version blobs)
    let reassignedSize = 0;
    const reassignPaths = new Set();
    const files = await File.find({ owner: user._id });
    for (const file of files) {
      if (!reassignPaths.has(file.storagePath)) {
        reassignPaths.add(file.storagePath);
        reassignedSize += Number(file.size) || 0;
      }
      for (const v of file.versions) {
        if (!reassignPaths.has(v.storagePath)) {
          reassignPaths.add(v.storagePath);
          reassignedSize += Number(v.size) || 0;
        }
      }
    }

    // Reassign files to the deleting admin so company data is preserved
    if (files.length) {
      await File.updateMany(
        { owner: user._id },
        { $set: { owner: adminId } }
      );
    }

    // Reassign folders (and their subtrees) to the admin
    const folders = await Folder.find({ owner: user._id });
    if (folders.length) {
      await Folder.updateMany(
        { owner: user._id },
        { $set: { owner: adminId } }
      );
    }

    // Remove the deleted user from any file/folder share lists so no
    // references dangle to a now-nonexistent user.
    const removedRefs =
      (await File.updateMany(
        { sharedWith: user._id },
        { $pull: { sharedWith: user._id } }
      )).modifiedCount +
      (await Folder.updateMany(
        { sharedWith: user._id },
        { $pull: { sharedWith: user._id } }
      )).modifiedCount;

    // Move the reassigned storage to the admin
    if (reassignedSize > 0) {
      await User.updateOne(
        { _id: adminId },
        { $inc: { storageUsed: reassignedSize } }
      );
    }

    await logActivity(req.user.id, 'user_delete',
      `User permanently deleted: ${user.email} — ${files.length} file(s) and ${folders.length} folder(s) reassigned to you${removedRefs ? `; removed from ${removedRefs} share list(s)` : ''}`,
      req, {
        resourceType: 'user',
        resourceId: user._id,
        resourceName: user.name
      });

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: `User permanently deleted. ${files.length} file(s) and ${folders.length} folder(s) were reassigned to you.` + (removedRefs ? ` Removed from ${removedRefs} share list(s).` : '')
    });

  } catch (error) {
    console.error('Delete user error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting user'
    });
  }
};

// @desc    Reset user login attempts (unlock account)
// @route   PUT /api/users/:id/unlock
// @access  Private/Admin
const unlockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    await logActivity(req.user.id, 'user_update',
      `Account unlocked for: ${user.email}`,
      req, {
        resourceType: 'user',
        resourceId: user._id,
        resourceName: user.name
      });

    res.status(200).json({
      success: true,
      message: 'User account unlocked successfully'
    });

  } catch (error) {
    console.error('Unlock user error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while unlocking user'
    });
  }
};

// @desc    Get pending registration requests
// @route   GET /api/users/pending
// @access  Private/Admin
const getPendingRegistrations = async (req, res) => {
  try {
    const users = await User.find({ registrationStatus: 'pending' })
      .select('-password')
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Get pending registrations error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching pending registrations'
    });
  }
};

// @desc    Get rejected registration requests
// @route   GET /api/users/rejected
// @access  Private/Admin
const getRejectedRegistrations = async (req, res) => {
  try {
    const users = await User.find({ registrationStatus: 'rejected' })
      .select('-password')
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Get rejected registrations error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching rejected registrations'
    });
  }
};

// @desc    Approve a pending registration
// @route   PUT /api/users/:id/approve
// @access  Private/Admin
const approveRegistration = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.registrationStatus !== 'pending' && user.registrationStatus !== 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'This registration is not pending or rejected'
      });
    }

    user.registrationStatus = 'approved';
    user.registrationRejectedReason = '';
    if (user.isActive === false) {
      user.isActive = true;
    }
    await user.save();

    await notify(user._id, {
      type: 'registration_approved',
      title: 'Account approved',
      message: `Your CloudSewa account has been approved by an administrator. You can now sign in.`,
      icon: 'check',
      link: '/login',
      priority: 'high',
      metadata: { approvedBy: String(req.user.id) }
    });

    try {
      await sendRegistrationApprovedEmail(user);
    } catch (emailErr) {
      console.error('Registration approved email error:', emailErr.message);
    }

    await logActivity(req.user.id, 'user_update',
      `Registration approved for: ${user.email}`,
      req, {
        resourceType: 'user',
        resourceId: user._id,
        resourceName: user.name
      });

    res.status(200).json({
      success: true,
      message: 'Registration approved',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        registrationStatus: user.registrationStatus
      }
    });
  } catch (error) {
    console.error('Approve registration error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while approving registration'
    });
  }
};

// @desc    Reject a pending registration
// @route   PUT /api/users/:id/reject
// @access  Private/Admin
const rejectRegistration = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.registrationStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This registration is not pending approval'
      });
    }

    user.registrationStatus = 'rejected';
    user.isActive = false;
    const reason = typeof req.body?.reason === 'string' && req.body.reason.trim()
      ? req.body.reason.trim().slice(0, 300)
      : 'Registration rejected by administrator';
    user.registrationRejectedReason = reason;
    await user.save();

    await notify(user._id, {
      type: 'registration_rejected',
      title: 'Registration rejected',
      message: reason,
      icon: 'x',
      link: '/login',
      priority: 'high',
      metadata: { rejectedBy: String(req.user.id) }
    });

    try {
      await sendRegistrationRejectedEmail(user, reason);
    } catch (emailErr) {
      console.error('Registration rejected email error:', emailErr.message);
    }

    await logActivity(req.user.id, 'user_update',
      `Registration rejected for: ${user.email}`,
      req, {
        resourceType: 'user',
        resourceId: user._id,
        resourceName: user.name
      });

    res.status(200).json({
      success: true,
      message: 'Registration rejected'
    });
  } catch (error) {
    console.error('Reject registration error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while rejecting registration'
    });
  }
};

module.exports = {
  getUsers,
  getUser,
  getPendingRegistrations,
  getRejectedRegistrations,
  createUser,
  updateUser,
  deactivateUser,
  deleteUser,
  unlockUser,
  approveRegistration,
  rejectRegistration
};
