const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const File = require('../models/File');
const User = require('../models/User');
const Folder = require('../models/Folder');
const ActivityLog = require('../models/ActivityLog');
const { deleteFile, getFileUrl, copyLocalFile, copyS3File, readFileBuffer, writeFileBuffer } = require('../utils/storageService');
const { escapeRegExp } = require('../utils/regexUtil');
const { v4: uuidv4 } = require('uuid');
const { notify, notifyMany } = require('../utils/notificationService');
const { encryptBuffer, decryptBuffer, generateKey, hashFile } = require('../utils/encryptionService');
const { nextVersionNumber, oldestVersionSize, trimToCap, distinctBlobSize } = require('../utils/versionService');
const { decrementStorageUsed, adjustStorageUsed, recomputeStorageUsed } = require('../utils/quotaUtil');

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

// @desc    Upload a file
// @route   POST /api/files/upload
// @access  Private
const uploadFile = async (req, res) => {
  try {
    const file = req.file;
    const { folderId } = req.body;
    const storageMode = process.env.STORAGE_MODE || 'local';

    // Validate destination folder (if provided) belongs to this user — mirrors
    // moveFile so nested writes are owner-consistent.
    if (folderId) {
      const Folder = require('../models/Folder');
      const destFolder = await Folder.findById(folderId);
      if (!destFolder || destFolder.isDeleted) {
        return res.status(404).json({ success: false, message: 'Destination folder not found' });
      }
      if (destFolder.owner.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Not authorised to upload into this folder' });
      }
    }

    // Determine storage path
    const storagePath = storageMode === 's3'
      ? file.key
      : `uploads/${file.filename}`;
    // multer-s3 can misreport size as 0 for S3 multipart uploads (large files
    // AWS splits into parts — visible as an ETag ending in "-N"). Fetch the
    // true size directly from S3 so both the displayed size and the quota
    // calculation below use the correct number.
    if (storageMode === 's3') {
      try {
        const { HeadObjectCommand } = require('@aws-sdk/client-s3');
        const s3Client = require('../config/s3');
        const head = await s3Client.send(new HeadObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: storagePath
        }));
        if (head.ContentLength) {
          file.size = head.ContentLength;
        }
      } catch (headErr) {
        console.error(`Could not verify true S3 object size for ${storagePath}: ${headErr.message}`);
      }
    }
    // Check if file with same name exists in same folder — this becomes a version
    const existingFile = await File.findOne({
      originalName: file.originalname,
      owner: req.user.id,
      folder: folderId || null,
      isDeleted: false
    });

    // Figure out the trimmed-old-version size so quota accounts for the net change
    let releasedSize = 0;
    if (existingFile && existingFile.versions.length >= 3) {
      releasedSize = oldestVersionSize(existingFile);
    }

    // Net change to the user's storage for this upload
    const netDelta = file.size - releasedSize;

    // Enforce the quota atomically so concurrent uploads can't exceed it.
    const updated = await User.findOneAndUpdate(
      {
        _id: req.user.id,
        $expr: {
          $gte: [
            { $subtract: ['$storageLimit', '$storageUsed'] },
            netDelta
          ]
        }
      },
      { $inc: { storageUsed: netDelta } },
      { returnDocument: 'after' }
    );

    if (!updated) {
      // Clean up the blob already written by multer so we don't leak disk space
      try {
        await deleteFile(storagePath, storageMode);
      } catch (cleanupErr) {
        console.error(`Error cleaning up rejected upload: ${cleanupErr.message}`);
      }
      const user = await User.findById(req.user.id).select('storageUsed storageLimit');
      await logActivity(req.user.id, 'file_upload',
        `Upload rejected — storage limit exceeded: ${file.originalname}`,
        req, {
          resourceType: 'file',
          resourceName: file.originalname
        });
      return res.status(413).json({
        success: false,
        message: 'Storage limit exceeded. Please free up space or contact the administrator to increase your limit.',
        storage: {
          used: user.storageUsed,
          limit: user.storageLimit
        }
      });
    }

    // Encrypt the blob in place and hash the plaintext for integrity checks.
    try {
      const rawBuffer = await readFileBuffer(storagePath, storageMode);
      const sha256 = hashFile(rawBuffer);

      let key;
      if (existingFile) {
        const existing = await File.findById(existingFile._id).select('encryptionKey');
        key = existing && existing.encryptionKey ? existing.encryptionKey : generateKey();
      } else {
        key = generateKey();
      }

      const encryptedBuffer = encryptBuffer(rawBuffer, key);
      await writeFileBuffer(storagePath, storageMode, encryptedBuffer);

      req.encryptionKey = key;
      req.fileHash = sha256;
      req.isEncrypted = true;
    } catch (encErr) {
      // If encryption/hashing fails we must not silently store plaintext; clean up
      // and reject the upload.
      console.error('Encryption/hash error:', encErr.message);
      try {
        await deleteFile(storagePath, storageMode);
      } catch (cleanupErr) {
        console.error(`Error cleaning up after encryption failure: ${cleanupErr.message}`);
      }
      await decrementStorageUsed(req.user.id, netDelta);
      return res.status(500).json({
        success: false,
        message: 'Server error while securing file'
      });
    }

    try {
      if (existingFile) {
        // Duplicate content: drop the new blob, keep the existing version.
        if (req.fileHash && existingFile.sha256 === req.fileHash) {
          try {
            await deleteFile(storagePath, storageMode);
          } catch (cleanupErr) {
            console.error(`Error cleaning up duplicate upload: ${cleanupErr.message}`);
          }
          await decrementStorageUsed(req.user.id, netDelta);
          await logActivity(req.user.id, 'file_upload',
            `No new version created — ${file.originalname} is unchanged`,
            req, {
              resourceType: 'file',
              resourceId: existingFile._id,
              resourceName: file.originalname
            });
          const dupUser = await User.findById(req.user.id).select('storageUsed storageLimit');
          return res.status(200).json({
            success: true,
            message: 'No new version created — this file is already up to date',
            file: existingFile,
            storageUsed: dupUser?.storageUsed ?? 0,
            storageLimit: dupUser?.storageLimit ?? 0
          });
        }

        // Save current version to versions array
        existingFile.versions.push({
          versionNumber: existingFile.currentVersion,
          filename: existingFile.filename,
          storagePath: existingFile.storagePath,
          size: existingFile.size
        });

        // Keep only last 3 versions — delete the oldest physical file.
        await trimToCap(existingFile, 3, deleteFile);

        // Stable labels: the new upload takes the next unused version number.
        existingFile.currentVersion = nextVersionNumber(existingFile);

        // Update to new version
        existingFile.filename = storageMode === 's3' ? path.basename(file.key) : file.filename;
        existingFile.storagePath = storagePath;
        existingFile.size = file.size;
        existingFile.storageMode = storageMode;
        existingFile.isEncrypted = req.isEncrypted;
        existingFile.sha256 = req.fileHash;
        existingFile.encryptionKey = req.encryptionKey;
        existingFile.lastContentChangeAt = new Date();

        await existingFile.save();

        await logActivity(req.user.id, 'file_upload',
          `New version uploaded: ${file.originalname} (v${existingFile.currentVersion})`,
          req, {
            resourceType: 'file',
            resourceId: existingFile._id,
            resourceName: file.originalname
          });

        await notify(req.user.id, {
          type: 'file_upload',
          title: 'New version uploaded',
          message: `Version ${existingFile.currentVersion} of ${file.originalname} was uploaded`,
          icon: 'upload',
          link: `/files`,
          priority: 'low',
          metadata: { fileId: existingFile._id }
        });

        const versionUser = await User.findById(req.user.id).select('storageUsed storageLimit');

        return res.status(200).json({
          success: true,
          message: `New version (v${existingFile.currentVersion}) uploaded successfully`,
          file: existingFile,
          storageUsed: versionUser?.storageUsed ?? 0,
          storageLimit: versionUser?.storageLimit ?? 0
        });
      }
     
      // Create new file record
      const newFile = await File.create({
        originalName: file.originalname,
        filename: storageMode === 's3' ? path.basename(file.key) : file.filename,
        storagePath,
        mimetype: file.mimetype,
        size: file.size,
        owner: req.user.id,
        folder: folderId || null,
        storageMode,
        isEncrypted: req.isEncrypted,
        sha256: req.fileHash,
        encryptionKey: req.encryptionKey,
        lastContentChangeAt: new Date(),
        versions: []
      });

      await logActivity(req.user.id, 'file_upload',
        `File uploaded: ${file.originalname}`,
        req, {
          resourceType: 'file',
          resourceId: newFile._id,
          resourceName: file.originalname,
          metadata: { size: file.size, mimetype: file.mimetype }
        });

      await notify(req.user.id, {
        type: 'file_upload',
        title: 'Upload complete',
        message: `${file.originalname} was uploaded successfully`,
        icon: 'upload',
        link: `/files`,
        priority: 'low',
        metadata: { fileId: newFile._id }
      });

      const uploadedUser = await User.findById(req.user.id).select('storageUsed storageLimit');

      res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        file: newFile,
        storageUsed: uploadedUser?.storageUsed ?? 0,
        storageLimit: uploadedUser?.storageLimit ?? 0
      });
    } catch (dbErr) {
      // DB write failed after the file was stored — roll back both the blob
      // and the storageUsed increment so nothing is leaked or miscounted.
      try {
        await deleteFile(storagePath, storageMode);
      } catch (cleanupErr) {
        console.error(`Error cleaning up upload after DB failure: ${cleanupErr.message}`);
      }
      await decrementStorageUsed(req.user.id, netDelta);
      throw dbErr;
    }

  } catch (error) {
    console.error('Upload error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during file upload'
    });
  }
};

