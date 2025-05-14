const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProduct,
  createProductReview,
  getProductReviews,
  updateProductReview,
  deleteReview,
  compareProducts,
  searchProducts,
  getSearchFilters
} = require('../controllers/productController');
const { protect } = require('../middlewares/authMiddleware');
const advancedResults = require('../middlewares/advancedResults');
const Product = require('../models/Product');

router.get('/', advancedResults(Product), getProducts);
router.get('/search', searchProducts);
router.get('/search/filters', getSearchFilters);
router.get('/:id', getProduct);
router.post('/:id/reviews', protect, createProductReview);
router.get('/:id/reviews', getProductReviews);
router.put('/:productId/reviews/:reviewId', protect, updateProductReview);
router.post('/compare', compareProducts);
router.delete('/:productId/reviews/:reviewId', protect, deleteReview);

module.exports = router;