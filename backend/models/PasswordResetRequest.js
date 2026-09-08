const mongoose = require('mongoose');

const PasswordResetRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  rejectedReason: {
    type: String,
    default: null
  },
  resetToken: {
    type: String,
    default: null
  },
  resetTokenExpire: {
    type: Date,
    default: null
  },
  requestToken: {
    type: String,
    default: null
  },
  used: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Auto delete after 24 hours
PasswordResetRequestSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 86400 }
);

module.exports = mongoose.model('PasswordResetRequest', PasswordResetRequestSchema);