// @desc    Get all files for current user
// @route   GET /api/files
// @access  Private
const getFiles = async (req, res) => {
  try {
    const { folderId, search, tag, page = 1, limit = 20 } = req.query;
    const starred = req.query.starred === 'true';
    const recent = req.query.recent === 'true';

    let query = {
      isDeleted: false
    };

    // Admin sees all files, employee sees only their own
    if (req.user.role !== 'admin') {
      query.owner = req.user.id;
    }

    // Filter by folder
    if (folderId) {
      query.folder = folderId;
    }
    if (starred) {
      query.starred = true;
    }
    // "Starred" and "recent" are global cross-folder views, so skip the
    // default root-level filter when either is active.
    const globalView = starred || recent;
    if (!folderId && !globalView && !search && !tag) {
      query.folder = null; // Root level files
    }

    // Search by name (partial match)
    if (search) {
      query.originalName = { $regex: escapeRegExp(search), $options: 'i' };
    }

    // Filter by tag
    if (tag) {
      query.tags = { $in: [tag] };
    }

    const skip = (page - 1) * limit;

    const files = await File.find(query)
      .populate('owner', 'name email')
      .populate('folder', 'name')
      .sort(recent ? { updatedAt: -1 } : { createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await File.countDocuments(query);

    res.status(200).json({
      success: true,
      count: files.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      files
    });

  } catch (error) {
    console.error('Get files error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching files'
    });
  }
};

// @desc    Get single file
// @route   GET /api/files/:id
// @access  Private
const getFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('folder', 'name');

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check ownership, shared access, or admin (consistent with downloadFile)
    const isOwner = file.owner._id.toString() === req.user.id;
    const isShared = Array.isArray(file.sharedWith) && file.sharedWith.some(
      (uid) => uid && uid.toString() === req.user.id
    );
    if (!isOwner && !isShared && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorised to access this file'
      });
    }

    res.status(200).json({
      success: true,
      file
    });

  } catch (error) {
    console.error('Get file error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching file'
    });
  }
};

