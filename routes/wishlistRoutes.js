const express = require('express');
const router = express.Router();
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  moveToCart
} = require('../controllers/wishlistController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/', getWishlist);
router.post('/', addToWishlist);
router.delete('/:itemId', removeFromWishlist);
router.post('/:itemId/move-to-cart', moveToCart);

module.exports = router;