const express = require('express');
const router = express.Router();
const {
  triggerManualBackup,
  triggerMyBackup,
  getMyBackups,
  getBackups,
  getBackup,
  downloadBackup,
  deleteBackup,
  restoreBackup,
  getRetentionSettings,
  updateRetentionSettings
} = require('../controllers/backupController');
const { protect } = require('../middleware/authMiddleware');
const { authorise } = require('../middleware/roleMiddleware');

// Employee routes
router.post('/my-backup', protect, triggerMyBackup);
router.get('/my-backups', protect, getMyBackups);

// Retention settings
router.get('/retention', protect, authorise('admin'), getRetentionSettings);
router.put('/retention', protect, authorise('admin'), updateRetentionSettings);

// Admin routes
router.post('/manual', protect, authorise('admin'), triggerManualBackup);
router.get('/', protect, authorise('admin'), getBackups);
router.get('/:id', protect, authorise('admin'), getBackup);
router.get('/:id/download', protect, downloadBackup);
router.post('/:id/restore', protect, restoreBackup);
router.delete('/:id', protect, deleteBackup);

module.exports = router;