// @desc    Download a file
// @route   GET /api/files/:id/download
// @access  Private
const downloadFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id).select('+encryptionKey');

    if (!file || file.isDeleted) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    const isOwner = file.owner.toString() === req.user.id;
    const isShared = Array.isArray(file.sharedWith) && file.sharedWith.some(
      (uid) => uid && uid.toString() === req.user.id
    );
    if (!isOwner && !isShared && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorised to download this file' });
    }

    await logActivity(req.user.id, 'file_download',
      `File downloaded: ${file.originalName}`,
      req, {
        resourceType: 'file',
        resourceId: file._id,
        resourceName: file.originalName
      });

    // Encrypted files must be decrypted before serving, in both storage modes.
    // The S3 signed-URL path is only safe for plaintext blobs.
    if (file.isEncrypted && file.encryptionKey) {
      const buffer = await readFileBuffer(file.storagePath, file.storageMode);
      if (!buffer) {
        return res.status(404).json({ success: false, message: 'File not found on server' });
      }
      // Decrypt before verifying against the plaintext hash.
      const decrypted = decryptBuffer(buffer, file.encryptionKey);
      if (file.sha256 && hashFile(decrypted) !== file.sha256) {
        console.error(`Integrity check failed for ${file.originalName} (${file._id})`);
        return res.status(500).json({ success: false, message: 'File integrity check failed' });
      }
      res.set({
        'Content-Type': file.mimetype || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.originalName)}"`
      });
      return res.send(decrypted);
    }

    if (file.storageMode === 's3') {
      // Get signed URL for S3
      const url = await getFileUrl(file.storagePath, 's3');
      return res.status(200).json({
        success: true,
        downloadUrl: url
      });
    } else {
      // Local file download
      const filePath = path.join(__dirname, '..', file.storagePath);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: 'File not found on server'
        });
      }
      res.download(filePath, file.originalName);
    }

  } catch (error) {
    console.error('Download error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during file download'
    });
  }
};

// @desc    Preview a file inline (streams content for <img> / <iframe>)
// @route   GET /api/files/:id/preview?token=...
// @access  Private (auth via token in query string because <img>/<iframe>
//          cannot send Authorization headers)
const previewFile = async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive || user.isLocked()) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    // Reject tokens issued before the last password change (consistent with protect)
    if (user.passwordChangedAt && decoded.iat) {
      const changedTimestamp = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (decoded.iat < changedTimestamp) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
      }
    }

    const file = await File.findById(req.params.id).populate('sharedWith', 'name email').select('+encryptionKey');
    if (!file || file.isDeleted) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    const isOwner = file.owner.toString() === user._id.toString();
    const isShared = file.sharedWith && file.sharedWith.some(
      (u) => u._id.toString() === user._id.toString()
    );
    if (!isOwner && !isShared && user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to preview this file' });
    }

    if (file.storageMode === 's3') {
      if (file.isEncrypted && file.encryptionKey) {
        const buffer = await readFileBuffer(file.storagePath, 's3');
        const decrypted = decryptBuffer(buffer, file.encryptionKey);
        return res.set('Content-Type', file.mimetype || 'application/octet-stream').send(decrypted);
      }
      const url = await getFileUrl(file.storagePath, 's3');
      return res.status(200).json({ success: true, previewUrl: url });
    }

    const filePath = path.join(__dirname, '..', file.storagePath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found on server' });
    }
    if (file.isEncrypted && file.encryptionKey) {
      const buffer = fs.readFileSync(filePath);
      const decrypted = decryptBuffer(buffer, file.encryptionKey);
      return res.set('Content-Type', file.mimetype || 'application/octet-stream').send(decrypted);
    }
    res.sendFile(filePath, { headers: { 'Content-Type': file.mimetype || 'application/octet-stream' } });
  } catch (error) {
    console.error('Preview error:', error.message);
    res.status(500).json({ success: false, message: 'Server error during preview' });
  }
};

// @desc    Soft delete a file (move to trash)
// @route   DELETE /api/files/:id
// @access  Private
const deleteFileHandler = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check ownership or admin
    if (file.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorised to delete this file'
      });
    }

    // Already in trash: idempotent no-op success so repeat/bulk deletions
    // (including stale UI lists) never fail a batch with a 404.
    if (file.isDeleted) {
      return res.status(200).json({
        success: true,
        message: 'File is already in trash'
      });
    }

    // Soft delete
    file.isDeleted = true;
    file.deletedAt = new Date();
    await file.save();

    await logActivity(req.user.id, 'file_delete',
      `File moved to trash: ${file.originalName}`,
      req, {
        resourceType: 'file',
        resourceId: file._id,
        resourceName: file.originalName
      });

    res.status(200).json({
      success: true,
      message: 'File moved to trash successfully'
    });

  } catch (error) {
    console.error('Delete file error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during file deletion'
    });
  }
};

// @desc    Get trash files
// @route   GET /api/files/trash
// @access  Private
const getTrashFiles = async (req, res) => {
  try {
    const ownerFilter = req.user.role !== 'admin' ? { owner: req.user.id } : {};

    const files = await File.find({ isDeleted: true, ...ownerFilter })
      .populate('owner', 'name email')
      .sort({ deletedAt: -1 });

    const folders = await Folder.find({ isDeleted: true, ...ownerFilter })
      .populate('owner', 'name email')
      .sort({ deletedAt: -1 });

    // Attach a meaningful size to each trash folder (sum of contained files).
    const foldersWithSize = [];
    for (const folder of folders) {
      let total = 0;
      if (folder.owner) {
        const subtreeIds = await getFolderSubtreeIds(folder._id, folder.owner._id);
        const agg = await File.aggregate([
          { $match: { folder: { $in: subtreeIds } } },
          { $group: { _id: null, total: { $sum: { $ifNull: ['$size', 0] } } } }
        ]);
        total = agg[0]?.total || 0;
      }
      foldersWithSize.push({ ...folder.toObject(), totalSize: total });
    }

    res.status(200).json({
      success: true,
      count: files.length + foldersWithSize.length,
      files,
      folderCount: foldersWithSize.length,
      folders: foldersWithSize
    });

  } catch (error) {
    console.error('Get trash error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching trash'
    });
  }
};

