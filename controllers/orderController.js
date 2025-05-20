const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
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
  const { paymentInfo, trackingInfo = {}, useSavedAddress, addressId, newAddress } = req.body;

  // Get user with addresses
  const user = await User.findById(req.user.id).select('addresses');

  let shippingInfo;

  // Handle address selection
  if (useSavedAddress) {
    const selectedAddress = user.addresses.id(addressId);
    if (!selectedAddress) {
      return next(new ErrorResponse('Selected address not found', 404));
    }
    shippingInfo = {
      address: selectedAddress.street,
      city: selectedAddress.city,
      state: selectedAddress.state,
      country: selectedAddress.country,
      pinCode: selectedAddress.zip,
      phoneNo: selectedAddress.phone
    };
  } else if (newAddress) {
    const { street, city, state, zip, country, phone, saveAddress } = newAddress;
    if (!street || !city || !state || !zip || !country || !phone) {
      return next(new ErrorResponse('Please provide complete shipping information', 400));
    }
    shippingInfo = {
      address: street,
      city,
      state,
      country,
      pinCode: zip,
      phoneNo: phone
    };
    if (saveAddress) {
      // Check address limit before saving
      if (user.addresses.length >= 4) {
        return next(new ErrorResponse('Maximum of 4 saved addresses reached. Address not saved to profile.', 400));
        // Or continue without saving but notify user:
        // return res.status(200).json({
        //   success: true,
        //   message: 'Order created but address not saved (maximum limit reached)',
        //   data: order
        // });
      }
      
      const address = {
        street,
        city,
        state,
        zip,
        country,
        phone,
        addressType: newAddress.addressType || 'other',
        tag: newAddress.tag || 'New Address'
      };
      
      user.addresses.push(address);
      await user.save();
    }
  } else {
    const defaultAddress = user.addresses.find(addr => addr.isDefault);
    if (!defaultAddress) {
      return next(new ErrorResponse('No shipping address provided and no default address set', 400));
    }
    shippingInfo = {
      address: defaultAddress.street,
      city: defaultAddress.city,
      state: defaultAddress.state,
      country: defaultAddress.country,
      pinCode: defaultAddress.zip,
      phoneNo: defaultAddress.phone
    };
  }
  // Validate shipping info
  const requiredShippingFields = ['address', 'city', 'state', 'country', 'pinCode', 'phoneNo'];
  if (requiredShippingFields.some(field => !shippingInfo?.[field])) {
    return next(new ErrorResponse('Please provide complete shipping information', 400));
  }

  // Validate payment info
  if (!paymentInfo?.id || !paymentInfo?.status) {
    return next(new ErrorResponse('Please provide complete payment information', 400));
  }

  // Get user's cart with products
  const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
  if (!cart || cart.items.length === 0) {
    return next(new ErrorResponse('No items in cart', 400));
  }

  // Validate all products exist and have stock
  for (const item of cart.items) {
    if (!item.product) {
      return next(new ErrorResponse(`Product ${item.product?._id} not found`, 404));
    }
    if (item.product.stock < item.quantity) {
      return next(new ErrorResponse(
        `Not enough stock for ${item.product.name}. Only ${item.product.stock} available`,
        400
      ));
    }
  }

  // Calculate prices server-side (prevent frontend manipulation)
  const itemsPrice = cart.items.reduce(
    (sum, item) => sum + (item.price * item.quantity), 
    0
  );
  const taxPrice = itemsPrice * 0.1; // Example: 10% tax
  const shippingPrice = 5.99; // Fixed shipping or calculate based on rules
  const totalPrice = itemsPrice + taxPrice + shippingPrice;

  // Create order items from cart
  const orderItems = cart.items.map(item => ({
    product: item.product._id,
    quantity: item.quantity,
    size: item.size,
    color: item.color,
    price: item.price
  }));

  // Create order
  const order = await Order.create({
    user: req.user.id,
    orderItems,
    shippingInfo,
    paymentInfo: {
      id: paymentInfo.id,
      status: paymentInfo.status,
      method: paymentInfo.method || 'card'
    },
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
    trackingInfo: {
      ...trackingInfo,
      status: trackingInfo.status || 'label_created',
      lastUpdated: Date.now()
    }
  });

  // Update stock based on purchased items
  for (const item of order.orderItems) {
    await updateStock(item.product, item.quantity);
  }

  // Clear user's cart post-purchase
  await Cart.findOneAndUpdate(
    { user: req.user.id },
    { items: [], totalPrice: 0 },
    { new: true }
  );

  // Send order confirmation email

