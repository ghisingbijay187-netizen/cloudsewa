const User = require('../models/User');
const File = require('../models/File');
const Folder = require('../models/Folder');
const Backup = require('../models/Backup');
const ActivityLog = require('../models/ActivityLog');
const Settings = require('../models/Settings');
const { sendStorageWarningEmail } = require('../utils/emailService');
const { notifyMany } = require('../utils/notificationService');

// @desc    Get dashboard stats
// @route   GET /api/dashboard/stats
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
  try {
    // Total users (approved registrations only — pending/rejected don't count).
    // $nin also matches legacy users created before registrationStatus existed
    // (they are effectively approved).
    const totalUsers = await User.countDocuments({ registrationStatus: { $nin: ['pending', 'rejected'] } });
    const activeUsers = await User.countDocuments({ isActive: true, registrationStatus: { $nin: ['pending', 'rejected'] } });

    // Total files
    const totalFiles = await File.countDocuments({ isDeleted: false });
    const trashedFiles = await File.countDocuments({ isDeleted: true });
    const trashedFolders = await Folder.countDocuments({ isDeleted: true });

    // Total storage used across all users
    const storageResult = await User.aggregate([
      {
        $group: {
          _id: null,
          totalStorageUsed: { $sum: '$storageUsed' },
          totalStorageLimit: { $sum: '$storageLimit' }
        }
      }
    ]);

    const totalStorageUsed = storageResult[0]?.totalStorageUsed || 0;
    const totalStorageLimit = storageResult[0]?.totalStorageLimit || 0;
    const storagePercentage = totalStorageLimit > 0
      ? Math.round((totalStorageUsed / totalStorageLimit) * 100)
      : 0;

    // Send storage warning if above 80%, but only once per day to avoid
    // spamming the admin on every dashboard load.
    if (storagePercentage >= 80) {
      const usedGB = (totalStorageUsed / 1024 / 1024 / 1024).toFixed(2);
      const totalGB = (totalStorageLimit / 1024 / 1024 / 1024).toFixed(2);

      let warningSetting = await Settings.findOne({ key: 'lastStorageWarningAt' });
      const lastSent = warningSetting ? new Date(warningSetting.value) : 0;
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

      if (!lastSent || lastSent.getTime() < oneDayAgo) {
        try {
          await sendStorageWarningEmail(storagePercentage, usedGB, totalGB);
          // Notify all admins about the low-storage condition
          const admins = await User.find({ role: 'admin' }).select('_id');
          await notifyMany(admins.map(a => a._id), {
            type: 'storage_warning',
            title: 'Storage warning',
            message: `Storage usage has reached ${storagePercentage}% (${usedGB} GB of ${totalGB} GB). Please free up space or expand storage.`,
            icon: 'alert',
            link: '/storage',
            priority: 'high',
            metadata: { percentage: storagePercentage }
          });
          if (warningSetting) {
            warningSetting.value = new Date();
            await warningSetting.save();
          } else {
            await Settings.create({ key: 'lastStorageWarningAt', value: new Date() });
          }
        } catch (emailErr) {
          console.error('Storage warning email error:', emailErr.message);
        }
      }
    }

    // Backup stats
    const totalBackups = await Backup.countDocuments();
    const lastBackup = await Backup.findOne({ status: 'completed' })
      .sort({ completedAt: -1 });
    const failedBackups = await Backup.countDocuments({
      status: 'failed',
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    // Recent activity — last 10 logs
    const recentActivity = await ActivityLog.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(10);

    // File uploads in last 7 days
    const uploadsThisWeek = await File.countDocuments({
      isDeleted: false,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    // Files by type
    const filesByType = await File.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: '$mimetype',
          count: { $sum: 1 },
          totalSize: { $sum: '$size' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    res.status(200).json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers
        },
        files: {
          total: totalFiles,
          trashed: trashedFiles + trashedFolders,
          trashedFolders,
          uploadsThisWeek
        },
        storage: {
          used: totalStorageUsed,
          limit: totalStorageLimit,
          percentage: storagePercentage,
          usedGB: (totalStorageUsed / 1024 / 1024 / 1024).toFixed(2),
          limitGB: (totalStorageLimit / 1024 / 1024 / 1024).toFixed(2)
        },
        backups: {
          total: totalBackups,
          failedThisWeek: failedBackups,
          lastBackup: lastBackup ? {
            name: lastBackup.name,
            type: lastBackup.type,
            completedAt: lastBackup.completedAt,
            totalFiles: lastBackup.totalFiles,
            totalSize: lastBackup.totalSize
          } : null
        },
        filesByType,
        recentActivity
      }
    });

  } catch (error) {
    console.error('Dashboard stats error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard stats'
    });
  }
};

// @desc    Get activity logs
// @route   GET /api/dashboard/activity
// @access  Private/Admin
const getActivityLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      action,
      userId,
      startDate,
      endDate
    } = req.query;

    let query = {};

    if (action) query.action = action;
    if (userId) query.user = userId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Non-admin users can only see their own logs
    if (req.user.role !== 'admin') {
      query.user = req.user.id;
    }

    const skip = (page - 1) * limit;

    const logs = await ActivityLog.find(query)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ActivityLog.countDocuments(query);

    const [counts] = await ActivityLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          fileOps: { $sum: { $cond: [{ $regexMatch: { input: '$action', regex: /^file_/ } }, 1, 0] } },
          authEvents: { $sum: { $cond: [{ $in: ['$action', ['login', 'logout', 'login_failed', 'account_locked']] }, 1, 0] } },
          backupEvents: { $sum: { $cond: [{ $regexMatch: { input: '$action', regex: /^backup_/ } }, 1, 0] } }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      count: logs.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      counts: counts
        ? { fileOps: counts.fileOps, authEvents: counts.authEvents, backupEvents: counts.backupEvents }
        : { fileOps: 0, authEvents: 0, backupEvents: 0 },
      logs
    });

  } catch (error) {
    console.error('Activity logs error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching activity logs'
    });
  }
};

// @desc    Get storage stats per user
// @route   GET /api/dashboard/storage
// @access  Private/Admin
const getStorageStats = async (req, res) => {
  try {
    const users = await User.find()
      .select('name email storageUsed storageLimit role isActive')
      .sort({ storageUsed: -1 });

    const storageStats = users.map(user => {
    const used = Number(user.storageUsed) || 0;
    const limit = Number(user.storageLimit) || 0;
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      storageUsed: used,
      storageLimit: limit,
      percentage: limit > 0 ? Math.round((used / limit) * 100) : 0,
      usedMB: (used / 1024 / 1024).toFixed(2),
      limitGB: (limit / 1024 / 1024 / 1024).toFixed(2)
    };
  });

    res.status(200).json({
      success: true,
      count: storageStats.length,
      storageStats
    });

  } catch (error) {
    console.error('Storage stats error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching storage stats'
    });
  }
};

module.exports = {
  getDashboardStats,
  getActivityLogs,
  getStorageStats
};