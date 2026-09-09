const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const File = require('../models/File');
const Backup = require('../models/Backup');
const Settings = require('../models/Settings');
const unzipper = require('unzipper');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { sendBackupCompleteEmail, sendBackupFailedEmail } = require('../utils/emailService');
const { deleteFile, readFileBuffer, uploadLocalFileToS3, downloadS3ToLocalFile } = require('../utils/storageService');
const { notify, notifyMany } = require('../utils/notificationService');
const { decryptBuffer, generateKey, encryptBuffer, hashFile } = require('../utils/encryptionService');
const { nextVersionNumber, oldestVersionSize, trimToCap, distinctBlobSize } = require('../utils/versionService');
const { adjustStorageUsed, recomputeStorageUsed } = require('../utils/quotaUtil');
const { fileTypeFromBuffer } = require('../utils/fileTypeDetect');

// Infer a previewable mimetype from a file name/extension, as a fallback for
// files whose binary signature file-type can't classify (e.g. plain text) or
// distinguishes poorly. file-type reports zip-based OOXML documents
// (docx/xlsx/pptx) as generic "application/zip", so the extension wins for
// those zip-based docs.
const MIMETYPE_BY_EXT = {
  txt: 'text/plain', md: 'text/markdown', csv: 'text/csv',
  log: 'text/plain', js: 'text/javascript', mjs: 'text/javascript',
  css: 'text/css', json: 'application/json',
  htm: 'text/html', html: 'text/html', xml: 'text/xml',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};

const inferMimetypeFromName = (name) => {
  if (!name || typeof name !== 'string') return null;
  const ext = name.split('.').pop().toLowerCase();
  return MIMETYPE_BY_EXT[ext] || null;
};

// Resolve the mimetype for a restored file: prefer the backup manifest, then
// sniff the actual bytes (file-type), then fall back to the file extension.
// For zip-based OOXML docs the extension is preferred over generic "application/
// zip" so restored files keep a distinguishing type. Always returns a string.
const resolveRestoredMimetype = async (manifestMimetype, originalName, restoredBytes) => {
  if (manifestMimetype && manifestMimetype !== 'application/octet-stream') {
    return manifestMimetype;
  }
  const extMime = inferMimetypeFromName(originalName);
  try {
    const sniffed = await fileTypeFromBuffer(restoredBytes);
    if (sniffed && sniffed.mime) {
      // Prefer the extension when the sniffer only sees a generic zip
      // (e.g. docx/xlsx/pptx) or an octet-stream.
      if (extMime && (sniffed.mime === 'application/zip' || sniffed.mime === 'application/octet-stream')) {
        return extMime;
      }
      return sniffed.mime;
    }
  } catch (err) {
    console.error('Mimetype sniffing error:', err.message);
  }
  return extMime || 'application/octet-stream';
};

// Get all admin user ids (for broadcasting system-wide events)
const getAdminIds = async () => {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id');
    return admins.map(a => a._id);
  } catch (err) {
    console.error('Get admin ids error:', err.message);
    return [];
  }
};

// Log activity helper
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

// Mirror the completed zip to S3 so backups survive an instance replacement.
// Non-blocking: if the mirror fails the local copy stays valid.
const mirrorBackupToS3 = async (backupPath, storagePath) => {
  if ((process.env.STORAGE_MODE || 'local') !== 's3') return;
  if (!process.env.AWS_BUCKET_NAME) {
    console.warn('STORAGE_MODE=s3 but AWS_BUCKET_NAME not set; skipping S3 backup mirror');
    return;
  }
  try {
    const key = `backups/${path.basename(backupPath)}`;
    await uploadLocalFileToS3(backupPath, key);
    try {
      const adminIds = await getAdminIds();
      await notifyMany(adminIds, {
        type: 'backup_complete',
        title: 'Backup stored to S3',
        message: `Backup "${path.basename(backupPath)}" mirrored to S3 (${storagePath})`,
        icon: 'archive',
        link: '/backups',
        priority: 'low',
        metadata: { backupId: null }
      });
    } catch (notifyErr) {
      console.error('S3 mirror notification error:', notifyErr.message);
    }
  } catch (err) {
    console.error(`Failed to mirror backup to S3 (${backupPath}): ${err.message}`);
  }
};

