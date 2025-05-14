const mongoose = require('mongoose');
const Product = require('../models/Product');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middlewares/async');
const path = require('path');

// @desc    Get all products
// @route   GET /api/v1/products
// @access  Public
exports.getProducts = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Get single product
// @route   GET /api/v1/products/:id
// @access  Public
exports.getProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(
      new ErrorResponse(`Product not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: product,
  });
});

// @desc    Create new review
// @route   POST /api/v1/products/:id/reviews
// @access  Private
exports.createProductReview = asyncHandler(async (req, res, next) => {
  const { rating, comment } = req.body;

  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(
      new ErrorResponse(`Product not found with id of ${req.params.id}`, 404)
    );
  }

  // ✅ Check if user has purchased and received the product
  const order = await Order.findOne({
    user: req.user._id,
    orderStatus: 'Delivered',
    'orderItems.product': req.params.id,
  });

  if (!order) {
    return next(
      new ErrorResponse('You can only review products you have purchased and received.', 403)
    );
  }

  // Validate rating and comment before adding
  if (!rating || rating < 1 || rating > 5) {
    return next(new ErrorResponse('Rating must be between 1 and 5', 400));
  }

  if (!comment || comment.length < 2 ||comment.length > 250) {
    return next(new ErrorResponse('Comment must not exceed 250 characters', 400));
  }

  // Check if user already reviewed the product
  const alreadyReviewed = product.reviews.find(
    (r) => r.user.toString() === req.user._id.toString()
  );

  if (alreadyReviewed) {
    return next(new ErrorResponse('Product already reviewed', 400));
  }

  const review = {
    user: req.user._id,
    name: req.user.name,
    rating: Number(rating),
    comment,
  };

  product.reviews.push(review);
  product.numOfReviews = product.reviews.length;

  // Calculate average rating
  product.ratings =
    product.reviews.reduce((acc, item) => item.rating + acc, 0) /
    product.reviews.length;

  await product.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    data: product,
  });
});


// @desc    Get all reviews of a product
// @route   GET /api/v1/products/:id/reviews
// @access  Public
exports.getProductReviews = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(
      new ErrorResponse(`Product not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    count: product.reviews.length,
    data: product.reviews,
  });
});

// @desc    Update product review
// @route   PUT /api/v1/products/:productId/reviews/:reviewId
// @access  Private
exports.updateProductReview = asyncHandler(async (req, res, next) => {
  const { rating, comment } = req.body;
  const { productId, reviewId } = req.params;

  const product = await Product.findById(productId);

  if (!product) {
    return next(new ErrorResponse(`Product not found with id of ${productId}`, 404));
  }

  // Find the review
  const review = product.reviews.find(
    r => r._id.toString() === reviewId.toString()
  );

  if (!review) {
    return next(new ErrorResponse(`Review not found with id of ${reviewId}`, 404));
  }

  // Verify user is the review owner or admin
  if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to update this review', 403));
  }

  // Validate rating and comment
  if (rating && (rating < 1 || rating > 5)) {
    return next(new ErrorResponse('Rating must be between 1 and 5', 400));
  }

  if (comment && comment.length > 250) {
    return next(new ErrorResponse('Comment must not exceed 250 characters', 400));
  }

  // Update review fields
  if (rating) review.rating = Number(rating);
  if (comment) review.comment = comment;

  // Recalculate average rating
  product.ratings = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

  await product.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    data: product
  });
});