// @desc    Restore file from trash
// @route   PUT /api/files/:id/restore
// @access  Private
const restoreFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file || !file.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'File not found in trash'
      });
    }

    // Check ownership or admin
    if (file.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorised to restore this file'
      });
    }

    file.isDeleted = false;
    file.deletedAt = null;
    await file.save();

    await logActivity(req.user.id, 'file_restore',
      `File restored from trash: ${file.originalName}`,
      req, {
        resourceType: 'file',
        resourceId: file._id,
        resourceName: file.originalName
      });

    res.status(200).json({
      success: true,
      message: 'File restored successfully',
      file
    });

  } catch (error) {
    console.error('Restore file error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during file restoration'
    });
  }
};

// @desc    Rename a file
// @route   PUT /api/files/:id/rename
// @access  Private
const renameFile = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'File name is required'
      });
    }

    const newName = name.trim();
    if (newName.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'File name cannot exceed 255 characters'
      });
    }

    const file = await File.findById(req.params.id);
    if (!file || file.isDeleted) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    if (file.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorised to rename this file' });
    }

    // Prevent case-insensitive duplicate names within the same folder
    const duplicate = await File.findOne({
      originalName: newName,
      owner: file.owner,
      folder: file.folder,
      isDeleted: false,
      _id: { $ne: file._id }
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'A file with that name already exists in this folder'
      });
    }

    const oldName = file.originalName;
    file.originalName = newName;
    await file.save();

    await logActivity(req.user.id, 'file_rename',
      `File renamed: ${oldName} → ${newName}`,
      req, {
        resourceType: 'file',
        resourceId: file._id,
        resourceName: newName
      });

    res.status(200).json({
      success: true,
      message: 'File renamed successfully',
      file
    });
  } catch (error) {
    console.error('Rename file error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during file rename'
    });
  }
};

// @desc    Move a file to another folder
// @route   PUT /api/files/:id/move
// @access  Private
const moveFile = async (req, res) => {
  try {
    const { folderId } = req.body;
    const Folder = require('../models/Folder');

    // Validate target folder (if provided) belongs to the same owner
    if (folderId) {
      const folder = await Folder.findById(folderId);
      if (!folder || folder.isDeleted) {
        return res.status(404).json({ success: false, message: 'Destination folder not found' });
      }
      if (folder.owner.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Not authorised to use this folder' });
      }
    }

    const file = await File.findById(req.params.id);
    if (!file || file.isDeleted) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    if (file.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorised to move this file' });
    }

    const targetFolder = folderId || null;

    // Prevent case-insensitive duplicate names in the destination folder
    const duplicate = await File.findOne({
      originalName: file.originalName,
      owner: file.owner,
      folder: targetFolder,
      isDeleted: false,
      _id: { $ne: file._id }
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'A file with that name already exists in the destination folder'
      });
    }

    file.folder = targetFolder;
    await file.save();

    await logActivity(req.user.id, 'file_move',
      `File moved: ${file.originalName}`,
      req, {
        resourceType: 'file',
        resourceId: file._id,
        resourceName: file.originalName,
        metadata: { folderId: targetFolder }
      });

    res.status(200).json({
      success: true,
      message: 'File moved successfully',
      file
    });
  } catch (error) {
    console.error('Move file error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during file move'
    });
  }
};

// @desc    Permanently delete a file
// @route   DELETE /api/files/:id/permanent
// @access  Private
const permanentDeleteFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check ownership or admin
    if (file.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorised to permanently delete this file'
      });
    }

    // Delete from storage
    await deleteFile(file.storagePath, file.storageMode);

    // Delete all versions from storage
    for (const version of file.versions) {
      try {
        await deleteFile(version.storagePath, file.storageMode);
      } catch (err) {
        console.error(`Error deleting version: ${err.message}`);
      }
    }

    // Remove the file's physical blobs (done above via deleteFile loops).

    await logActivity(req.user.id, 'file_permanent_delete',
      `File permanently deleted: ${file.originalName}`,
      req, {
        resourceType: 'file',
        resourceId: file._id,
        resourceName: file.originalName
      });

    // Delete from database
    await File.findByIdAndDelete(req.params.id);

    // Recompute the owner's storageUsed from their remaining actual files.
    await recomputeStorageUsed(file.owner);

    const updatedUser = await User.findById(file.owner).select('storageUsed storageLimit');

    res.status(200).json({
      success: true,
      message: 'File permanently deleted',
      storageUsed: updatedUser?.storageUsed ?? 0,
      storageLimit: updatedUser?.storageLimit ?? 0
    });

  } catch (error) {
    console.error('Permanent delete error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during permanent deletion'
    });
  }
};

// @desc    Restore a specific file version
// @route   PUT /api/files/:id/version/:versionNumber
// @access  Private
const restoreVersion = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check ownership or admin
    if (file.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorised to restore this file version'
      });
    }

    const versionNumber = parseInt(req.params.versionNumber);
    const version = file.versions.find(v => v.versionNumber === versionNumber);

    if (!version) {
      return res.status(404).json({
        success: false,
        message: 'Version not found'
      });
    }

    // Save current as a version, unless an identical entry already exists
    const alreadySaved = file.versions.some(v =>
      v.storagePath === file.storagePath && v.size === file.size
    );
    if (!alreadySaved) {
      file.versions.push({
        versionNumber: file.currentVersion,
        filename: file.filename,
        storagePath: file.storagePath,
        size: file.size
      });
    }

    // Capture the total storage this file accounted for before any changes.
    const beforeSize = distinctBlobSize(file);

    // The restored version is becoming the live file — remove it from the
    // versions array so it is not treated as an old version (or deleted).
    file.versions = file.versions.filter(v => v.storagePath !== version.storagePath || v.versionNumber !== versionNumber);

    // Deduplicate by blob so the same physical file is only counted once.
    const seen = new Set();
    file.versions = file.versions.filter(v => {
      if (seen.has(v.storagePath)) return false;
      seen.add(v.storagePath);
      return true;
    });

    // Restore selected version as the live file.
    const restoredVersionNumber = version.versionNumber;
    file.filename = version.filename;
    file.storagePath = version.storagePath;
    file.size = version.size;
    file.lastContentChangeAt = new Date();

    // Stable labels: the restored version KEEPS its number, so the tick lands
    // on exactly the version the user chose (restore v2 -> current is v2).
    file.currentVersion = restoredVersionNumber;

    // Keep only last 3 versions — delete the oldest physical file.
    // Safe now: the just-restored blob has been removed from the array.
    await trimToCap(file, 3, deleteFile);

    // Reconcile storageUsed by the change in distinct blobs (can be negative).
    const afterSize = distinctBlobSize(file);

    const storageDelta = afterSize - beforeSize;
    await file.save();

    if (storageDelta !== 0) {
      await adjustStorageUsed(file.owner, storageDelta);
    }

    await logActivity(req.user.id, 'file_version_restore',
      `Version ${versionNumber} restored for: ${file.originalName}`,
      req, {
        resourceType: 'file',
        resourceId: file._id,
        resourceName: file.originalName,
        metadata: { restoredVersion: versionNumber }
      });

    const versionUserData = await User.findById(file.owner).select('storageUsed storageLimit');

    res.status(200).json({
      success: true,
      message: `Version ${versionNumber} restored successfully`,
      file,
      storageUsed: versionUserData?.storageUsed ?? 0,
      storageLimit: versionUserData?.storageLimit ?? 0
    });

  } catch (error) {
    console.error('Restore version error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during version restoration'
    });
  }
};