// Core backup function — used by both manual and scheduled backups
const performBackup = async (type, initiatedBy = null) => {
  const backupName = `${type}-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const backupDir = path.join(__dirname, '..', 'backups');

  // Ensure backups directory exists
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupPath = path.join(backupDir, `${backupName}.zip`);

  // Create backup record
  const backup = await Backup.create({
    name: backupName,
    type,
    status: 'in_progress',
    initiatedBy,
    storagePath: `backups/${backupName}.zip`,
    storageMode: process.env.STORAGE_MODE || 'local'
  });

  if (initiatedBy) {
    await logActivity(initiatedBy, 'backup_start',
      `${type} backup started: ${backupName}`, {
        resourceType: 'backup',
        resourceId: backup._id,
        resourceName: backupName
      });
  }

  try {
    // Get all active files
    const files = await File.find({ isDeleted: false }).select('+encryptionKey').populate('folder', 'name');

    // Create zip archive
    const output = fs.createWriteStream(backupPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    const { archivedIds } = await new Promise(async (resolve, reject) => {
      output.on('close', () => resolve({ archivedIds }));
      archive.on('error', reject);
      archive.pipe(output);

      let totalSize = 0;
      const manifest = [];
      const archivedIds = [];

      for (const file of files) {
        let buffer = null;

        if (file.storageMode === 's3') {
          buffer = await readFileBuffer(file.storagePath, 's3').catch(() => null);
        } else {
          const filePath = path.join(__dirname, '..', file.storagePath);
          if (fs.existsSync(filePath)) {
            buffer = fs.readFileSync(filePath);
          }
        }

        if (buffer) {
          try {
            const entryName = `files/${file.owner._id || file.owner}__${file.originalName}`;
            // Decrypt encrypted blobs so the archive contains usable plaintext
            const outBuf = (file.isEncrypted && file.encryptionKey)
              ? decryptBuffer(buffer, file.encryptionKey)
              : buffer;
            archive.append(outBuf, { name: entryName });
            totalSize += file.size;
            archivedIds.push(file._id);
            manifest.push({
              entry: entryName,
              originalName: file.originalName,
              mimetype: file.mimetype || 'application/octet-stream',
              size: file.size,
              folderId: file.folder ? file.folder._id.toString() : null,
              folderName: file.folder ? file.folder.name : null
            });
          } catch (decErr) {
            console.error(`Backup: could not decrypt/include file ${file._id} (${file.originalName}): ${decErr.message}`);
          }
        }
      } 

      // Manifest so restores can rebuild mimetypes.
      archive.append(Buffer.from(JSON.stringify(manifest, null, 2)), { name: 'manifest.json' });

      archive.finalize();
    });

    // Get backup file size
    const backupStats = fs.statSync(backupPath);

    // Update backup record
    backup.status = 'completed';
    backup.totalFiles = archivedIds.length;
    backup.totalSize = backupStats.size;
    backup.filesIncluded = archivedIds;
    backup.completedAt = new Date();
    await backup.save();

    // Enforce retention right away instead of waiting for the nightly sweep.
    try {
      const removed = await sweepOverLimitBackups(await getRetentionConfig());
      if (removed > 0) console.log(`[backup-retention] Post-backup sweep removed ${removed} backup(s)`);
    } catch (sweepErr) {
      console.error('Post-backup retention sweep failed:', sweepErr.message);
    }

    // Mirror the zip to durable S3 storage (non-blocking)
    mirrorBackupToS3(backupPath, backup.storagePath);

    // Send success email
    try {
      await sendBackupCompleteEmail(backup);
    } catch (emailErr) {
      console.error('Backup complete email error:', emailErr.message);
    }

    // Notify admins of the completed backup
    const adminIds = await getAdminIds();
    await notifyMany(adminIds, {
      type: 'backup_complete',
      title: 'Backup completed',
      message: `${type} backup "${backupName}" completed successfully — ${archivedIds.length} files`,
      icon: 'archive',
      link: '/backups',
      priority: 'medium',
      metadata: { backupId: backup._id.toString(), totalFiles: archivedIds.length }
    });

    if (initiatedBy) {
      await logActivity(initiatedBy, 'backup_complete',
        `${type} backup completed: ${backupName} — ${archivedIds.length} files`, {
          resourceType: 'backup',
          resourceId: backup._id,
          resourceName: backupName,
          metadata: { totalFiles: archivedIds.length, totalSize: backupStats.size }
        });
    }

    return backup;

  } catch (error) {
    // Update backup record as failed
    backup.status = 'failed';
    backup.errorMessage = error.message;
    await backup.save();

    // Send failure email
    try {
      await sendBackupFailedEmail(backup, error.message);
    } catch (emailErr) {
      console.error('Backup failed email error:', emailErr.message);
    }

    // Notify admins of the failed backup
    const adminIds = await getAdminIds();
    await notifyMany(adminIds, {
      type: 'backup_failed',
      title: 'Backup failed',
      message: `${type} backup "${backupName}" failed — ${error.message}`,
      icon: 'alert',
      link: '/backups',
      priority: 'high',
      metadata: { backupId: backup._id.toString() }
    });

    if (initiatedBy) {
      await logActivity(initiatedBy, 'backup_failed',
        `${type} backup failed: ${backupName} — ${error.message}`, {
          resourceType: 'backup',
          resourceId: backup._id,
          resourceName: backupName
        });
    }

    throw error;
  }
};

// @desc    Trigger manual backup
// @route   POST /api/backups/manual
// @access  Private/Admin
const triggerManualBackup = async (req, res) => {
  try {
    const backup = await performBackup('manual', req.user.id);

    res.status(201).json({
      success: true,
      message: 'Manual backup completed successfully',
      backup
    });

  } catch (error) {
    console.error('Manual backup error:', error.message);
    res.status(500).json({
      success: false,
      message: `Backup failed: ${error.message}`
    });
  }
};

// @desc    Get all backups
// @route   GET /api/backups
// @access  Private/Admin
const getBackups = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;

    let query = {};
    if (type) query.type = type;
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const backups = await Backup.find(query)
      .populate('initiatedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Backup.countDocuments(query);

    res.status(200).json({
      success: true,
      count: backups.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      backups
    });

  } catch (error) {
    console.error('Get backups error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching backups'
    });
  }
};

// @desc    Get single backup
// @route   GET /api/backups/:id
// @access  Private/Admin
const getBackup = async (req, res) => {
  try {
    const backup = await Backup.findById(req.params.id)
      .populate('initiatedBy', 'name email')
      .populate('filesIncluded', 'originalName size mimetype');

    if (!backup) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }

    res.status(200).json({
      success: true,
      backup
    });

  } catch (error) {
    console.error('Get backup error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching backup'
    });
  }
};

// @desc    Download backup
// @route   GET /api/backups/:id/download
// @access  Private (admin all, employee own only)
const downloadBackup = async (req, res) => {
  try {
    const backup = await Backup.findById(req.params.id);

    if (!backup || backup.status !== 'completed') {
      return res.status(404).json({
        success: false,
        message: 'Backup not found or not completed'
      });
    }

    // Admin can download any backup; employees only their own.
    // Scheduled/system backups have a null initiator and are admin-only.
    if (req.user.role !== 'admin') {
      const isOwner = backup.initiatedBy &&
        backup.initiatedBy.toString() === req.user.id;
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Not authorised to download this backup'
        });
      }
    }

    const backupPath = path.join(__dirname, '..', backup.storagePath);

    // Fetch from S3 if the archive only lives there (mirrored, ephemeral disk).
    if (!fs.existsSync(backupPath) &&
        (backup.storageMode === 's3' || (process.env.STORAGE_MODE || 'local') === 's3')) {
      try {
        const s3Key = `backups/${path.basename(backupPath)}`;
        await downloadS3ToLocalFile(s3Key, backupPath);
      } catch (err) {
        return res.status(404).json({
          success: false,
          message: 'Backup file not found on server or in S3'
        });
      }
    }

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({
        success: false,
        message: 'Backup file not found on server'
      });
    }

    await logActivity(req.user.id, 'backup_download',
      `Backup downloaded: ${backup.name}`, {
        resourceType: 'backup',
        resourceId: backup._id,
        resourceName: backup.name
      });

    res.download(backupPath, `${backup.name}.zip`);

  } catch (error) {
    console.error('Download backup error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while downloading backup'
    });
  }
};

// @desc    Delete backup
// @route   DELETE /api/backups/:id
// @access  Private/Admin
const deleteBackup = async (req, res) => {
  try {
    const backup = await Backup.findById(req.params.id);

    if (!backup) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }

    // Admins can delete any backup; employees only their own manual backups.
    // Scheduled/system backups have a null initiator and are admin-only.
    if (req.user.role !== 'admin') {
      const isOwner = backup.initiatedBy &&
        backup.initiatedBy.toString() === req.user.id;
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Not authorised to delete this backup'
        });
      }
    }

    // Delete backup file from storage
    const backupPath = path.join(__dirname, '..', backup.storagePath);
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }

    await Backup.findByIdAndDelete(req.params.id);

    await logActivity(req.user.id, 'backup_delete',
      `Backup deleted: ${backup.name}`, {
        resourceType: 'backup',
        resourceId: backup._id,
        resourceName: backup.name
      });

    res.status(200).json({
      success: true,
      message: 'Backup deleted successfully'
    });

  } catch (error) {
    console.error('Delete backup error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting backup'
    });
  }
};

// Core backup function for specific user (employee)
const performUserBackup = async (type, userId, initiatedBy = null) => {
  const backupName = `${type}-backup-user-${userId}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const backupDir = path.join(__dirname, '..', 'backups');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupPath = path.join(backupDir, `${backupName}.zip`);

  const backup = await Backup.create({
    name: backupName,
    type,
    status: 'in_progress',
    initiatedBy,
    storagePath: `backups/${backupName}.zip`,
    storageMode: process.env.STORAGE_MODE || 'local'
  });

  if (initiatedBy) {
    await logActivity(initiatedBy, 'backup_start',
      `${type} backup started: ${backupName}`, {
        resourceType: 'backup',
        resourceId: backup._id,
        resourceName: backupName
      });
  }

  const adminIds = (await getAdminIds())
    .filter(id => !initiatedBy || String(id) !== String(initiatedBy));
  const initiatorName = initiatedBy
    ? (await User.findById(initiatedBy).select('name'))?.name || null
    : null;

  try {
    // Get only this user's files
    const files = await File.find({
      isDeleted: false,
      owner: userId
    }).select('+encryptionKey').populate('folder', 'name');

    const output = fs.createWriteStream(backupPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    const { archivedIds } = await new Promise(async (resolve, reject) => {
      output.on('close', () => resolve({ archivedIds }));
      archive.on('error', reject);
      archive.pipe(output);

      let totalSize = 0;
      const manifest = [];
      const archivedIds = [];

      for (const file of files) {
        let buffer = null;

        if (file.storageMode === 's3') {
          buffer = await readFileBuffer(file.storagePath, 's3').catch(() => null);
        } else {
          const filePath = path.join(__dirname, '..', file.storagePath);
          if (fs.existsSync(filePath)) {
            buffer = fs.readFileSync(filePath);
          }
        }

        if (buffer) {
          try {
            const entryName = `files/${file.owner._id || file.owner}__${file.originalName}`;
            const outBuf = (file.isEncrypted && file.encryptionKey)
              ? decryptBuffer(buffer, file.encryptionKey)
              : buffer;
            archive.append(outBuf, { name: entryName });
            totalSize += file.size;
            archivedIds.push(file._id);
            manifest.push({
              entry: entryName,
              originalName: file.originalName,
              mimetype: file.mimetype || 'application/octet-stream',
              size: file.size,
              folderId: file.folder ? file.folder._id.toString() : null,
              folderName: file.folder ? file.folder.name : null
            });
          } catch (decErr) {
            console.error(`Backup: could not decrypt/include file ${file._id} (${file.originalName}): ${decErr.message}`);
          }
        }
      }

      // Manifest so restores can rebuild mimetypes.
      archive.append(Buffer.from(JSON.stringify(manifest, null, 2)), { name: 'manifest.json' });

      archive.finalize();
    });

    const backupStats = fs.statSync(backupPath);

    backup.status = 'completed';
    backup.totalFiles = archivedIds.length;
    backup.totalSize = backupStats.size;
    backup.filesIncluded = archivedIds;
    backup.completedAt = new Date();
    await backup.save();

    // Enforce retention right away instead of waiting for the nightly sweep.
    try {
      const removed = await sweepOverLimitBackups(await getRetentionConfig());
      if (removed > 0) console.log(`[backup-retention] Post-backup sweep removed ${removed} backup(s)`);
    } catch (sweepErr) {
      console.error('Post-backup retention sweep failed:', sweepErr.message);
    }

    // Mirror the zip to durable S3 storage (non-blocking)
    mirrorBackupToS3(backupPath, backup.storagePath);

    try {
      await sendBackupCompleteEmail(backup);
    } catch (emailErr) {
      console.error('Backup complete email error:', emailErr.message);
    }

    // Notify the initiating user that their backup finished
    if (initiatedBy) {
      await notify(initiatedBy, {
        type: 'backup_complete',
        title: 'Backup completed',
        message: `Your ${type} backup completed successfully — ${archivedIds.length} files`,
        icon: 'archive',
        link: '/backups',
        priority: 'medium',
        metadata: { backupId: backup._id.toString(), totalFiles: archivedIds.length }
      });
      await logActivity(initiatedBy, 'backup_complete',
        `${type} backup completed: ${backupName} — ${archivedIds.length} files`, {
          resourceType: 'backup',
          resourceId: backup._id,
          resourceName: backupName,
          metadata: { totalFiles: archivedIds.length, totalSize: backupStats.size }
        });
    }

    // Notify admins for centralized oversight / audit evidence
    await notifyMany(adminIds, {
      type: 'backup_complete',
      title: 'Backup completed',
      message: `${initiatorName ? `${initiatorName} ran a` : 'A'} ${type} backup — ${archivedIds.length} files`,
      icon: 'archive',
      link: '/backups',
      priority: 'low',
      metadata: { backupId: backup._id.toString(), totalFiles: archivedIds.length }
    });

    return backup;

  } catch (error) {
    backup.status = 'failed';
    backup.errorMessage = error.message;
    await backup.save();

    try {
      await sendBackupFailedEmail(backup, error.message);
    } catch (emailErr) {
      console.error('Backup failed email error:', emailErr.message);
    }

    if (initiatedBy) {
      await notify(initiatedBy, {
        type: 'backup_failed',
        title: 'Backup failed',
        message: `Your ${type} backup failed — ${error.message}`,
        icon: 'alert',
        link: '/backups',
        priority: 'high',
        metadata: { backupId: backup._id.toString() }
      });
      await logActivity(initiatedBy, 'backup_failed',
        `${type} backup failed: ${backupName} — ${error.message}`, {
          resourceType: 'backup',
          resourceId: backup._id,
          resourceName: backupName
        });
    }

    // Notify admins for centralized oversight / audit evidence
    await notifyMany(adminIds, {
      type: 'backup_failed',
      title: 'Backup failed',
      message: `${initiatorName ? `${initiatorName}'s` : 'A'} ${type} backup failed — ${error.message}`,
      icon: 'alert',
      link: '/backups',
      priority: 'high',
      metadata: { backupId: backup._id.toString() }
    });

    throw error;
  }
};

// @desc    Trigger manual backup for employee (own files only)
// @route   POST /api/backups/my-backup
// @access  Private (all users)
const triggerMyBackup = async (req, res) => {
  try {
    const backup = await performUserBackup('manual', req.user.id, req.user.id);
    res.status(201).json({
      success: true,
      message: 'Your files have been backed up successfully',
      backup
    });
  } catch (error) {
    console.error('My backup error:', error.message);
    res.status(500).json({
      success: false,
      message: `Backup failed: ${error.message}`
    });
  }
};

// @desc    Get backups for current user (employee sees only their own)
// @route   GET /api/backups/my-backups
// @access  Private (all users)
const getMyBackups = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const backups = await Backup.find({
      initiatedBy: req.user.id
    })
      .populate('initiatedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Backup.countDocuments({ initiatedBy: req.user.id });

    res.status(200).json({
      success: true,
      count: backups.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      backups
    });
  } catch (error) {
    console.error('Get my backups error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching your backups'
    });
  }
};

