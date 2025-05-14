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
  const { name, description, price, discountPrice, category, stock, size } = req.body;

  // Validate required fields
  if (!name || !description || !price || !category || !stock || !size) {
    return next(new ErrorResponse('Please provide all required fields', 400));
  }

  // Validate product name length (3-100 characters)
  if (name.length < 3 || name.length > 50) {
    return next(new ErrorResponse('Product name must be between 3 and 50 characters', 400));
  }

  // Validate description length (20-2000 characters)
  if (description.length < 10 || description.length > 200) {
    return next(new ErrorResponse('Description must be between 20 and 200 characters', 400));
  }

  // Validate category
  const validCategories = ['shirts', 'pants', 'shoes', 'accessories', 't-shirt'];
  if (!validCategories.includes(category.toLowerCase())) {
    return next(new ErrorResponse(`Invalid product category. Valid categories are: ${validCategories.join(', ')}`, 400));
  }

  // Validate stock (1-100)
  if (stock < 1 || stock > 100) {
    return next(new ErrorResponse('Stock must be between 1 and 100', 400));
  }

  // Validate price (0.01 to 999999.99)
  if (price <= 0 || price > 99999.99) {
    return next(new ErrorResponse('Price must be between 0.01 and 99,999.99', 400));
  }

  // Validate discount price if provided
  if (discountPrice) {
    if (discountPrice <= 0) {
      return next(new ErrorResponse('Discount price must be greater than 0', 400));
    }
    if (discountPrice >= price) {
      return next(new ErrorResponse('Discount price must be less than regular price', 400));
    }
  }

  // Check for duplicate product name (case insensitive)
  const existingProduct = await Product.findOne({ 
    name: { $regex: new RegExp(`^${name}$`, 'i') } 
  });

  if (existingProduct) {
    return next(new ErrorResponse(`Product with name '${name}' already exists`, 400));
  }

  // Validate size array (1-10 sizes, each 1-10 characters)
  if (!Array.isArray(size) || size.length === 0 || size.length > 10) {
    return next(new ErrorResponse('Please provide 1 to 10 sizes', 400));
  }
  
  for (const s of size) {
    if (typeof s !== 'string' || s.length < 1 || s.length > 10) {
      return next(new ErrorResponse('Each size must be 1 to 10 characters', 400));
    }
  }

  // Validate image array if provided (1-8 images)
  if (req.body.images) {
    if (!Array.isArray(req.body.images) || req.body.images.length === 0 || req.body.images.length > 8) {
      return next(new ErrorResponse('Please provide 1 to 8 images', 400));
    }
    if (req.body.images.some(img => !img.public_id || !img.url)) {
      return next(new ErrorResponse('Each image must have both public_id and url', 400));
    }
    if (req.body.images.some(img => img.public_id.length > 255 || img.url.length > 2048)) {
      return next(new ErrorResponse('Image public_id or url too long', 400));
    }
  }

  // Validate color if provided (2-30 characters)
  if (req.body.color && (req.body.color.length < 2 || req.body.color.length > 30)) {
    return next(new ErrorResponse('Color must be between 2 and 30 characters', 400));
  }

  // Create product
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