// @desc    Delete a specific previous file version
// @route   DELETE /api/files/:id/version/:versionNumber
// @access  Private
const deleteVersion = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check ownership or admin
    if (file.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorised to delete this file version'
      });
    }

    const versionNumber = parseInt(req.params.versionNumber);
    const version = file.versions.find(v => v.versionNumber === versionNumber);

    if (!version) {
      return res.status(404).json({
        success: false,
        message: 'Version not found'
      });
    }

    // Capture total storage before the change (live + distinct version blobs).
    const beforeSize = distinctBlobSize(file);

    // Only delete the physical blob if no other version (or the live file)
    // still references the same storagePath — otherwise keep the blob.
    const stillReferenced = file.versions.some(v =>
      v.storagePath === version.storagePath && v !== version
    ) || file.storagePath === version.storagePath;

    file.versions = file.versions.filter(v => v.versionNumber !== versionNumber);

    if (!stillReferenced) {
      try {
        await deleteFile(version.storagePath, file.storageMode);
      } catch (err) {
        console.error(`Error deleting version blob: ${err.message}`);
      }
    }

    // Stable labels: the live file keeps its number; the deleted number's gap
    // is intentional (it was that version's identity).
    await file.save();

    // Reconcile storageUsed by the change in distinct blobs (can be zero if
    // the blob is still referenced elsewhere).
    const storageDelta = distinctBlobSize(file) - beforeSize;
    if (storageDelta !== 0) {
      await adjustStorageUsed(file.owner, storageDelta);
    }

    await logActivity(req.user.id, 'file_version_delete',
      `Version ${versionNumber} deleted from: ${file.originalName}`,
      req, {
        resourceType: 'file',
        resourceId: file._id,
        resourceName: file.originalName,
        metadata: { deletedVersion: versionNumber }
      });

    const versionUserData = await User.findById(file.owner).select('storageUsed storageLimit');

    res.status(200).json({
      success: true,
      message: `Version ${versionNumber} deleted successfully`,
      file,
      storageUsed: versionUserData?.storageUsed ?? 0,
      storageLimit: versionUserData?.storageLimit ?? 0
    });

  } catch (error) {
    console.error('Delete version error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during version deletion'
    });
  }
};

// @desc    Get all folders
// @route   GET /api/files/folders
// @access  Private
const getFolders = async (req, res) => {
  try {
    const Folder = require('../models/Folder');
    let query = { isDeleted: false };

    const starred = req.query.starred === 'true';
    const recent = req.query.recent === 'true';
    // "Starred" / "recent" are global cross-folder views, so do not force
    // parent = null in those cases.
    const globalView = starred || recent;
    if (req.query.folderId) {
      query.parent = req.query.folderId;
    } else if (!globalView) {
      query.parent = null;
    }
    if (starred) {
      query.starred = true;
    }

    if (req.user.role !== 'admin') {
      query.owner = req.user.id;
    }

    const folders = await Folder.find(query).sort(recent ? { updatedAt: -1 } : { createdAt: -1 });

    res.status(200).json({
      success: true,
      count: folders.length,
      folders
    });
  } catch (error) {
    console.error('Get folders error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching folders'
    });
  }
};

// @desc    Create folder
// @route   POST /api/files/folders
// @access  Private
const createFolder = async (req, res) => {
  try {
    const Folder = require('../models/Folder');
    const { name, parent, color } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Folder name is required'
      });
    }

    // Validate parent folder (if provided) belongs to this user — mirrors the
    // destination-folder check in uploadFile/moveFile.
    if (parent) {
      const parentFolder = await Folder.findById(parent);
      if (!parentFolder || parentFolder.isDeleted) {
        return res.status(404).json({ success: false, message: 'Parent folder not found' });
      }
      if (parentFolder.owner.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Not authorised to create a folder in this location' });
      }
    }

    const folder = await Folder.create({
      name: name.trim(),
      owner: req.user.id,
      parent: parent || null,
      color: color || '#1F3864'
    });

    await logActivity(req.user.id, 'folder_create',
      `Folder created: ${name}`,
      req, {
        resourceType: 'folder',
        resourceId: folder._id,
        resourceName: name
      });

    res.status(201).json({
      success: true,
      message: 'Folder created successfully',
      folder
    });
  } catch (error) {
    console.error('Create folder error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while creating folder'
    });
  }
};