// @desc    Restore a backup
// @route   POST /api/backups/:id/restore
// @access  Private (admin restores all, employee restores own only)
const restoreBackup = async (req, res) => {
  let cleanupPath = null;
  const activeStorageMode = process.env.STORAGE_MODE || 'local';

  const folderCache = new Map(); // original folderId -> resolved folderId for this restore run

  const resolveFolder = async (meta, ownerId) => {
    if (!meta || !meta.folderId) return null; // was a root-level file

    if (folderCache.has(meta.folderId)) return folderCache.get(meta.folderId);

    const Folder = require('../models/Folder');
    let folder = await Folder.findOne({ _id: meta.folderId, owner: ownerId, isDeleted: false });

    if (!folder && meta.folderName) {
      folder = await Folder.findOne({ name: meta.folderName, owner: ownerId, parent: null, isDeleted: false });
      if (!folder) {
        folder = await Folder.create({ name: meta.folderName, owner: ownerId, parent: null });
      }
    }

    const resolvedId = folder ? folder._id.toString() : null;
    folderCache.set(meta.folderId, resolvedId);
    return resolvedId;
  };

  try {
    const backup = await Backup.findById(req.params.id);

    if (!backup || backup.status !== 'completed') {
      return res.status(404).json({
        success: false,
        message: 'Backup not found or not completed'
      });
    }

    // Employee can only restore their own backups
    if (req.user.role !== 'admin' &&
        (!backup.initiatedBy || backup.initiatedBy.toString() !== req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorised to restore this backup'
      });
    }

    const backupPath = path.join(__dirname, '..', backup.storagePath);

    // Fetch the archive from S3 if it no longer exists locally.
    if (!fs.existsSync(backupPath) &&
        (backup.storageMode === 's3' || (process.env.STORAGE_MODE || 'local') === 's3')) {
      try {
        const s3Key = `backups/${path.basename(backupPath)}`;
        await downloadS3ToLocalFile(s3Key, backupPath);
      } catch (err) {
        return res.status(404).json({
          success: false,
          message: 'Backup file not found on server or in S3'
        });
      }
    }

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({
        success: false,
        message: 'Backup file not found on server'
      });
    }

    // Extract backup zip to temp folder (unzipper.Open validates paths,
    // providing zip-slip protection)
    const extractPath = path.join(__dirname, '..', 'backups', `restore-${Date.now()}`);
    fs.mkdirSync(extractPath, { recursive: true });
    cleanupPath = extractPath;

    await unzipper.Open.file(backupPath).then((d) => d.extract({ path: extractPath }));

    // Read extracted files
    const filesDir = path.join(extractPath, 'files');
    if (!fs.existsSync(filesDir)) {
      fs.rmdirSync(extractPath, { recursive: true });
      return res.status(400).json({
        success: false,
        message: 'Invalid backup format — no files found'
      });
    }

    // Read metadata manifest (original mimetypes) if the backup included one,
    // so restored files preview correctly after restore.
    const manifestByEntry = {};
    const manifestPath = path.join(extractPath, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        for (const entry of manifest) {
          manifestByEntry[entry.entry] = entry;
        }
      } catch (err) {
        console.error('Error reading backup manifest:', err.message);
      }
    }

    const extractedFiles = fs.readdirSync(filesDir);
    let restoredCount = 0;
    const quotaDeltas = new Map();
    const affectedOwners = new Set();

    // Parse owner id + original name from backup entry: "<ownerId>__<name>"
    // Falls back to the requester for legacy backups without owner prefix.
    const parseEntry = (entryName) => {
      const sepIndex = entryName.indexOf('__');
      if (sepIndex > 0) {
        return {
          ownerId: entryName.slice(0, sepIndex),
          originalName: entryName.slice(sepIndex + 2)
        };
      }
      return {
        ownerId: req.user.id,
        originalName: entryName
      };
    };

    for (const fileName of extractedFiles) {
      const filePath = path.join(filesDir, fileName);
      const stats = fs.statSync(filePath);
      const restoredBytes = fs.readFileSync(filePath);

      const { ownerId, originalName } = parseEntry(fileName);
      const meta = manifestByEntry[`files/${fileName}`];
      // Prefer the manifest, then sniff the bytes, then the extension.
      const restoredMimetype = await resolveRestoredMimetype(
        meta && meta.mimetype, originalName, restoredBytes
      );
      let restoreOwnerId = ownerId;

      // Employee restores only their own files
      if (req.user.role !== 'admin' && restoreOwnerId !== req.user.id) {
        restoreOwnerId = req.user.id;
      }

      // Check if file already exists for the same owner
      const existingFile = await File.findOne({
        originalName,
        owner: restoreOwnerId,
        isDeleted: false
      });

      // A new file adds its full size; overwriting only adds the part not
      // released by trimming the oldest version.
      let netAdd = stats.size;
      if (existingFile && existingFile.versions.length >= 3) {
        // Pushing makes 4 versions, so the oldest size is freed.
        const releasedSize = oldestVersionSize(existingFile);
        netAdd = Math.max(0, stats.size - releasedSize);
      }

      // Enforce the storage quota, tracked cumulatively across the restore.
      if (!quotaDeltas.has(String(restoreOwnerId))) {
        const ownerDoc = await User.findById(restoreOwnerId).select('storageUsed storageLimit');
        quotaDeltas.set(String(restoreOwnerId), {
          used: ownerDoc ? ownerDoc.storageUsed || 0 : 0,
          limit: ownerDoc ? ownerDoc.storageLimit : Infinity,
          pending: 0
        });
      }
      const ownerQuota = quotaDeltas.get(String(restoreOwnerId));
      if (ownerQuota.used + ownerQuota.pending + netAdd > ownerQuota.limit) {
        fs.rmSync(extractPath, { recursive: true, force: true });
        return res.status(413).json({
          success: false,
          message: `Storage limit exceeded for user when restoring backup. Please free up space or increase the storage limit.`
        });
      }
      ownerQuota.pending += netAdd;
      affectedOwners.add(String(restoreOwnerId));

      if (existingFile) {
        // Capture the total storage this file accounted for before the change
        // (live blob + all distinct version blobs).
        const beforeSize = distinctBlobSize(existingFile);

        // Save current version
        existingFile.versions.push({
          versionNumber: existingFile.currentVersion,
          filename: existingFile.filename,
          storagePath: existingFile.storagePath,
          size: existingFile.size
        });
	        // Copy restored file to storage (re-encrypt plaintext from the archive)
        let newStoragePath, newFilename;
        const restoreKey = generateKey();
        const encrypted = encryptBuffer(restoredBytes, restoreKey);

        if (activeStorageMode === 's3') {
          const { PutObjectCommand } = require('@aws-sdk/client-s3');
          const s3Client = require('../config/s3');
          const { v4: uuidv4 } = require('uuid');
          newFilename = `${uuidv4()}${path.extname(fileName)}`;
          newStoragePath = `uploads/${restoreOwnerId}/${newFilename}`;
          await s3Client.send(new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: newStoragePath,
            Body: encrypted
          }));
        } else {
          newFilename = `restored-${Date.now()}-${fileName}`;
          newStoragePath = `uploads/${newFilename}`;
          fs.writeFileSync(path.join(__dirname, '..', newStoragePath), encrypted);
        }

        existingFile.filename = newFilename;
        existingFile.storagePath = newStoragePath;
        existingFile.storageMode = activeStorageMode;
        existingFile.size = stats.size;
        existingFile.mimetype = restoredMimetype;
        existingFile.isEncrypted = true;
        existingFile.encryptionKey = restoreKey;
        existingFile.sha256 = hashFile(restoredBytes);
        existingFile.lastContentChangeAt = new Date();

        // Keep only last 3 versions — delete the oldest physical file.
        await trimToCap(existingFile, 3, deleteFile);

        // Stable labels: the overwritten content takes the next unused number.
        existingFile.currentVersion = nextVersionNumber(existingFile);

        await existingFile.save();

        // Reconcile storageUsed by the change in distinct blobs (can be negative).
        const afterSize = distinctBlobSize(existingFile);

        const storageDelta = afterSize - beforeSize;
        if (storageDelta !== 0) {
          await adjustStorageUsed(restoreOwnerId, storageDelta);
        }
      } else {
        // Create new file record — write to whichever storage mode is active
        let newStoragePath, newFilename;
        const restoreKey = generateKey();
        const encrypted = encryptBuffer(restoredBytes, restoreKey);

        if (activeStorageMode === 's3') {
          const { PutObjectCommand } = require('@aws-sdk/client-s3');
          const s3Client = require('../config/s3');
          const { v4: uuidv4 } = require('uuid');
          newFilename = `${uuidv4()}${path.extname(fileName)}`;
          newStoragePath = `uploads/${restoreOwnerId}/${newFilename}`;
          await s3Client.send(new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: newStoragePath,
            Body: encrypted
          }));
        } else {
          newFilename = `restored-${Date.now()}-${fileName}`;
          newStoragePath = `uploads/${newFilename}`;
          fs.writeFileSync(path.join(__dirname, '..', newStoragePath), encrypted);
        }

        await File.create({
          originalName,
          filename: newFilename,
          storagePath: newStoragePath,
          mimetype: restoredMimetype,
          size: stats.size,
          owner: restoreOwnerId,
	  folder: await resolveFolder(meta, restoreOwnerId),
          storageMode: activeStorageMode,
          isEncrypted: true,
          encryptionKey: restoreKey,
          sha256: hashFile(restoredBytes),
          lastContentChangeAt: new Date(),
          versions: []
        });

        // Update owner's storage
        await User.findByIdAndUpdate(restoreOwnerId, {
          $inc: { storageUsed: stats.size }
        });
      }

      restoredCount++;
    }

    // Recompute storageUsed for every owner touched by this restore, so the
    // value is exact and self-correcting (restores previously caused drift).
    for (const ownerId of affectedOwners) {
      await recomputeStorageUsed(ownerId);
    }

    // Clean up temp extraction folder
    fs.rmSync(extractPath, { recursive: true, force: true });

    await logActivity(req.user.id, 'backup_restore',
      `Backup restored: ${backup.name} — ${restoredCount} files restored`, {
        resourceType: 'backup',
        resourceId: backup._id,
        resourceName: backup.name,
        metadata: { restoredCount }
      });

    res.status(200).json({
      success: true,
      message: `Backup restored successfully - ${restoredCount} file${restoredCount !== 1 ? 's' : ''} restored`
    });

  } catch (error) {
    if (cleanupPath) {
      fs.rmSync(cleanupPath, { recursive: true, force: true });
    }
    console.error('Restore backup error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while restoring backup'
    });
  }
};