// @desc    Delete product review
// @route   DELETE /api/v1/products/:productId/reviews/:reviewId
// @access  Private/Admin
exports.deleteReview = asyncHandler(async (req, res, next) => {
  const { productId, reviewId } = req.params;

  const product = await Product.findById(productId);

  if (!product) {
    return next(new ErrorResponse(`Product not found with id of ${productId}`, 404));
  }

  // Find the review
  const reviewIndex = product.reviews.findIndex(
    r => r._id.toString() === reviewId.toString()
  );

  if (reviewIndex === -1) {
    return next(new ErrorResponse(`Review not found with id of ${reviewId}`, 404));
  }

  // Verify user is the review owner or admin
  if (product.reviews[reviewIndex].user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to delete this review', 403));
  }

  // Remove the review
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


// @desc    Compare multiple products
// @route   POST /api/v1/products/compare
// @access  Public
exports.compareProducts = asyncHandler(async (req, res, next) => {
  const { productIds } = req.body;

  // Validate input exists and is array
  if (!productIds || !Array.isArray(productIds)) {
    return next(new ErrorResponse('Please provide an array of product IDs', 400));
  }

  // Validate array length
  if (productIds.length < 2) {
    return next(new ErrorResponse('Please provide at least 2 product IDs to compare', 400));
  }
  if (productIds.length > 5) {
    return next(new ErrorResponse('Cannot compare more than 5 products at once', 400));
  }

  // Validate each ID is a proper MongoDB ObjectID
  const invalidIds = productIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
  if (invalidIds.length > 0) {
    return next(new ErrorResponse(`Invalid product IDs: ${invalidIds.join(', ')}`, 400));
  }

  // Convert strings to ObjectIDs
  const objectIds = productIds.map(id => new mongoose.Types.ObjectId(id));

  // Fetch all products
  const products = await Product.find({
    _id: { $in: objectIds }
  }).select('name description price discountPrice color size ratings images category stock numOfReviews wishlistCount');

  if (products.length < 2) {
    return next(new ErrorResponse('Could not find enough products to compare', 404));
  }

  // Create comparison matrix
  const comparison = createComparisonMatrix(products);

  res.status(200).json({
    success: true,
    count: products.length,
    data: comparison
  });
});

// Helper function to create comparison matrix
function createComparisonMatrix(products) {
  // Define which fields to compare and how to display them
  const comparisonFields = [
    {
      name: 'Name',
      key: 'name',
      type: 'text'
    },
    {
      name: 'Description',
      key: 'description',
      type: 'text'
    },
    {
      name: 'Price',
      key: 'price',
      type: 'currency'
    },
    {
      name: 'Discount Price',
      key: 'discountPrice',
      type: 'currency'
    },
    {
      name: 'Color',
      key: 'color',
      type: 'text'
    },
    {
      name: 'Available Sizes',
      key: 'size',
      type: 'array'
    },
    {
      name: 'Rating',
      key: 'ratings',
      type: 'rating'
    },
    {
      name: 'Category',
      key: 'category',
      type: 'text'
    },
    {
      name: 'In Stock',
      key: 'stock',
      type: 'number'
    },
    {
      name: 'Number of Reviews',
      key: 'numOfReviews',
      type: 'number'
    },
    {
      name: 'Wishlist Count',
      key: 'wishlistCount',
      type: 'number'
    }
  ];

  // Build the comparison matrix
  const matrix = comparisonFields.map(field => {
    const row = {
      field: field.name,
      type: field.type,
      values: {}
    };

    products.forEach(product => {
      row.values[product._id] = product[field.key];
      
      // Special formatting for certain field types
      if (field.type === 'currency' && product[field.key]) {
        row.values[product._id] = `$${product[field.key].toFixed(2)}`;
      } else if (field.type === 'array') {
        row.values[product._id] = product[field.key].join(', ');
      } else if (field.type === 'rating') {
        row.values[product._id] = `${product[field.key]} ★`;
      }
    });

    return row;
  });

  // Add product headers
  const productHeaders = products.map(product => ({
    id: product._id,
    name: product.name,
    image: product.images[0]?.url || null,
    price: product.discountPrice || product.price
  }));

  return {
    fields: matrix,
    products: productHeaders
  };
}

// @desc    Search products with filters and sorting
// @route   GET /api/v1/products/search
// @access  Public
exports.searchProducts = asyncHandler(async (req, res, next) => {
  const { keyword, category, minPrice, maxPrice, minRating, color, size, sortBy } = req.query;
  
  // Build the query object
  const query = {};

  // Keyword search (name or description)
  if (keyword) {
    query.$or = [
      { name: { $regex: keyword, $options: 'i' } },
      { description: { $regex: keyword, $options: 'i' } }
    ];
  }

  // Category filter
  if (category) {
    query.category = { $regex: new RegExp(`^${category}$`, 'i') };
  }

  // Price range filter
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  // Rating filter
  if (minRating) {
    query.ratings = { $gte: Number(minRating) };
  }

  // Color filter
  if (color) {
    query.color = { $regex: new RegExp(color, 'i') };
  }

  // Size filter
  if (size) {
    query.size = { $in: [size.toUpperCase()] };
  }

  // Sorting logic
  const sortOptions = {
    'price-asc': 'price',
    'price-desc': '-price',
    'rating': '-ratings',
    'newest': '-createdAt',
    'popular': '-wishlistCount'
  };

  const sort = sortOptions[sortBy] || '-createdAt';

  // Execute query with pagination and sorting
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const skip = (page - 1) * limit;

  const products = await Product.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit);
    
  const total = await Product.countDocuments(query);

  res.status(200).json({
    success: true,
    count: products.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: products
  });
});

// @desc    Get available search filters
// @route   GET /api/v1/products/search/filters
// @access  Public
exports.getSearchFilters = asyncHandler(async (req, res, next) => {
  const filters = await Product.aggregate([
    {
      $facet: {
        categories: [
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ],
        colors: [
          { $match: { color: { $exists: true, $ne: '' } } },
          { $group: { _id: '$color', count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ],
        sizes: [
          { $unwind: '$size' },
          { $group: { _id: '$size', count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ],
        priceRange: [
          { 
            $group: { 
              _id: null,
              min: { $min: '$price' },
              max: { $max: '$price' }
            } 
          }
        ],
        ratings: [
          { 
            $group: { 
              _id: { $floor: '$ratings' },
              count: { $sum: 1 }
            } 
          },
          { $sort: { _id: 1 } }
        ]
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: filters[0]
  });
});