// @desc    Rename folder
// @route   PUT /api/files/folders/:id
// @access  Private
const renameFolder = async (req, res) => {
  try {
    const Folder = require('../models/Folder');
    const { name, color } = req.body;

    if (name !== undefined && (!name || !name.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Folder name cannot be empty'
      });
    }

    if (name === undefined && color === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Nothing to update'
      });
    }

    const folder = await Folder.findById(req.params.id);
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    if (folder.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorised to rename this folder' });
    }

    const oldName = folder.name;
    if (name && name.trim()) {
      folder.name = name.trim();
    }
    if (color && /^#[0-9a-fA-F]{3,8}$/.test(color)) {
      folder.color = color;
    }
    await folder.save();

    const renamed = name && name.trim() && oldName !== folder.name;
    await logActivity(req.user.id, renamed ? 'folder_rename' : 'folder_color_change',
      renamed ? `Folder renamed: ${oldName} → ${folder.name}` : `Folder color changed: ${folder.name}`,
      req, {
        resourceType: 'folder',
        resourceId: folder._id,
        resourceName: folder.name
      });

    res.status(200).json({
      success: true,
      message: 'Folder renamed successfully',
      folder
    });
  } catch (error) {
    console.error('Rename folder error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during folder rename'
    });
  }
};

// @desc    Delete folder
// @route   DELETE /api/files/folders/:id
// @access  Private
const deleteFolder = async (req, res) => {
  try {
    const Folder = require('../models/Folder');
    const folder = await Folder.findById(req.params.id);

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    if (folder.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorised to delete this folder'
      });
    }

    // Soft-delete this folder, its descendants, and their files.
    const folderIds = [folder._id];
    let queue = [folder._id];
    while (queue.length > 0) {
      const children = await Folder.find({
        parent: { $in: queue },
        isDeleted: false,
        owner: folder.owner
      }).select('_id');
      const childIds = children.map((c) => c._id);
      folderIds.push(...childIds);
      queue = childIds;
    }

    await Folder.updateMany(
      { _id: { $in: folderIds }, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );

    await File.updateMany(
      { folder: { $in: folderIds }, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );

    await logActivity(req.user.id, 'folder_delete',
      `Folder deleted: ${folder.name} (${folderIds.length} folder(s), including contents)`,
      req, {
        resourceType: 'folder',
        resourceId: folder._id,
        resourceName: folder.name
      });

    res.status(200).json({
      success: true,
      message: `Folder deleted (${folderIds.length} folder(s), including contained files)`
    });
  } catch (error) {
    console.error('Delete folder error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting folder'
    });
  }
};

// Collect every folder id under a root folder (including the root), BFS.
const getFolderSubtreeIds = async (rootId, ownerId) => {
  const ids = [rootId];
  let queue = [rootId];
  while (queue.length > 0) {
    const children = await Folder.find({
      parent: { $in: queue },
      owner: ownerId
    }).select('_id');
    const childIds = children.map((c) => c._id);
    ids.push(...childIds);
    queue = childIds;
  }
  return ids;
};

// Permanently remove a single file: delete its blobs, return deduplicated size.
const permanentlyDeleteFileDoc = async (file) => {
  await deleteFile(file.storagePath, file.storageMode);
  for (const version of file.versions || []) {
    try {
      await deleteFile(version.storagePath, file.storageMode);
    } catch (err) {
      console.error(`Error deleting version blob: ${err.message}`);
    }
  }
  const blobs = new Set([file.storagePath]);
  let totalSize = Number(file.size) || 0;
  for (const version of file.versions || []) {
    if (!blobs.has(version.storagePath)) {
      blobs.add(version.storagePath);
      totalSize += Number(version.size) || 0;
    }
  }
  return totalSize;
};

// Permanently delete a folder subtree: blobs, contained files, folder docs.
// Returns counts + deduplicated total size freed.
const permanentlyDeleteFolderSubtree = async (folder) => {
  const subtreeIds = await getFolderSubtreeIds(folder._id, folder.owner);
  const files = await File.find({ folder: { $in: subtreeIds } });

  const seen = new Set();
  let totalSize = 0;
  for (const file of files) {
    if (!seen.has(file.storagePath)) {
      seen.add(file.storagePath);
      totalSize += Number(file.size) || 0;
    }
    for (const version of file.versions || []) {
      if (!seen.has(version.storagePath)) {
        seen.add(version.storagePath);
        totalSize += Number(version.size) || 0;
      }
    }
  }

  for (const file of files) {
    try {
      await deleteFile(file.storagePath, file.storageMode);
    } catch (err) {
      console.error(`Error deleting folder-content blob ${file.storagePath}: ${err.message}`);
    }
    for (const version of file.versions || []) {
      try {
        await deleteFile(version.storagePath, file.storageMode);
      } catch (err) {
        console.error(`Error deleting folder-content version blob ${version.storagePath}: ${err.message}`);
      }
    }
  }

  await File.deleteMany({ folder: { $in: subtreeIds } });
  await Folder.deleteMany({ _id: { $in: subtreeIds } });

  return {
    deletedFiles: files.length,
    deletedFolders: subtreeIds.length,
    totalSize
  };
};

// @desc    Restore a folder and its contents from trash
// @route   PUT /api/files/folders/:id/restore
const restoreFolder = async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);

    if (!folder || !folder.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found in trash'
      });
    }

    if (folder.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorised to restore this folder'
      });
    }

    // Restore this folder, all of its descendants, and any deleted ancestors
    // so the folder tree is never left pointing at a deleted parent.
    const subtreeIds = await getFolderSubtreeIds(folder._id, folder.owner);
    const restoreIds = [...subtreeIds];

    let ancestor = folder.parent;
    while (ancestor) {
      const parent = await Folder.findById(ancestor);
      if (!parent || !parent.isDeleted) break;
      if (parent.owner.toString() !== folder.owner.toString()) break;
      restoreIds.push(parent._id);
      ancestor = parent.parent;
    }

    await Folder.updateMany(
      { _id: { $in: restoreIds }, isDeleted: true },
      { $set: { isDeleted: false, deletedAt: null } }
    );

    const updatedFiles = await File.updateMany(
      { folder: { $in: subtreeIds }, isDeleted: true },
      { $set: { isDeleted: false, deletedAt: null } }
    );

    await logActivity(req.user.id, 'folder_restore',
      `Folder restored from trash: ${folder.name} (${updatedFiles.modifiedCount || 0} file(s))`,
      req, {
        resourceType: 'folder',
        resourceId: folder._id,
        resourceName: folder.name
      });

    res.status(200).json({
      success: true,
      message: 'Folder restored successfully'
    });
  } catch (error) {
    console.error('Restore folder error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while restoring folder'
    });
  }
};

