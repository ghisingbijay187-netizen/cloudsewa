const mongoose = require('mongoose');

const BackupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Backup name is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['manual', 'hourly', 'daily', 'weekly', 'monthly'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    default: 'pending'
  },
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  storagePath: {
    type: String,
    default: null
  },
  storageMode: {
    type: String,
    enum: ['local', 's3'],
    default: 'local'
  },
  totalFiles: {
    type: Number,
    default: 0
  },
  totalSize: {
    type: Number,
    default: 0 // in bytes
  },
  filesIncluded: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File'
  }],
  completedAt: {
    type: Date,
    default: null
  },
  errorMessage: {
    type: String,
    default: null
  },
  }, {
  timestamps: true
});

// Index for querying by type and status
BackupSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('Backup', BackupSchema);