const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middlewares/async');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// @desc    Get all users
// @route   GET /api/v1/admin/users
// @access  Private/Admin
exports.getUsers = asyncHandler(async (req, res, next) => {
  // Add role filter to the advancedResults query
  res.advancedResults.query.role = 'user';
  
  // Return the filtered results
  res.status(200).json(res.advancedResults);
});

// @desc    Get single user
// @route   GET /api/v1/admin/users/:id
// @access  Private/Admin
exports.getUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc    Create user
// @route   POST /api/v1/admin/users
// @access  Private/Admin
exports.createUser = asyncHandler(async (req, res, next) => {
  const user = await User.create(req.body);

  res.status(201).json({
    success: true,
    data: user,
  });
});

// @desc    Update user
// @route   PUT /api/v1/admin/users/:id
// @access  Private/Admin
exports.updateUser = asyncHandler(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc    Delete user
// @route   DELETE /api/v1/admin/users/:id
// @access  Private/Admin
exports.deleteUser = asyncHandler(async (req, res, next) => {
  await User.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Get all products
// @route   GET /api/v1/admin/products
// @access  Private/Admin
exports.getProducts = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Create product
// @route   POST /api/v1/admin/products
// @access  Private/Admin
exports.createProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.create(req.body);

  res.status(201).json({
    success: true,
    data: product,
  });
});

// @desc    Update product
// @route   PUT /api/v1/admin/products/:id
// @access  Private/Admin
exports.updateProduct = asyncHandler(async (req, res, next) => {
  let product = await Product.findById(req.params.id);

  if (!product) {
    return next(
      new ErrorResponse(`Product not found with id of ${req.params.id}`, 404)
    );
  }

  product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: product,
  });
});

