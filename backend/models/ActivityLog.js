const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: [
      // Auth actions
      'login',
      'logout',
      'register',
      'login_failed',
      'account_locked',
      // File actions
      'file_upload',
      'upload_rejected',
      'file_download',
      'file_delete',
      'file_restore',
      'file_permanent_delete',
      'file_version_restore',
      'file_version_delete',
      'file_share',
      'file_rename',
      'file_move',
      'file_tags_update',
      // Folder actions
      'folder_create',
      'folder_delete',
      'folder_permanent_delete',
      'folder_restore',
      'folder_rename',
      'folder_color_change',
      // Backup actions
      'backup_start',
      'backup_complete',
      'backup_failed',
      'backup_restore',
      'backup_download',
      'backup_delete',
      // User management actions
      'user_create',
      'user_update',
      'user_delete',
      'user_deactivate',
      'role_change',
      // Settings actions
      'settings_update',
      'password_change'
    ],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  resourceType: {
    type: String,
    enum: ['file', 'folder', 'backup', 'user', 'auth', 'settings'],
    default: null
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  resourceName: {
    type: String,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for querying logs by user and action
ActivityLogSchema.index({ user: 1, action: 1 });
ActivityLogSchema.index({ createdAt: -1 });

// Auto delete logs older than 90 days
ActivityLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7776000 }
);

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);