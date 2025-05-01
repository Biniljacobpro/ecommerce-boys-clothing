const Wishlist = require('../models/Wishlist');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middlewares/async');

// @desc    Get user wishlist
// @route   GET /api/v1/wishlist
// @access  Private
exports.getWishlist = asyncHandler(async (req, res, next) => {
  const wishlist = await Wishlist.findOne({ user: req.user.id })
    .populate('items.product');

  if (!wishlist) {
    return res.status(200).json({
      success: true,
      data: { items: [] }
    });
  }

  res.status(200).json({
    success: true,
    data: wishlist
  });
});

// @desc    Add item to wishlist
// @route   POST /api/v1/wishlist
// @access  Private
exports.addToWishlist = asyncHandler(async (req, res, next) => {
  const { productId, size, color } = req.body;

  // Verify product exists
  const product = await Product.findById(productId);
  if (!product) {
    return next(new ErrorResponse(`Product not found with id ${productId}`, 404));
  }

  // Check if size is available if specified
  if (size && !product.size.includes(size)) {
    return next(
      new ErrorResponse(
        `Size ${size} not available for this product. Available sizes: ${product.size.join(', ')}`,
        400
      )
    );
  }

  // Find or create wishlist
  let wishlist = await Wishlist.findOne({ user: req.user.id });

  if (!wishlist) {
    wishlist = await Wishlist.create({
      user: req.user.id,
      items: []
    });
  }

  // Check if item already exists in wishlist
  const existingItem = wishlist.items.find(
    item => item.product.toString() === productId && 
           item.size === size && 
           item.color === color
  );

  if (existingItem) {
    return next(
      new ErrorResponse('This item is already in your wishlist', 400)
    );
  }

  // Add new item to wishlist
  wishlist.items.push({
    product: productId,
    size,
    color
  });

  await wishlist.save();

  res.status(200).json({
    success: true,
    data: wishlist
  });
});

// @desc    Remove item from wishlist
// @route   DELETE /api/v1/wishlist/:itemId
// @access  Private
exports.removeFromWishlist = asyncHandler(async (req, res, next) => {
  const wishlist = await Wishlist.findOne({ user: req.user.id });

  if (!wishlist) {
    return next(new ErrorResponse('Wishlist not found', 404));
  }

  // Find the item index
  const itemIndex = wishlist.items.findIndex(
    item => item._id.toString() === req.params.itemId
  );

  if (itemIndex === -1) {
    return next(
      new ErrorResponse(`Item not found in wishlist with id ${req.params.itemId}`, 404)
    );
  }

  // Remove the item
  wishlist.items.splice(itemIndex, 1);

  await wishlist.save();

  res.status(200).json({
    success: true,
    data: wishlist
  });
});

// @desc    Move item from wishlist to cart
// @route   POST /api/v1/wishlist/:itemId/move-to-cart
// @access  Private
exports.moveToCart = asyncHandler(async (req, res, next) => {
  const { quantity = 1 } = req.body;

  // Get wishlist item
  const wishlist = await Wishlist.findOne({ user: req.user.id })
    .populate('items.product');

  if (!wishlist) {
    return next(new ErrorResponse('Wishlist not found', 404));
  }

  // Find the item
  const itemIndex = wishlist.items.findIndex(
    item => item._id.toString() === req.params.itemId
  );

  if (itemIndex === -1) {
    return next(
      new ErrorResponse(`Item not found in wishlist with id ${req.params.itemId}`, 404)
    );
  }

  const wishlistItem = wishlist.items[itemIndex];
  const product = wishlistItem.product;

  // Check stock
  if (product.stock < quantity) {
    return next(
      new ErrorResponse(
        `Not enough stock. Only ${product.stock} items available`,
        400
      )
    );
  }

  // Find or create cart
  let cart = await Cart.findOne({ user: req.user.id });
  if (!cart) {
    cart = await Cart.create({
      user: req.user.id,
      items: [],
      totalPrice: 0
    });
  }

  // Check if item already exists in cart
  const cartItemIndex = cart.items.findIndex(
    item => item.product.toString() === product._id.toString() &&
           item.size === wishlistItem.size &&
           item.color === wishlistItem.color
  );

  if (cartItemIndex > -1) {
    // Update quantity if exists
    cart.items[cartItemIndex].quantity += quantity;
  } else {
    // Add new item to cart
    cart.items.push({
      product: product._id,
      quantity,
      size: wishlistItem.size,
      color: wishlistItem.color,
      price: product.price
    });
  }

  // Update cart total
  cart.totalPrice = cart.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  // Remove from wishlist
  wishlist.items.splice(itemIndex, 1);

  // Save both
  await Promise.all([cart.save(), wishlist.save()]);

  res.status(200).json({
    success: true,
    data: {
      cart,
      wishlist
    }
  });
});