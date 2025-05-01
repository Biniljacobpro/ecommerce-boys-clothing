const Cart = require('../models/Cart');
const Product = require('../models/Product');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middlewares/async');

// @desc    Get user cart
// @route   GET /api/v1/cart
// @route   GET /api/v1/users/:userId/cart
// @access  Private
exports.getCart = asyncHandler(async (req, res, next) => {
  // Check if userId is provided in params (admin access)
  const userId = req.params.userId || req.user.id;

  const cart = await Cart.findOne({ user: userId }).populate('items.product');

  if (!cart) {
    return next(new ErrorResponse(`Cart not found for user ${userId}`, 404));
  }

  res.status(200).json({
    success: true,
    data: cart,
  });
});

// @desc    Add item to cart
// @route   POST /api/v1/cart
// @access  Private
exports.addToCart = asyncHandler(async (req, res, next) => {
  const { productId, quantity, size, color } = req.body;

  // Get product details
  const product = await Product.findById(productId);

  if (!product) {
    return next(new ErrorResponse(`Product not found with id ${productId}`, 404));
  }

  // Check if product is in stock
  if (product.stock < quantity) {
    return next(
      new ErrorResponse(
        `Not enough stock. Only ${product.stock} items available`,
        400
      )
    );
  }

  // Check if size is available
  if (!product.size.includes(size)) {
    return next(
      new ErrorResponse(
        `Size ${size} not available for this product. Available sizes: ${product.size.join(
          ', '
        )}`,
        400
      )
    );
  }

  // Find user's cart or create new one
  let cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    cart = await Cart.create({
      user: req.user.id,
      items: [],
      totalPrice: 0,
    });
  }

  // Check if item already exists in cart
  const itemIndex = cart.items.findIndex(
    (item) =>
      item.product.toString() === productId && item.size === size && item.color === color
  );

  if (itemIndex > -1) {
    // Update quantity if item exists
    cart.items[itemIndex].quantity += quantity;
  } else {
    // Add new item to cart
    cart.items.push({
      product: productId,
      quantity,
      size,
      color,
      price: product.price,
    });
  }

  // Calculate total price
  cart.totalPrice = cart.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  await cart.save();

  res.status(200).json({
    success: true,
    data: cart,
  });
});

// @desc    Update cart item quantity
// @route   PUT /api/v1/cart/:itemId
// @access  Private
exports.updateCartItem = asyncHandler(async (req, res, next) => {
  const { quantity } = req.body;

  const cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    return next(new ErrorResponse(`Cart not found for user ${req.user.id}`, 404));
  }

  // Find the item in cart
  const itemIndex = cart.items.findIndex(
    (item) => item._id.toString() === req.params.itemId
  );

  if (itemIndex === -1) {
    return next(
      new ErrorResponse(`Item not found in cart with id ${req.params.itemId}`, 404)
    );
  }

  // Get product to check stock
  const product = await Product.findById(cart.items[itemIndex].product);

  if (!product) {
    return next(
      new ErrorResponse(
        `Product not found with id ${cart.items[itemIndex].product}`,
        404
      )
    );
  }

  // Check if new quantity exceeds stock
  if (product.stock < quantity) {
    return next(
      new ErrorResponse(
        `Not enough stock. Only ${product.stock} items available`,
        400
      )
    );
  }

  // Update quantity
  cart.items[itemIndex].quantity = quantity;

  // Calculate total price
  cart.totalPrice = cart.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  await cart.save();

  res.status(200).json({
    success: true,
    data: cart,
  });
});

// @desc    Remove item from cart
// @route   DELETE /api/v1/cart/:itemId
// @access  Private
exports.removeFromCart = asyncHandler(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    return next(new ErrorResponse(`Cart not found for user ${req.user.id}`, 404));
  }

  // Find the item in cart
  const itemIndex = cart.items.findIndex(
    (item) => item._id.toString() === req.params.itemId
  );

  if (itemIndex === -1) {
    return next(
      new ErrorResponse(`Item not found in cart with id ${req.params.itemId}`, 404)
    );
  }

  // Remove item from cart
  cart.items.splice(itemIndex, 1);

  // Calculate total price
  cart.totalPrice = cart.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  await cart.save();

  res.status(200).json({
    success: true,
    data: cart,
  });
});

// @desc    Clear cart
// @route   DELETE /api/v1/cart
// @access  Private
exports.clearCart = asyncHandler(async (req, res, next) => {
  const cart = await Cart.findOneAndUpdate(
    { user: req.user.id },
    { items: [], totalPrice: 0 },
    { new: true }
  );

  if (!cart) {
    return next(new ErrorResponse(`Cart not found for user ${req.user.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: cart,
  });
});