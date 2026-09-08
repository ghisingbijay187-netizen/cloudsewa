const express = require('express');
const router = express.Router();
const {
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
  getAllTags,
  starFile,
  starFolder
} = require('../controllers/fileController');
const { protect } = require('../middleware/authMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const { uploadLimiter } = require('../middleware/rateLimiter');

// Folder routes
router.get('/folders', protect, getFolders);
router.post('/folders', protect, createFolder);
router.put('/folders/:id', protect, renameFolder);
router.put('/folders/:id/restore', protect, restoreFolder);
router.put('/folders/:id/star', protect, starFolder);
router.delete('/folders/:id', protect, deleteFolder);
router.delete('/folders/:id/permanent', protect, permanentDeleteFolder);

// Shared with me
router.get('/shared-with-me', protect, getSharedWithMe);

// Tags
router.get('/tags', protect, getAllTags);

// Trash
router.get('/trash', protect, getTrashFiles);
router.delete('/trash/empty', protect, emptyTrash);

// File routes
router.get('/', protect, getFiles);
router.get('/:id', protect, getFile);
router.post('/upload', protect, uploadLimiter, uploadSingle, uploadFile);
router.get('/:id/download', protect, downloadFile);
router.get('/:id/preview', previewFile);
router.delete('/:id', protect, deleteFileHandler);
router.put('/:id/restore', protect, restoreFile);
router.put('/:id/rename', protect, renameFile);
router.put('/:id/move', protect, moveFile);
router.delete('/:id/permanent', protect, permanentDeleteFile);
router.put('/:id/version/:versionNumber', protect, restoreVersion);
router.delete('/:id/version/:versionNumber', protect, deleteVersion);
router.put('/:id/share', protect, shareFile);
router.put('/:id/star', protect, starFile);
router.put('/:id/tags', protect, updateFileTags);

module.exports = router;