const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getOrders,
  getOrder,
  updateOrder,
  deleteOrder,
  getDashboardStats,
  generateUsersPdf,
  generateProductsPdf,
  generateOrdersPdf,
  generateSalesReportPdf
} = require('../controllers/adminController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const advancedResults = require('../middlewares/advancedResults');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');

// Re-route into other resource routers

// User routes
router.use(protect);
router.use(authorize('admin'));

router.get('/users', advancedResults(User), getUsers);
router.get('/users/:id', getUser);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.get('/users-list/pdf', generateUsersPdf);

// Product routes
router.get('/products', advancedResults(Product), getProducts);
router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);
router.get('/products-list/pdf', generateProductsPdf);

// Order routes
router.get('/orders', advancedResults(Order), getOrders);
router.get('/orders/:id', getOrder);
router.put('/orders/:id', updateOrder);
router.delete('/orders/:id', deleteOrder);
router.get('/orders-list/pdf', generateOrdersPdf);

router.get('/sales-report/pdf', generateSalesReportPdf);


// Dashboard stats
router.get('/dashboard-stats', getDashboardStats);

module.exports = router;