const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middlewares/async');
const sendEmail = require('../utils/emailService');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');


// @desc    Create new order
// @route   POST /api/v1/orders
// @access  Private
exports.createOrder = asyncHandler(async (req, res, next) => {
  const {
    shippingInfo,
    paymentInfo,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
  } = req.body;

  // Validate important fields
  if (
    !shippingInfo ||
    !shippingInfo.address ||
    !shippingInfo.city ||
    !shippingInfo.state ||
    !shippingInfo.country ||
    !shippingInfo.pinCode ||
    !shippingInfo.phoneNo
  ) {
    return next(new ErrorResponse('Please provide complete shipping information', 400));
  }

  if (
    !paymentInfo ||
    !paymentInfo.id ||
    !paymentInfo.status
  ) {
    return next(new ErrorResponse('Please provide complete payment information', 400));
  }

  if (
    itemsPrice == null || taxPrice == null || shippingPrice == null || totalPrice == null
  ) {
    return next(new ErrorResponse('Please provide all price-related fields', 400));
  }

  if (typeof itemsPrice !== 'number' || typeof taxPrice !== 'number' ||
      typeof shippingPrice !== 'number' || typeof totalPrice !== 'number') {
    return next(new ErrorResponse('Price fields must be numbers', 400));
  }

  if (taxPrice > 100) {
    return next(new ErrorResponse('Tax price cannot be more than 100', 400));
  }

  // Get user's cart
  const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');

  if (!cart || cart.items.length === 0) {
    return next(new ErrorResponse('No items in cart', 400));
  }

  // Prepare order items from cart
  const orderItems = cart.items.map((item) => {
    if (!item.product) {
      throw new ErrorResponse('Cart contains invalid product reference', 400);
    }
    return {
      product: item.product._id,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      price: item.price,
    };
  });

  // Create the order
  const order = await Order.create({
    user: req.user.id,
    orderItems,
    shippingInfo,
    paymentInfo,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
  });

  // Update product stock
  for (const item of order.orderItems) {
    await updateStock(item.product, item.quantity);
  }

  // Clear user's cart
  await Cart.findOneAndUpdate(
    { user: req.user.id },
    { items: [], totalPrice: 0 },
    { new: true }
  );

  // Send order confirmation email
  try {
    await sendEmail({
      email: req.user.email,
      subject: 'Your Order Confirmation',
      message: `Thank you for your order! Your order ID is ${order._id}.`,
    });
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
  }

  res.status(201).json({
    success: true,
    data: order,
  });
});


// @desc    Get single order
// @route   GET /api/v1/orders/:id
// @access  Private
exports.getOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate(
    'user',
    'name email'
  );

  if (!order) {
    return next(
      new ErrorResponse(`Order not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is order owner or admin
  if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to access this order`,
        401
      )
    );
  }

  res.status(200).json({
    success: true,
    data: order,
  });
});

// @desc    Get logged in user orders
// @route   GET /api/v1/orders/myorders
// @access  Private
exports.getMyOrders = asyncHandler(async (req, res, next) => {
  const orders = await Order.find({ user: req.user.id });

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders,
  });
});

// @desc    Update order to delivered
// @route   PUT /api/v1/orders/:id/deliver
// @access  Private/Admin
exports.updateOrderToDelivered = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(
      new ErrorResponse(`Order not found with id of ${req.params.id}`, 404)
    );
  }

  order.orderStatus = 'Delivered';
  order.deliveredAt = Date.now();

  await order.save();

  res.status(200).json({
    success: true,
    data: order,
  });
});