// Count-based retention policy (grandfather-father-son rotation).
const DEFAULT_RETENTION = {
  hourly: 24,
  daily: 7,
  weekly: 4,
  monthly: 3,
  manual: 10
};

const RETENTION_KEYS = ['hourly', 'daily', 'weekly', 'monthly', 'manual'];

const getRetentionConfig = async () => {
  const setting = await Settings.findOne({ key: 'backupRetention' });
  if (setting && setting.value) {
    try {
      const saved = JSON.parse(setting.value);
      const config = {};
      for (const key of RETENTION_KEYS) {
        const val = parseInt(saved[key]);
        config[key] = !Number.isFinite(val) || val < 1 ? DEFAULT_RETENTION[key] : val;
      }
      return config;
    } catch (err) {
      console.error('Retention config parse error:', err.message);
    }
  }
  return { ...DEFAULT_RETENTION };
};

// Delete completed backups past their per-type limit.
const sweepOverLimitBackups = async (config) => {
  let totalDeleted = 0;

  for (const type of RETENTION_KEYS) {
    const limit = config[type];
    const backups = await Backup.find({
      type,
      status: 'completed'
    }).sort({ createdAt: 1 });

    if (backups.length <= limit) continue;

    // Manual limits apply per initiator so one user's backups can't evict another's.
    let toDelete;
    if (type === 'manual') {
      toDelete = [];
      const byOwner = new Map();
      for (const backup of backups) {
        const key = backup.initiatedBy ? String(backup.initiatedBy) : 'system';
        if (!byOwner.has(key)) byOwner.set(key, []);
        byOwner.get(key).push(backup);
      }
      for (const owned of byOwner.values()) {
        if (owned.length > limit) {
          toDelete.push(...owned.slice(0, owned.length - limit));
        }
      }
    } else {
      toDelete = backups.slice(0, backups.length - limit);
    }

    for (const backup of toDelete) {
      const backupPath = path.join(__dirname, '..', backup.storagePath);
      if (fs.existsSync(backupPath)) {
        try {
          fs.unlinkSync(backupPath);
        } catch (err) {
          console.error('Failed to remove backup file:', backup.storagePath, err.message);
        }
      }
      await Backup.findByIdAndDelete(backup._id);
      totalDeleted++;
    }
  }

  if (totalDeleted > 0) {
    console.log(`[backup-retention] Removed ${totalDeleted} over-limit backup(s)`);
  }

  return totalDeleted;
};

