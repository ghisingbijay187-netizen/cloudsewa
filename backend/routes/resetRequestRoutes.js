const express = require('express');
const router = express.Router();
const {
  getResetRequests,
  approveResetRequest,
  rejectResetRequest
} = require('../controllers/resetRequestController');
const { protect } = require('../middleware/authMiddleware');
const { authorise } = require('../middleware/roleMiddleware');

router.get('/', protect, authorise('admin'), getResetRequests);
router.put('/:id/approve', protect, authorise('admin'), approveResetRequest);
router.put('/:id/reject', protect, authorise('admin'), rejectResetRequest);

module.exports = router;