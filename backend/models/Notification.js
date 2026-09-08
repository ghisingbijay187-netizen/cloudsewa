const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'file_upload',
      'file_share',
      'file_download',
      'backup_complete',
      'backup_failed',
      'backup_start',
      'storage_warning',
      'reset_approved',
      'registration_request',
      'registration_approved',
      'registration_rejected',
      'system'
    ],
    default: 'system'
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: null
  },
  link: {
    type: String,
    default: null
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for querying a user's notifications (unread first, newest first)
NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

// Auto delete notifications older than 30 days
NotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 2592000 }
);

module.exports = mongoose.model('Notification', NotificationSchema);