// @desc    Delete product
// @route   DELETE /api/v1/admin/products/:id
// @access  Private/Admin
exports.deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(
      new ErrorResponse(`Product not found with id of ${req.params.id}`, 404)
    );
  }

  await product.remove();

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Get all orders
// @route   GET /api/v1/admin/orders
// @access  Private/Admin
exports.getOrders = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Get single order
// @route   GET /api/v1/admin/orders/:id
// @access  Private/Admin
exports.getOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');

  if (!order) {
    return next(
      new ErrorResponse(`Order not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: order,
  });
});

// @desc    Update order status
// @route   PUT /api/v1/admin/orders/:id
// @access  Private/Admin
exports.updateOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(
      new ErrorResponse(`Order not found with id of ${req.params.id}`, 404)
    );
  }

  if (order.orderStatus === 'Delivered') {
    return next(new ErrorResponse('You have already delivered this order', 400));
  }

  if (req.body.status === 'Shipped') {
    order.orderItems.forEach(async (item) => {
      await updateStock(item.product, item.quantity);
    });
  }

  order.orderStatus = req.body.status;

  if (req.body.status === 'Delivered') {
    order.deliveredAt = Date.now();
  }

  await order.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    data: order,
  });
});

// @desc    Delete order
// @route   DELETE /api/v1/admin/orders/:id
// @access  Private/Admin
exports.deleteOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(
      new ErrorResponse(`Order not found with id of ${req.params.id}`, 404)
    );
  }

  await order.remove();

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Get dashboard stats
// @route   GET /api/v1/admin/dashboard-stats
// @access  Private/Admin
exports.getDashboardStats = asyncHandler(async (req, res, next) => {
  const totalUsers = await User.countDocuments();
  const totalProducts = await Product.countDocuments();
  const totalOrders = await Order.countDocuments();
  
  const orders = await Order.find();
  let totalSales = 0;
  orders.forEach(order => {
    totalSales += order.totalPrice;
  });

  const recentOrders = await Order.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('user', 'name email');

  res.status(200).json({
    success: true,
    data: {
      totalUsers,
      totalProducts,
      totalOrders,
      totalSales,
      recentOrders,
    },
  });
});

async function updateStock(id, quantity) {
  const product = await Product.findById(id);

  product.stock -= quantity;

  await product.save({ validateBeforeSave: false });
}
//pdf
// Helper function to create PDF with logo and custom header
async function createPdfWithHeader(res, filename, title) {
  const doc = new PDFDocument({
    size: 'A4', // 595.28 x 841.89 points (210 x 297 mm)
    margin: 50,
    bufferPages: true // Required for page numbers
  });

  // Set response headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);

  // Pipe the PDF to the response
  doc.pipe(res);

  // Add logo at TOP LEFT (50pt from left, 50pt from top)
  const logoPath = path.join(__dirname, '../public/images/logo.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, 50, {
      width: 80,
      height: 40,
      fit: [80, 40]
    });
  }

  // Add Company Name and Slogan
  doc.font('Helvetica-Bold')
    .fontSize(18)
    .fillColor('#333333')
    .text('DressUp', 140, 55);

  doc.font('Helvetica')
    .fontSize(10)
    .fillColor('#666666')
    .text('elevate your style', 140, 80);

  // Add Generated Date (top right)
  doc.fontSize(10)
    .fillColor('#444444')
    .text(`Generated on: ${new Date().toLocaleString()}`, 50, 55, {
      align: 'right',
      width: 495 // 595 - 100 (margins)
    });

  // Add decorative divider line (full width between margins)
  doc.moveTo(50, 100)
     .lineTo(545, 100) // 595 - 50 (right margin)
     .lineWidth(0.5)
     .strokeColor('#eeeeee')
     .stroke();

  // Add Title (centered)
  doc.font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#2c3e50')
    .text(title, 50, 120, {
      align: 'center',
      width: 495
    });

  // Move down before the table
  doc.moveDown(1.5);

  return doc;
}





// @desc    Generate PDF of users
// @route   GET /api/v1/admin/users-list/pdf
// @access  Private/Admin
exports.generateUsersPdf = asyncHandler(async (req, res, next) => {
  try {
    // Only fetch users with role 'user'
    const users = await User.find({ role: 'user' }).select('name email role createdAt');
    
    if (users.length === 0) {
      return next(new ErrorResponse('No regular users found', 404));
    }

    const doc = await createPdfWithHeader(res, 'users-list', 'Regular Users List');
    
    // Set up table parameters
    const table = {
      headers: ['No.', 'Name', 'Email', 'Role', 'Joined Date'],
      rows: [],
      columnWidths: [40, 120, 180, 80, 100],
      columnAlignments: ['left', 'left', 'left', 'left', 'left']
    };
    
    // Add data to table
    users.forEach((user, index) => {
      table.rows.push([
        (index + 1).toString(),
        user.name,
        user.email,
        user.role,
        new Date(user.createdAt).toLocaleDateString()
      ]);
    });
    
    // Draw the table
    drawTable(doc, table);
  
    // Finalize the PDF
    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    return next(new ErrorResponse('Error generating PDF report', 500));
  }
});

// @desc    Generate PDF of products
// @route   GET /api/v1/admin/products-list/pdf
// @access  Private/Admin
exports.generateProductsPdf = asyncHandler(async (req, res, next) => {
  try {
    const products = await Product.find().select('name price category stock createdAt');
    const doc = await createPdfWithHeader(res, 'products-list', 'Products List');
    
    // Set up table parameters
    const table = {
      headers: ['No.', 'Name', 'Price', 'Category', 'Stock', 'Added Date'],
      rows: [],
      columnWidths: [40, 150, 60, 100, 50, 100],
      columnAlignments: ['left', 'left', 'right', 'left', 'center', 'left']
    };
    
    // Add data to table
    products.forEach((product, index) => {
      table.rows.push([
        (index + 1).toString(),
        product.name,
        `$${product.price.toFixed(2)}`,
        product.category,
        product.stock.toString(),
        new Date(product.createdAt).toLocaleDateString()
      ]);
    });
    
    // Draw the table
    drawTable(doc, table);

    // Finalize the PDF
    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    return next(new ErrorResponse('Error generating PDF report', 500));
  }
});

// @desc    Generate PDF of orders
// @route   GET /api/v1/admin/orders-list/pdf
// @access  Private/Admin
exports.generateOrdersPdf = asyncHandler(async (req, res, next) => {
  try {
    const orders = await Order.find().populate('user', 'name email');
    const doc = await createPdfWithHeader(res, 'orders-list', 'Orders List');
    
    // Set up table parameters
    const table = {
      headers: ['No.', 'Order ID', 'Customer', 'Total', 'Status', 'Date'],
      rows: [],
      columnWidths: [40, 80, 120, 60, 80, 100],
      columnAlignments: ['left', 'left', 'left', 'right', 'center', 'left']
    };
    
    // Add data to table
    orders.forEach((order, index) => {
      table.rows.push([
        (index + 1).toString(),
        order._id.toString().substring(0, 8),
        order.user.name,
        `$${order.totalPrice.toFixed(2)}`,
        order.orderStatus,
        new Date(order.createdAt).toLocaleDateString()
      ]);
    });
    
    // Draw the table
    drawTable(doc, table);

    // Finalize the PDF
    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    return next(new ErrorResponse('Error generating PDF report', 500));
  }
});

// Helper function to draw a table
function drawTable(doc, table) {
  const pageWidth = 595.28;
  const leftMargin = 50;
  const rightMargin = 50;
  const usableWidth = pageWidth - leftMargin - rightMargin; // 495.28
  const initialY = doc.y;
  const rowHeight = 22;
  const cellPadding = 5;

  // Calculate column widths proportionally
  const totalRequestedWidth = table.columnWidths.reduce((sum, w) => sum + w, 0);
  const columnWidths = table.columnWidths.map(w => (w / totalRequestedWidth) * usableWidth);

  // Draw Header Background
  doc.rect(leftMargin, initialY, usableWidth, rowHeight).fill('#f8f9fa');

  // Draw Header Text
  doc.font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#2c3e50');

  let x = leftMargin;
  table.headers.forEach((header, i) => {
    doc.text(header, x + cellPadding, initialY + 5, {
      width: columnWidths[i] - cellPadding * 2,
      align: table.columnAlignments[i],
      height: rowHeight,
      valign: 'center'
    });
    x += columnWidths[i];
  });

  // Draw Rows
  let y = initialY + rowHeight;
  table.rows.forEach((row, rowIndex) => {
    // Check for page break (leave 70pt for footer)
    if (y + rowHeight >  doc.page.height - 70) {
      doc.addPage();
      y = 50; // Reset Y position on new page
    }

    // Alternate row background
    doc.rect(leftMargin, y, usableWidth, rowHeight)
       .fill(rowIndex % 2 === 0 ? '#ffffff' : '#f8f9fa');

    // Draw cell content
    doc.font('Helvetica')
      .fontSize(10)
      .fillColor('#333333');

    x = leftMargin;
    row.forEach((cell, i) => {
      doc.text(cell, x + cellPadding, y + 5, {
        width: columnWidths[i] - cellPadding * 2,
        align: table.columnAlignments[i],
        height: rowHeight,
        valign: 'center'
      });
      x += columnWidths[i];
    });

    y += rowHeight;
  });

  // Draw table border
  doc.rect(leftMargin, initialY, usableWidth, y - initialY)
     .stroke('#dddddd');

  // Update document position
  doc.y = y + 15;
}

// controllers/adminController.js

// @desc    Delete review as admin
// @route   DELETE /api/v1/admin/products/:productId/reviews/:reviewId
// @access  Private/Admin
exports.deleteReviewAsAdmin = asyncHandler(async (req, res, next) => {
  const { productId, reviewId } = req.params;

  const product = await Product.findById(productId);

  if (!product) {
    return next(new ErrorResponse(`Product not found with id of ${productId}`, 404));
  }

  const reviewIndex = product.reviews.findIndex(
    r => r._id.toString() === reviewId.toString()
  );

  if (reviewIndex === -1) {
    return next(new ErrorResponse(`Review not found with id of ${reviewId}`, 404));
  }

  // Admin can delete any review without ownership check
  product.reviews.splice(reviewIndex, 1);
  product.numOfReviews = product.reviews.length;

  // Recalculate average rating if there are remaining reviews
  product.ratings = product.reviews.length > 0 
    ? product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length
    : 0;

  await product.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    data: product
  });
});

// @desc Generate PDF report of product sales with charts
// @route GET /api/v1/admin/sales-report/pdf
// @access Private/Admin
exports.generateSalesReportPdf = asyncHandler(async (req, res, next) => {
  try {
    // Fetch orders and initialize product sales map
    const orders = await Order.find().populate('orderItems.product');
    const productSalesMap = {};

    // Aggregate product sales
    orders.forEach(order => {
      order.orderItems.forEach(item => {
        const productId = item.product._id.toString();
        if (!productSalesMap[productId]) {
          productSalesMap[productId] = { name: item.product.name, quantity: 0 };
        }
        productSalesMap[productId].quantity += item.quantity;
      });
    });

    // Prepare chart data
    const labels = [];
    const data = [];
    Object.values(productSalesMap).forEach(p => {
      labels.push(p.name);
      data.push(p.quantity);
    });

    // Generate charts
    const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
    const chartJSNodeCanvas = new ChartJSNodeCanvas({
      width: 600,
      height: 400,
      chartCallback: ChartJS => (ChartJS.defaults.font.family = 'Arial'),
    });

    const createChartBuffer = async (type, chartTitle, datasetConfig) => {
      return await chartJSNodeCanvas.renderToBuffer({
        type,
        data: {
          labels,
          datasets: [datasetConfig],
        },
        options: {
          responsive: false,
          plugins: {
            title: { display: true, text: chartTitle },
            legend: type === 'bar' ? { display: false } : undefined,
          },
          scales: type === 'bar' ? {
            y: {
              title: {
                display: true,
                text: 'Units', // <- Y-axis label
              },
              ticks: {
                stepSize: 1,
              },
              beginAtZero: true,
            },
          } : undefined,
        },
      });
    };

    const barChartBuffer = await createChartBuffer('bar', 'Product Sales Chart', {
      label: 'Units Sold',
      data,
      backgroundColor: '#3498db',
    });

    const pieChartBuffer = await createChartBuffer('pie', 'Product Sales Distribution', {
      data,
      backgroundColor: ['#3498db', '#e67e22', '#2ecc71', '#9b59b6', '#f1c40f', '#1abc9c', '#e74c3c', '#34495e'],
    });

    // Create PDF document
    const doc = await createPdfWithHeader(res, 'product-sales-report', 'Product Sales Report');

    // Sales Summary
    const totalUnits = data.reduce((sum, qty) => sum + qty, 0);
    const topIndex = data.indexOf(Math.max(...data));
    const topProduct = labels[topIndex];

    doc.font('Helvetica-Bold').fontSize(14).text('Sales Summary', { align: 'left' }).moveDown(0.5);
    doc.font('Helvetica')
      .fontSize(11)
      .text(`Total Units Sold: ${totalUnits}`)
      .text(`Unique Products Sold: ${labels.length}`)
      .text(`Top-Selling Product: ${topProduct} (${data[topIndex]} units)`)
      .moveDown(1);

    // Insert Bar Chart
    doc.font('Helvetica-Bold').fontSize(12).text('Product Sales Chart', { align: 'center' }).moveDown(0.5);
    doc.image(barChartBuffer, {
      fit: [500, 300],
      align: 'center',
      valign: 'center',
    }).moveDown(2); // Additional spacing below the chart

    // New Page for Pie Chart
    doc.addPage();
    doc.font('Helvetica-Bold').fontSize(12).text('Sales Distribution (Pie Chart)', { align: 'center' }).moveDown(0.5);
    doc.image(pieChartBuffer, { fit: [400, 300], align: 'center', valign: 'center' });

    doc.end();
  } catch (error) {
    console.error('Error generating sales report PDF:', error);
    return next(new ErrorResponse('Failed to generate sales report', 500));
  }
});
