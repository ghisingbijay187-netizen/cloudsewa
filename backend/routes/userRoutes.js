const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUser,
  getPendingRegistrations,
  getRejectedRegistrations,
  createUser,
  updateUser,
  deactivateUser,
  deleteUser,
  unlockUser,
  approveRegistration,
  rejectRegistration
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { authorise } = require('../middleware/roleMiddleware');

// Public to all authenticated users — for file sharing
router.get('/directory', protect, async (req, res) => {
  try {
    const User = require('../models/User');
    // $nin matches legacy users created before registrationStatus existed (effectively approved)
    const users = await User.find({ isActive: true, registrationStatus: { $nin: ['pending', 'rejected'] } })
      .select('name email role')
      .sort({ name: 1 });
    res.status(200).json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin only routes
router.get('/', protect, authorise('admin'), getUsers);
router.get('/pending', protect, authorise('admin'), getPendingRegistrations);
router.get('/rejected', protect, authorise('admin'), getRejectedRegistrations);
router.get('/:id', protect, authorise('admin'), getUser);
router.post('/', protect, authorise('admin'), createUser);
router.put('/:id', protect, authorise('admin'), updateUser);
router.put('/:id/approve', protect, authorise('admin'), approveRegistration);
router.put('/:id/reject', protect, authorise('admin'), rejectRegistration);
router.put('/:id/deactivate', protect, authorise('admin'), deactivateUser);
router.put('/:id/unlock', protect, authorise('admin'), unlockUser);
router.delete('/:id', protect, authorise('admin'), deleteUser);

module.exports = router;