// @desc    Cancel order
// @route   DELETE /api/v1/orders/:id
// @access  Private
exports.cancelOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(
      new ErrorResponse(`Order not found with id of ${req.params.id}`, 404)
    );
  }

  // Check if user is order owner or admin
  if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to cancel this order`,
        401
      )
    );
  }

  // Check if order is already delivered
  if (order.orderStatus === 'Delivered') {
    return next(
      new ErrorResponse('Cannot cancel delivered orders', 400)
    );
  }

  // Check if order is already cancelled
  if (order.orderStatus === 'Cancelled') {
    return next(
      new ErrorResponse('Order is already cancelled', 400)
    );
  }

  // Restore product stock
  for (const item of order.orderItems) {
    await restoreStock(item.product, item.quantity);
  }

  // Update order status
  order.orderStatus = 'Cancelled';
  order.cancelledAt = Date.now();
  await order.save();

  // Send cancellation email with refund information
  try {
    await sendEmail({
      email: req.user.email,
      subject: 'Your Order Has Been Cancelled',
      message: `Your order #${order._id} has been cancelled successfully. 
                The amount of $${order.totalPrice} will be refunded to your account within 3-5 business days.`
    });
  } catch (error) {
    console.error('Error sending cancellation email:', error);
  }

  res.status(200).json({
    success: true,
    data: {
      message: `Order cancelled successfully. Amount of $${order.totalPrice} will be refunded to your account.`,
      order
    }
  });
});

// @desc    Generate PDF receipt for order
// @route   GET /api/v1/orders/:id/pdf
// @access  Private
exports.generateOrderPdf = asyncHandler(async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email')
      .populate('orderItems.product', 'name image');

    if (!order) {
      return next(new ErrorResponse(`Order not found with id of ${req.params.id}`, 404));
    }

    // Check if user is order owner or admin
    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return next(new ErrorResponse(`Not authorized to access this order`, 401));
    }

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      bufferPages: true
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=order_${order._id}.pdf`);

    doc.pipe(res);

    // Add logo
    const logoPath = path.join(__dirname, '../public/images/logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 50, { width: 80 });
    }

    // Company info
    doc.font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#333333')
      .text('DressUp', 140, 55);

    doc.font('Helvetica')
      .fontSize(10)
      .fillColor('#666666')
      .text('elevate your style', 140, 80);

    // Order info header
    doc.fontSize(14)
      .fillColor('#2c3e50')
      .text('ORDER RECEIPT', 50, 120, { align: 'center' });

    // Order details
    doc.fontSize(10)
      .fillColor('#444444')
      .text(`Order #: ${order._id}`, 50, 160)
      .text(`Date: ${order.createdAt.toLocaleDateString()}`, 50, 180)
      .text(`Status: ${order.orderStatus}`, 50, 200);

    // Customer info
    doc.fontSize(12)
      .fillColor('#2c3e50')
      .text('Customer Information:', 350, 160)
      .fontSize(10)
      .fillColor('#444444')
      .text(order.user.name, 350, 180)
      .text(order.user.email, 350, 200);

    // Shipping info
    doc.fontSize(12)
      .fillColor('#2c3e50')
      .text('Shipping Address:', 50, 240)
      .fontSize(10)
      .fillColor('#444444')
      .text(order.shippingInfo.address, 50, 260)
      .text(`${order.shippingInfo.city}, ${order.shippingInfo.state} ${order.shippingInfo.pinCode}`, 50, 280)
      .text(order.shippingInfo.country, 50, 300)
      .text(`Phone: ${order.shippingInfo.phoneNo}`, 50, 320);

    // Items table header
    doc.fontSize(12)
      .fillColor('#2c3e50')
      .text('Order Items:', 50, 360);

    // Draw items table
    const tableTop = 380;
    const rowHeight = 20;
    const cellPadding = 5;

    // Table headers
    doc.font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#ffffff')
      .rect(50, tableTop, 495, rowHeight)
      .fill('#2c3e50');

    doc.text('Item', 55, tableTop + 5);
    doc.text('Price', 300, tableTop + 5, { width: 80, align: 'right' });
    doc.text('Qty', 390, tableTop + 5, { width: 50, align: 'center' });
    doc.text('Total', 450, tableTop + 5, { width: 80, align: 'right' });

    // Order items
    let y = tableTop + rowHeight;
    order.orderItems.forEach((item, index) => {
      // Alternate row background
      if (index % 2 === 0) {
        doc.rect(50, y, 495, rowHeight).fill('#f8f9fa');
      }

      doc.font('Helvetica')
        .fontSize(10)
        .fillColor('#333333')
        .text(item.product.name, 55, y + 5)
        .text(`$${item.price.toFixed(2)}`, 300, y + 5, { width: 80, align: 'right' })
        .text(item.quantity.toString(), 390, y + 5, { width: 50, align: 'center' })
        .text(`$${(item.price * item.quantity).toFixed(2)}`, 450, y + 5, { width: 80, align: 'right' });

      y += rowHeight;
    });

    // Summary
    doc.fontSize(12)
      .fillColor('#2c3e50')
      .text('Order Summary:', 350, y + 20);

    doc.fontSize(10)
      .fillColor('#444444')
      .text(`Subtotal: $${order.itemsPrice.toFixed(2)}`, 350, y + 40, { width: 150, align: 'right' })
      .text(`Shipping: $${order.shippingPrice.toFixed(2)}`, 350, y + 60, { width: 150, align: 'right' })
      .text(`Tax: $${order.taxPrice.toFixed(2)}`, 350, y + 80, { width: 150, align: 'right' });

    doc.font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#2c3e50')
      .text(`Total: $${order.totalPrice.toFixed(2)}`, 350, y + 110, { width: 150, align: 'right' });

    // Thank you message
    // Dynamic message based on order status
    let statusMessage = '';
    let messageColor = '#666666';
    
    switch(order.orderStatus) {
      case 'Processing':
        statusMessage = 'Your order is being processed. Thank you for your purchase!';
        messageColor = '#3498db'; // Blue
        break;
      case 'Shipped':
        statusMessage = 'Your order has been shipped! Thank you for your purchase!';
        messageColor = '#f39c12'; // Orange
        break;
      case 'Delivered':
        statusMessage = 'Your order has been delivered. Thank you for shopping with us!';
        messageColor = '#27ae60'; // Green
        break;
      case 'Cancelled':
        statusMessage = 'Your order has been cancelled. Amount will be refunded to your account.';
        messageColor = '#e74c3c'; // Red
        break;
      default:
        statusMessage = 'Thank you for your purchase!';
    }

    // Status message
    doc.fontSize(12)
      .fillColor(messageColor)
      .text(statusMessage, 50, y + 150, { 
        align: 'center',
        bold: true 
      });

    // For cancelled orders, add refund details
    if (order.orderStatus === 'Cancelled') {
      doc.fontSize(10)
        .fillColor('#666666')
        .text(`Refund Amount: $${order.totalPrice.toFixed(2)}`, 50, y + 170, {
          align: 'center'
        })
        .text('The refund will be processed within 3-5 business days.', 50, y + 190, {
          align: 'center'
        });
    }

    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    return next(new ErrorResponse('Error generating order receipt', 500));
  }
});




// Helper function to restore product stock
async function restoreStock(id, quantity) {
  const product = await Product.findById(id);
  product.stock += quantity;
  await product.save({ validateBeforeSave: false });
}



async function updateStock(id, quantity) {
  const product = await Product.findById(id);

  product.stock -= quantity;

  await product.save({ validateBeforeSave: false });
}