// @desc    Permanently delete a folder and its contents
// @route   DELETE /api/files/folders/:id/permanent
const permanentDeleteFolder = async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);

    if (!folder || !folder.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found in trash'
      });
    }

    if (folder.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorised to permanently delete this folder'
      });
    }

    const result = await permanentlyDeleteFolderSubtree(folder);

    // Recompute the owner's storageUsed from their remaining actual files.
    await recomputeStorageUsed(folder.owner);

    await logActivity(req.user.id, 'folder_permanent_delete',
      `Folder permanently deleted: ${folder.name} (${result.deletedFiles} file(s), ${result.deletedFolders} folder(s))`,
      req, {
        resourceType: 'folder',
        resourceId: folder._id,
        resourceName: folder.name
      });

    const updatedUser = await User.findById(folder.owner).select('storageUsed storageLimit');

    res.status(200).json({
      success: true,
      message: 'Folder permanently deleted',
      storageUsed: updatedUser?.storageUsed ?? 0,
      storageLimit: updatedUser?.storageLimit ?? 0
    });
  } catch (error) {
    console.error('Permanent delete folder error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during permanent folder deletion'
    });
  }
};

// @desc    Permanently delete everything in the trash
// @route   DELETE /api/files/trash/empty
const emptyTrash = async (req, res) => {
  try {
    const ownerFilter = req.user.role !== 'admin' ? { owner: req.user.id } : {};

    let folderCount = 0;
    let fileCount = 0;
    const sizeByOwner = {};

    const addOwnerSize = (ownerId, size) => {
      if (!size) return;
      const key = String(ownerId);
      sizeByOwner[key] = (sizeByOwner[key] || 0) + size;
    };

    // 1) Hard-delete every deleted folder (recurses through its contents).
    const deletedFolders = await Folder.find({ isDeleted: true, ...ownerFilter });
    for (const folder of deletedFolders) {
      const result = await permanentlyDeleteFolderSubtree(folder);
      folderCount += result.deletedFolders;
      fileCount += result.deletedFiles;
      addOwnerSize(folder.owner, result.totalSize);
    }

    // 2) Hard-delete the remaining files not inside any deleted folder.
    const remainingFiles = await File.find({ isDeleted: true, ...ownerFilter });
    for (const file of remainingFiles) {
      const size = await permanentlyDeleteFileDoc(file);
      fileCount += 1;
      addOwnerSize(file.owner, size);
    }
    await File.deleteMany({ _id: { $in: remainingFiles.map((f) => f._id) } });

    // Recompute storageUsed for each owner that had items hard-deleted, so the
    // value is exact and self-correcting rather than an incremental tally.
    const ownersAffected = new Set([...Object.keys(sizeByOwner)]);
    if (req.user.role !== 'admin') ownersAffected.add(req.user.id);
    for (const ownerId of ownersAffected) {
      await recomputeStorageUsed(ownerId);
    }

    await logActivity(req.user.id, 'file_permanent_delete',
      `Trash emptied: ${fileCount} file(s), ${folderCount} folder(s) permanently deleted`,
      req, {
        resourceType: 'file',
        resourceName: 'Trash'
      });

    const updatedUser = await User.findById(req.user.id).select('storageUsed storageLimit');

    res.status(200).json({
      success: true,
      message: 'Trash emptied successfully',
      fileCount,
      folderCount,
      storageUsed: updatedUser?.storageUsed ?? 0,
      storageLimit: updatedUser?.storageLimit ?? 0
    });
  } catch (error) {
    console.error('Empty trash error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while emptying trash'
    });
  }
};

// @desc    Share a file with users
// @route   PUT /api/files/:id/share
// @access  Private
const shareFile = async (req, res) => {
  try {
    const { userIds } = req.body;
    const file = await File.findById(req.params.id);

    if (!file || file.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Only file owner or admin can share
    if (file.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorised to share this file'
      });
    }

    // Validate the user list
    if (!Array.isArray(userIds)) {
      return res.status(400).json({
        success: false,
        message: 'userIds must be an array of user ids'
      });
    }

    const validIds = userIds.filter(id => id && typeof id === 'string');
    if (validIds.length !== userIds.length) {
      return res.status(400).json({
        success: false,
        message: 'userIds contains invalid entries'
      });
    }

    // Ensure all referenced users actually exist
    const users = await User.find({ _id: { $in: validIds } }).select('_id role');
    const existingIds = new Set(users.map(u => u._id.toString()));
    const knownIds = validIds.filter(id => existingIds.has(id.toString()));

    // Cannot share with yourself, nor with admins (admins already have global
    // access to every file, so sharing with them is redundant).
    const filteredUserIds = knownIds.filter(id => {
      if (id.toString() === req.user.id) return false;
      const target = users.find(u => u._id.toString() === id.toString());
      return !target || target.role !== 'admin';
    });

    file.sharedWith = filteredUserIds;
    await file.save();

    // Notify each user the file was shared with
    if (filteredUserIds.length > 0) {
      await notifyMany(filteredUserIds, {
        type: 'file_share',
        title: 'File shared with you',
        message: `${file.originalName} was shared with you by ${req.user.name || 'a user'}`,
        icon: 'share',
        link: `/files`,
        priority: 'medium',
        metadata: { fileId: file._id }
      });
    }

    await logActivity(req.user.id, 'file_share',
      `File shared: ${file.originalName} with ${filteredUserIds.length} user(s)`,
      req, {
        resourceType: 'file',
        resourceId: file._id,
        resourceName: file.originalName,
        metadata: { sharedWith: filteredUserIds }
      });

    res.status(200).json({
      success: true,
      message: 'File sharing updated successfully',
      sharedWith: filteredUserIds
    });

  } catch (error) {
    console.error('Share file error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while sharing file'
    });
  }
};

