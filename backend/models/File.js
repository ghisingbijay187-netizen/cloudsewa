const mongoose = require('mongoose');

const VersionSchema = new mongoose.Schema({
  versionNumber: {
    type: Number,
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  storagePath: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const FileSchema = new mongoose.Schema({
  originalName: {
    type: String,
    required: [true, 'Original file name is required'],
    trim: true
  },
  filename: {
    type: String,
    required: true
  },
  storagePath: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  folder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  versions: [VersionSchema],
  currentVersion: {
    type: Number,
    default: 1
  },
  // When the CURRENT (live) content actually changed (new upload version,
  // restore). Unlike updatedAt it is unaffected by rename/move/tag edits, so
  // the UI can show an honest date for the active version.
  lastContentChangeAt: {
    type: Date,
    default: null
  },
  isEncrypted: {
    type: Boolean,
    default: false
  },
  sha256: {
    type: String,
    default: null
  },
  // AES-256 key for this file's blob. select:false only hides the key from
  // default queries — it is stored in plaintext in this database. It protects
  // against blob-storage (disk/S3) compromise, NOT database compromise.
  encryptionKey: {
    type: String,
    default: null,
    select: false
  },
  sharedWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  starred: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }],
  storageMode: {
    type: String,
    enum: ['local', 's3'],
    default: 'local'
  }
}, {
  timestamps: true
});

// Index for search
FileSchema.index({ originalName: 'text', tags: 'text' });

// Index for soft delete queries
FileSchema.index({ isDeleted: 1, owner: 1 });

// No TTL index on deletedAt: a TTL index would delete the doc but leave its
// blob orphaned. cleanExpiredTrash(30) handles the 30-day cutoff properly.

module.exports = mongoose.model('File', FileSchema);