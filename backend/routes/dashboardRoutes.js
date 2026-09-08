const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getActivityLogs,
  getStorageStats
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');
const { authorise } = require('../middleware/roleMiddleware');

router.get('/stats', protect, authorise('admin'), getDashboardStats);
router.get('/activity', protect, getActivityLogs);
router.get('/storage', protect, authorise('admin'), getStorageStats);

module.exports = router;