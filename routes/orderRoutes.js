const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrder,
  getMyOrders,
  updateOrderToDelivered,
  cancelOrder,
  generateOrderPdf,
  getOrderTracking,
  handleShippingWebhook
} = require('../controllers/orderController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { verifyWebhook } = require('../middlewares/webhookMiddleware');

router.use(protect);

router.post('/', createOrder);
router.get('/myorders', getMyOrders);
router.get('/:id', getOrder);
router.get('/:id/pdf', generateOrderPdf);
router.put('/:id/deliver', authorize('admin'), updateOrderToDelivered);
router.delete('/:id', cancelOrder);
router.get('/:id/tracking', getOrderTracking);
router.post('/webhook/shipping', verifyWebhook,handleShippingWebhook);

module.exports = router;