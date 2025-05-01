const express = require('express');
const router = express.Router();
const {
  getUserProfile,
  updateUserProfile,
  updatePassword,
  deleteUserAccount,
} = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/me', getUserProfile);
router.put('/me', updateUserProfile);
router.put('/updatepassword', updatePassword);
router.delete('/me', deleteUserAccount);

module.exports = router;