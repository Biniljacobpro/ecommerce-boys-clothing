const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrder,
  getMyOrders,
  updateOrderToDelivered,
  cancelOrder,
  generateOrderPdf
} = require('../controllers/orderController');
const { protect, authorize } = require('../middlewares/authMiddleware');

router.use(protect);

router.post('/', createOrder);
router.get('/myorders', getMyOrders);
router.get('/:id', getOrder);
router.get('/:id/pdf', generateOrderPdf);
router.put('/:id/deliver', authorize('admin'), updateOrderToDelivered);
router.delete('/:id', cancelOrder);

module.exports = router;