try {
  // Get populated order details for email
  const populatedOrder = await Order.findById(order._id)
    .populate('user', 'name email')
    .populate('orderItems.product', 'name images');

  // Format order items for email
  const orderItemsList = populatedOrder.orderItems.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">
        <img src="${item.product.images[0]?.url || 'https://via.placeholder.com/50'}" 
             alt="${item.product.name}" 
             style="width: 50px; height: 50px; object-fit: cover; margin-right: 10px;">
        ${item.product.name}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
        ${item.quantity}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
        $${(item.price * item.quantity).toFixed(2)}
      </td>
    </tr>
  `).join('');

  await sendEmail({
    email: populatedOrder.user.email,
    subject: `Your DressUp Order Confirmation #${order._id}`,
    message: `
      Dear ${populatedOrder.user.name},

      Thank you for your order with DressUp! We're excited to help elevate your style.

      Order Summary:
      - Order Number: ${order._id}
      - Date: ${new Date(order.createdAt).toLocaleDateString()}
      - Total Amount: $${order.totalPrice.toFixed(2)}

      Shipping Address:
      ${order.shippingInfo.address}
      ${order.shippingInfo.city}, ${order.shippingInfo.state} ${order.shippingInfo.pinCode}
      ${order.shippingInfo.country}
      Phone: ${order.shippingInfo.phoneNo}

      You can track your order status by visiting your account dashboard.

      If you have any questions, please contact our support team.

      Warm regards,
      The DressUp Team
    `,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background-color: #2c3e50; padding: 20px; color: white;">
          <h1 style="margin: 0;">Thank You For Your Order!</h1>
        </div>

        <div style="padding: 20px;">
          <p>Dear ${populatedOrder.user.name},</p>
          <p>Thank you for shopping with DressUp! We're excited to help elevate your style with your new purchase.</p>

          <h2 style="color: #2c3e50; margin-top: 30px;">Order Details</h2>
          <p><strong>Order Number:</strong> ${order._id}</p>
          <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>

          <h3 style="color: #2c3e50; margin-top: 20px;">Items Ordered</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 10px; text-align: left;">Product</th>
                <th style="padding: 10px; text-align: center;">Qty</th>
                <th style="padding: 10px; text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${orderItemsList}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding: 10px; text-align: right; font-weight: bold;">Subtotal:</td>
                <td style="padding: 10px; text-align: right;">$${order.itemsPrice.toFixed(2)}</td>
              </tr>
              <tr>
                <td colspan="2" style="padding: 10px; text-align: right; font-weight: bold;">Shipping:</td>
                <td style="padding: 10px; text-align: right;">$${order.shippingPrice.toFixed(2)}</td>
              </tr>
              <tr>
                <td colspan="2" style="padding: 10px; text-align: right; font-weight: bold;">Tax:</td>
                <td style="padding: 10px; text-align: right;">$${order.taxPrice.toFixed(2)}</td>
              </tr>
              <tr>
                <td colspan="2" style="padding: 10px; text-align: right; font-weight: bold;">Total:</td>
                <td style="padding: 10px; text-align: right; font-weight: bold;">$${order.totalPrice.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          <h3 style="color: #2c3e50; margin-top: 20px;">Shipping Information</h3>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
            <p>${order.shippingInfo.address}</p>
            <p>${order.shippingInfo.city}, ${order.shippingInfo.state} ${order.shippingInfo.pinCode}</p>
            <p>${order.shippingInfo.country}</p>
            <p>Phone: ${order.shippingInfo.phoneNo}</p>
          </div>

          ${order.trackingInfo?.trackingNumber ? `
            <h3 style="color: #2c3e50; margin-top: 20px;">Tracking Information</h3>
            <p>Your order is being processed and will be shipped soon.</p>
            <p><strong>Tracking Number:</strong> ${order.trackingInfo.trackingNumber}</p>
            <p><a href="${order.trackingInfo.trackingUrl || '#'}" 
                 style="color: #2c3e50; text-decoration: underline;">
                 Track Your Order
               </a></p>
          ` : ''}

          <div style="margin-top: 30px; text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'https://yourstore.com'}/account/orders" 
               style="background-color: #2c3e50; color: white; padding: 10px 20px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              View Your Order
            </a>
          </div>

          <p style="margin-top: 30px;">If you have any questions about your order, please reply to this email.</p>

          <p>Warm regards,<br>The DressUp Team</p>
        </div>

        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #777;">
          <p>DressUp - Elevate Your Style</p>
          <p>${process.env.FRONTEND_URL || 'https://yourstore.com'}</p>
        </div>
      </div>
    `
  });
} catch (error) {
  console.error('Order confirmation email failed:', error);
  // Don't fail the order if email fails
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


// @desc    Get order tracking info
// @route   GET /api/v1/orders/:id/tracking
// @access  Private
exports.getOrderTracking = asyncHandler(async (req, res, next) => {
  const order = await Order.findOne({
    _id: req.params.id,
    user: req.user.id
  }).select('trackingInfo orderStatus');

  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }

  // If no tracking info, return basic order status
  if (!order.trackingInfo || !order.trackingInfo.trackingNumber) {
    return res.status(200).json({
      success: true,
      data: {
        status: order.orderStatus,
        message: 'Tracking information not yet available'
      }
    });
  }

  // Optional: Fetch real-time updates from carrier API
  // You would implement this based on your shipping provider
  // const realTimeUpdates = await fetchCarrierUpdates(order.trackingInfo.trackingNumber);
  
  res.status(200).json({
    success: true,
    data: order.trackingInfo
  });
});

// @desc    Handle shipping webhook updates
// @route   POST /api/v1/orders/webhook/shipping
// @access  Public (protected by webhook secret)
exports.handleShippingWebhook = asyncHandler(async (req, res, next) => {
  // Verify webhook secret (important for security)
  const webhookSecret = req.headers['x-webhook-secret'];
  if (webhookSecret !== process.env.SHIPPING_WEBHOOK_SECRET) {
    return next(new ErrorResponse('Unauthorized', 401));
  }

  const { trackingNumber, status, events, estimatedDelivery, carrier } = req.body;

  // Find order by tracking number
  const order = await Order.findOneAndUpdate(
    { 'trackingInfo.trackingNumber': trackingNumber },
    {
      $set: {
        'trackingInfo.status': status,
        'trackingInfo.events': events,
        'trackingInfo.estimatedDelivery': estimatedDelivery,
        'trackingInfo.lastUpdated': Date.now(),
        'orderStatus': mapTrackingStatusToOrderStatus(status)
      }
    },
    { new: true }
  );

  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }

  // Send notification to user if status changed significantly
  if (['out_for_delivery', 'delivered', 'exception'].includes(status)) {
    await sendShippingUpdateNotification(order.user, status);
  }

  res.status(200).json({ success: true });
});

// Helper function to map carrier status to your order status
function mapTrackingStatusToOrderStatus(trackingStatus) {
  const statusMap = {
    label_created: 'Processing',
    in_transit: 'Shipped',
    out_for_delivery: 'Shipped',
    delivered: 'Delivered',
    exception: 'Cancelled'
  };
  return statusMap[trackingStatus] || 'Processing';
}

// Helper function to send notifications
async function sendShippingUpdateNotification(userId, status) {
  const user = await User.findById(userId);
  if (!user) return;

  const statusMessages = {
    out_for_delivery: 'Your order is out for delivery!',
    delivered: 'Your order has been delivered!',
    exception: 'There was an issue with your delivery'
  };

  const message = statusMessages[status] || 'Your order status has been updated';

  try {
    await sendEmail({
      email: user.email,
      subject: 'Order Status Update',
      message
    });
    
    // Could also implement SMS or push notifications here
  } catch (error) {
    console.error('Error sending shipping notification:', error);
  }
}


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