// @desc    Get files shared with current user
// @route   GET /api/files/shared-with-me
// @access  Private
const getSharedWithMe = async (req, res) => {
  try {
    const files = await File.find({
      sharedWith: req.user.id,
      isDeleted: false
    })
      .populate('owner', 'name email')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: files.length,
      files
    });

  } catch (error) {
    console.error('Get shared files error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching shared files'
    });
  }
};

// @desc    Purge soft-deleted files that have been in trash longer than the retention period
// @access  Internal (scheduled job)
const cleanExpiredTrash = async (retentionDays = 30) => {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  // Purge expired deleted folders first (recurses through their contents, so
  // the file purge below only sees remaining stray files with no overlap).
  const expiredFolders = await Folder.find({
    isDeleted: true,
    deletedAt: { $lt: cutoff }
  });

  let cleanedFolders = 0;
  let cleanedFolderFiles = 0;
  for (const folder of expiredFolders) {
    try {
      const result = await permanentlyDeleteFolderSubtree(folder);
      await recomputeStorageUsed(folder.owner);
      cleanedFolders += result.deletedFolders;
      cleanedFolderFiles += result.deletedFiles;
    } catch (err) {
      console.error(`Error purging trash folder ${folder._id}: ${err.message}`);
    }
  }

  if (cleanedFolders > 0) {
    console.log(`Trash cleanup: permanently deleted ${cleanedFolders} expired folder(s) (${cleanedFolderFiles} contained file(s))`);
  }

  const expired = await File.find({
    isDeleted: true,
    deletedAt: { $lt: cutoff }
  });

  let cleaned = 0;
  for (const file of expired) {
    try {
      await deleteFile(file.storagePath, file.storageMode);
      for (const version of file.versions || []) {
        try {
          await deleteFile(version.storagePath, file.storageMode);
        } catch (err) {
          console.error(`Error deleting version blob during trash purge: ${err.message}`);
        }
      }

      await File.findByIdAndDelete(file._id);

      // Recompute the owner's storageUsed from their remaining actual files.
      await recomputeStorageUsed(file.owner);

      cleaned += 1;
    } catch (err) {
      console.error(`Error purging trash file ${file._id}: ${err.message}`);
    }
  }

  if (cleaned > 0) {
    console.log(`Trash cleanup: permanently deleted ${cleaned} expired file(s)`);
  }
  return cleaned;
};

// @desc    Update a file's tags
// @route   PUT /api/files/:id/tags
// @access  Private
const updateFileTags = async (req, res) => {
  try {
    const { tags } = req.body;

    if (!Array.isArray(tags)) {
      return res.status(400).json({
        success: false,
        message: 'tags must be an array of strings'
      });
    }

    // Normalise: trim, lowercase, remove empties, cap at 10 tags / 20 chars each
    const cleaned = [...new Set(
      tags
        .filter(t => typeof t === 'string')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0 && t.length <= 20)
    )].slice(0, 10);

    const file = await File.findById(req.params.id);
    if (!file || file.isDeleted) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    if (file.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorised to update this file' });
    }

    file.tags = cleaned;
    await file.save();

    await logActivity(req.user.id, 'file_tags_update',
      `Tags updated for: ${file.originalName}`,
      req, {
        resourceType: 'file',
        resourceId: file._id,
        resourceName: file.originalName,
        metadata: { tags: cleaned }
      });

    res.status(200).json({
      success: true,
      message: 'Tags updated successfully',
      tags: cleaned,
      file
    });
  } catch (error) {
    console.error('Update tags error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while updating tags'
    });
  }
};

// @desc    Star / unstar a file (favorites)
// @route   PUT /api/files/:id/star
// @access  Private
const starFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file || file.isDeleted) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    if (file.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorised to update this file' });
    }

    file.starred = req.body.starred === true;
    await File.updateOne({ _id: file._id }, { $set: { starred: file.starred } }, { timestamps: false });

    res.status(200).json({
      success: true,
      starred: file.starred,
      file
    });
  } catch (error) {
    console.error('Star file error:', error.message);
    res.status(500).json({ success: false, message: 'Server error while updating star' });
  }
};

// @desc    Star / unstar a folder (favorites)
// @route   PUT /api/files/folders/:id/star
// @access  Private
const starFolder = async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);
    if (!folder || folder.isDeleted) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }
    if (folder.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorised to update this folder' });
    }

    folder.starred = req.body.starred === true;
    await Folder.updateOne({ _id: folder._id }, { $set: { starred: folder.starred } }, { timestamps: false });

    res.status(200).json({
      success: true,
      starred: folder.starred,
      folder
    });
  } catch (error) {
    console.error('Star folder error:', error.message);
    res.status(500).json({ success: false, message: 'Server error while updating star' });
  }
};

// @desc    Get all tags used by a user's files (for filters/autocomplete)
// @route   GET /api/files/tags
// @access  Private
const getAllTags = async (req, res) => {
  try {
    let query = { isDeleted: false };
    if (req.user.role !== 'admin') {
      query.owner = req.user.id;
    }

    const files = await File.find(query, { tags: 1 }).lean();
    const tagSet = new Set();
    for (const f of files) {
      for (const t of f.tags || []) tagSet.add(t);
    }

    const tags = [...tagSet].sort();

    res.status(200).json({
      success: true,
      count: tags.length,
      tags
    });
  } catch (error) {
    console.error('Get tags error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tags'
    });
  }
};

module.exports = {
  uploadFile,
  getFiles,
  getFile,
  downloadFile,
  previewFile,
  deleteFileHandler,
  getTrashFiles,
  restoreFile,
  renameFile,
  moveFile,
  permanentDeleteFile,
  restoreVersion,
  deleteVersion,
  getFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  restoreFolder,
  permanentDeleteFolder,
  emptyTrash,
  shareFile,
  getSharedWithMe,
  updateFileTags,
  starFile,
  starFolder,
  getAllTags,
  cleanExpiredTrash
};
