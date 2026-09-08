const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  logout,
  updatePassword,
  updateProfile,
  forgotPassword,
  checkResetStatus,
  checkRegistrationStatus,
  resetPassword
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', register);
router.post('/login', authLimiter, login);
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);
router.put('/password', protect, updatePassword);
router.put('/profile', protect, updateProfile);
router.post('/forgot-password', authLimiter, forgotPassword);
router.get('/reset-status/:requestId', checkResetStatus);
router.get('/registration-status/:userId', checkRegistrationStatus);
router.put('/reset-password/:token', resetPassword);

module.exports = router;