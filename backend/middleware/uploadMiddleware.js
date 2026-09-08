const path = require('path');
const upload = require('../config/multer');
const ActivityLog = require('../models/ActivityLog');

// Log a rejected upload (oversize / disallowed type) to the activity log
const logRejectedUpload = async (req, reason) => {
  try {
    if (!req.user) return;

    const info = req.rejectedUpload || {};
    const isOversize = reason === 'oversize';

    await ActivityLog.create({
      user: req.user.id,
      action: 'upload_rejected',
      description: isOversize
        ? `Upload rejected: ${info.originalname || '(unknown)'} exceeds the 100MB limit`
        : `Upload rejected: ${info.originalname || '(unknown)'} (type ${info.extension || '(none)'}) is not allowed for security reasons`,
      resourceType: 'file',
      resourceName: info.originalname || null,
      ipAddress: req.ip || null,
      userAgent: req.headers ? (req.headers['user-agent'] || null) : null,
      metadata: {
        reason,
        originalName: info.originalname || null,
        mimetype: info.mimetype || null,
        extension: info.extension || null
      }
    });
  } catch (err) {
    console.error('Rejected-upload log error:', err.message);
  }
};

// Single file upload
const uploadSingle = (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        await logRejectedUpload(req, 'oversize');
        return res.status(400).json({
          success: false,
          message: 'File size exceeds the 100MB limit'
        });
      }
      await logRejectedUpload(req, 'disallowed_type');
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a file'
      });
    }

    next();
  });
};

// Multiple files upload (max 10 at once)
const uploadMultiple = (req, res, next) => {
  upload.array('files', 10)(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        await logRejectedUpload(req, 'oversize');
        return res.status(400).json({
          success: false,
          message: 'One or more files exceed the 100MB limit'
        });
      }
      await logRejectedUpload(req, 'disallowed_type');
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please upload at least one file'
      });
    }

    next();
  });
};

module.exports = { uploadSingle, uploadMultiple };