// @desc    Generate category-wise sales report PDF
// @route   GET /api/v1/admin/sales-report/category/pdf
// @access  Private/Admin
exports.generateCategorySalesReportPdf = asyncHandler(async (req, res, next) => {
  try {
    // Get all delivered orders grouped by product category
    const categoryStats = await Order.aggregate([
      { $match: { orderStatus: 'Delivered' } }, // Only count delivered orders
      { $unwind: '$orderItems' }, // Break down order items
      {
        $lookup: {
          from: 'products', // Join with products collection
          localField: 'orderItems.product',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      { $unwind: '$productDetails' }, // Unwind the product details
      {
        $group: {
          _id: '$productDetails.category', // Group by category
          totalSales: { $sum: '$orderItems.price' }, // Sum of prices
          totalItemsSold: { $sum: '$orderItems.quantity' }, // Sum of quantities
          orderCount: { $sum: 1 } // Count of orders
        }
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          totalSales: 1,
          totalItemsSold: 1,
          orderCount: 1
        }
      },
      { $sort: { totalSales: -1 } } // Sort by highest sales first
    ]);

    if (categoryStats.length === 0) {
      return next(new ErrorResponse('No sales data available', 404));
    }

    const doc = await createPdfWithHeader(res, 'category-sales-report', 'Category-wise Sales Report');
    
    // Add report period information
    doc.fontSize(10)
       .fillColor('#555555')
       .text('Report Period: All Time', { align: 'left' })
       .moveDown(0.5);

    // Set up table parameters
    const table = {
      headers: ['Category', 'Orders', 'Items Sold', 'Total Sales'],
      rows: [],
      columnWidths: [150, 100, 100, 100],
      columnAlignments: ['left', 'right', 'right', 'right']
    };
    
    // Add data to table
    categoryStats.forEach((stat, index) => {
      table.rows.push([
        stat.category.charAt(0).toUpperCase() + stat.category.slice(1), // Capitalize
        stat.orderCount.toString(),
        stat.totalItemsSold.toString(),
        `$${stat.totalSales.toFixed(2)}`
      ]);
    });

    // Calculate totals
    const totals = {
      orders: categoryStats.reduce((sum, stat) => sum + stat.orderCount, 0),
      items: categoryStats.reduce((sum, stat) => sum + stat.totalItemsSold, 0),
      sales: categoryStats.reduce((sum, stat) => sum + stat.totalSales, 0)
    };

    // Draw the table
    drawTable(doc, table);

    // Add summary section
    doc.moveDown(1)
       .font('Helvetica-Bold')
       .fillColor('#2c3e50')
       .text('Summary Statistics', { align: 'left' })
       .moveDown(0.5);

    doc.font('Helvetica')
       .fillColor('#333333')
       .text(`Total Categories: ${categoryStats.length}`, { align: 'left' })
       .text(`Total Orders: ${totals.orders}`, { align: 'left' })
       .text(`Total Items Sold: ${totals.items}`, { align: 'left' })
       .text(`Total Revenue: $${totals.sales.toFixed(2)}`, { align: 'left' });

    // Add chart-like visualization
    doc.moveDown(1)
       .font('Helvetica-Bold')
       .text('Sales Distribution by Category', { align: 'left' })
       .moveDown(0.5);

    // Calculate max sales for scaling
    const maxSales = Math.max(...categoryStats.map(stat => stat.totalSales));

    // Draw bar chart
    const chartLeft = 50;
    const chartWidth = 495;
    const chartHeight = 150;
    const barHeight = 20;
    const gap = 10;

    let y = doc.y;
    categoryStats.forEach((stat, i) => {
      const barWidth = (stat.totalSales / maxSales) * chartWidth;
      
      // Draw bar
      doc.rect(chartLeft, y, barWidth, barHeight)
         .fill(i % 2 === 0 ? '#3498db' : '#2ecc71');
      
      // Add label
      doc.fontSize(8)
         .fillColor('#ffffff')
         .text(
           `${stat.category}: $${stat.totalSales.toFixed(2)}`, 
           chartLeft + 5, 
           y + 5,
           { width: barWidth - 10 }
         );
      
      y += barHeight + gap;
    });

    doc.y = y + 20;

    // Add timestamp
    doc.fontSize(8)
       .fillColor('#888888')
       .text(`Report generated on: ${new Date().toLocaleString()}`, {
         align: 'right'
       });

    // Finalize the PDF
    doc.end();
  } catch (error) {
    console.error("Error generating category sales PDF:", error);
    return next(new ErrorResponse('Error generating category sales report', 500));
  }
});

// @desc    Bulk import products
// @route   POST /api/v1/admin/products/import
// @access  Private/Admin
exports.importProducts = asyncHandler(async (req, res, next) => {
  const { products } = req.body;

  // Validate products array exists and has items
  if (!Array.isArray(products) || products.length === 0) {
    return next(new ErrorResponse('Please provide an array of products to import', 400));
  }

  // Limit the number of products that can be imported at once
  if (products.length > 100) {
    return next(new ErrorResponse('Maximum 100 products can be imported at once', 400));
  }

  const validCategories = ['shirts', 'pants', 'shoes', 'accessories', 't-shirt'];
  const errors = [];
  const productsToImport = [];
  const productNames = new Set();

  // Validate each product
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const errorPrefix = `Product ${i + 1}: `;
    const productErrors = [];

    // Required fields check
    const requiredFields = ['name', 'description', 'price', 'category', 'stock', 'size'];
    const missingFields = requiredFields.filter(field => !product[field]);
    if (missingFields.length > 0) {
      productErrors.push(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Name validation
    if (product.name) {
      if (product.name.length < 3 || product.name.length > 50) {
        productErrors.push('Name must be between 3 and 50 characters');
      }
      if (productNames.has(product.name.toLowerCase())) {
        productErrors.push('Duplicate product name in import batch');
      } else {
        productNames.add(product.name.toLowerCase());
      }
    }

    // Description validation
    if (product.description && (product.description.length < 10 || product.description.length > 200)) {
      productErrors.push('Description must be between 10 and 200 characters');
    }

    // Category validation
    if (product.category && !validCategories.includes(product.category.toLowerCase())) {
      productErrors.push(`Invalid category. Valid categories are: ${validCategories.join(', ')}`);
    }

    // Stock validation
    if (product.stock && (product.stock < 1 || product.stock > 100)) {
      productErrors.push('Stock must be between 1 and 100');
    }

    // Price validation
    if (product.price && (product.price <= 0 || product.price > 99999.99)) {
      productErrors.push('Price must be between 0.01 and 99,999.99');
    }

    // Discount price validation
    if (product.discountPrice) {
      if (product.discountPrice <= 0) {
        productErrors.push('Discount price must be greater than 0');
      }
      if (product.price && product.discountPrice >= product.price) {
        productErrors.push('Discount price must be less than regular price');
      }
    }

    // Size validation
    if (product.size) {
      if (!Array.isArray(product.size) || product.size.length === 0 || product.size.length > 10) {
        productErrors.push('Please provide 1 to 10 sizes');
      } else {
        for (const s of product.size) {
          if (typeof s !== 'string' || s.length < 1 || s.length > 10) {
            productErrors.push('Each size must be 1 to 10 characters');
            break;
          }
        }
      }
    }

    // Images validation
    if (product.images) {
      if (!Array.isArray(product.images) || product.images.length === 0 || product.images.length > 8) {
        productErrors.push('Please provide 1 to 8 images');
      } else {
        for (const img of product.images) {
          if (!img.public_id || !img.url) {
            productErrors.push('Each image must have both public_id and url');
            break;
          }
          if (img.public_id.length > 255 || img.url.length > 2048) {
            productErrors.push('Image public_id or url too long');
            break;
          }
        }
      }
    }

    // Color validation
    if (product.color && (product.color.length < 2 || product.color.length > 30)) {
      productErrors.push('Color must be between 2 and 30 characters');
    }

    if (productErrors.length > 0) {
      errors.push({
        product: product.name || `Product at index ${i}`,
        errors: productErrors.map(err => errorPrefix + err)
      });
    } else {
      productsToImport.push(product);
    }
  }

  // Check for existing products in database
  const existingProducts = await Product.find({
    name: { $in: [...productNames].map(name => new RegExp(`^${name}$`, 'i')) }
  });

  if (existingProducts.length > 0) {
    existingProducts.forEach(prod => {
      errors.push({
        product: prod.name,
        errors: [`Product with name '${prod.name}' already exists in database`]
      });
    });
  }

  // If there are any errors, return them
  if (errors.length > 0) {
    return next(new ErrorResponse('Some products failed validation', 400, { errors }));
  }

  try {
    // Insert all valid products
    const insertedProducts = await Product.insertMany(productsToImport);
    
    res.status(201).json({
      success: true,
      count: insertedProducts.length,
      data: insertedProducts
    });
  } catch (err) {
    return next(new ErrorResponse('Failed to import products', 500));
  }
});