// Count how many backups the sweep would delete for each type (for the warning UI).
const countDeletableBackups = async (config) => {
  const deletable = {};
  for (const type of RETENTION_KEYS) {
    const limit = config[type];
    const backups = await Backup.find({
      type,
      status: 'completed'
    }).select('initiatedBy').sort({ createdAt: 1 });

    let count = 0;
    if (type === 'manual') {
      const byOwner = new Map();
      for (const backup of backups) {
        const key = backup.initiatedBy ? String(backup.initiatedBy) : 'system';
        byOwner.set(key, (byOwner.get(key) || 0) + 1);
      }
      for (const owned of byOwner.values()) {
        if (owned > limit) count += owned - limit;
      }
    } else if (backups.length > limit) {
      count = backups.length - limit;
    }
    deletable[type] = count;
  }
  return deletable;
};

// Automated retention sweep — runs from the scheduler without a user context.
const applyRetentionPolicy = async () => {
  const config = await getRetentionConfig();
  const totalDeleted = await sweepOverLimitBackups(config);
  return { config, totalDeleted };
};

// @desc    Get backup retention policy (saved limits + current volumes)
// @route   GET /api/backups/retention
// @access  Private/Admin
const getRetentionSettings = async (req, res) => {
  try {
    const retentionSettings = await getRetentionConfig();

    // Count completed backups by type so the UI can show current volumes
    const stats = await Backup.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    // How many would actually be deleted if the policy ran now (per-user for
    // manual backups, global for scheduled types)
    const deletableCounts = await countDeletableBackups(retentionSettings);

    res.status(200).json({
      success: true,
      retentionSettings,
      currentCounts: stats,
      deletableCounts
    });
  } catch (error) {
    console.error('Get retention error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching retention settings'
    });
  }
};

