const express = require('express');
const router = express.Router();
const {
  register,
  login,
  adminLogin,
  getMe,
  googleAuth,
  logout,
} = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const { authLimiter } = require('../middlewares/rateLimiter');

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/admin/login', authLimiter, adminLogin);
router.get('/me', protect, getMe);
router.post('/google', authLimiter, googleAuth);
router.get('/logout', protect, logout);

module.exports = router;