// @desc    Save and immediately apply backup retention policy
// @route   PUT /api/backups/retention
// @access  Private/Admin
const updateRetentionSettings = async (req, res) => {
  try {
    const { hourly, daily, weekly, monthly, manual } = req.body;
    const requested = { hourly, daily, weekly, monthly, manual };

    const config = {};
    for (const key of RETENTION_KEYS) {
      const val = parseInt(requested[key]);
      if (!Number.isFinite(val) || val < 1) {
        return res.status(400).json({
          success: false,
          message: `Invalid retention limit for "${key}" — must be at least 1`
        });
      }
      config[key] = val;
    }

    // Persist so the automated scheduler sweep enforces the same policy
    let retentionSetting = await Settings.findOne({ key: 'backupRetention' });
    if (retentionSetting) {
      retentionSetting.value = JSON.stringify(config);
      await retentionSetting.save();
    } else {
      await Settings.create({ key: 'backupRetention', value: JSON.stringify(config) });
    }

    // Apply immediately as well as on the schedule
    const totalDeleted = await sweepOverLimitBackups(config);

    await logActivity(req.user.id, 'settings_update',
      `Backup retention policy saved — ${totalDeleted} old backup(s) removed`, {
        resourceType: 'backup',
        metadata: { config, totalDeleted }
      });

    res.status(200).json({
      success: true,
      message: `Retention policy saved and applied — ${totalDeleted} old backup(s) removed`,
      totalDeleted,
      retentionSettings: config
    });
  } catch (error) {
    console.error('Update retention error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while applying retention policy'
    });
  }
};

module.exports = {
  performBackup,
  performUserBackup,
  triggerManualBackup,
  triggerMyBackup,
  getMyBackups,
  getBackups,
  getBackup,
  downloadBackup,
  deleteBackup,
  restoreBackup,
  getRetentionSettings,
  updateRetentionSettings,
  applyRetentionPolicy
};
