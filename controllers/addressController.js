// controllers/addressController.js
const asyncHandler = require('../middlewares/async');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get user addresses
// @route   GET /api/addresses
// @access  Private
exports.getAddresses = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('addresses');
  res.status(200).json({
    success: true,
    data: user.addresses
  });
});


// @desc    Add new address
// @route   POST /api/addresses
// @access  Private
exports.addAddress = asyncHandler(async (req, res, next) => {
    const { street, city, state, zip, country, phone, isDefault, addressType, tag } = req.body;
    
    const user = await User.findById(req.user.id);
    
    // Check address limit (4 max)
    if (user.addresses.length >= 4) {
      return next(new ErrorResponse('Maximum of 4 saved addresses reached. Please delete an existing address first.', 400));
    }
  
    const address = {
      street,
      city,
      state,
      zip,
      country,
      phone,
      addressType,
      tag
    };
  
    // If this is the first address or is set as default, make it default
    if (isDefault || user.addresses.length === 0) {
      user.addresses.forEach(addr => { addr.isDefault = false; });
      address.isDefault = true;
    }
  
    user.addresses.push(address);
    await user.save();
  
    res.status(201).json({
      success: true,
      data: address
    });
  });

// @desc    Update address
// @route   PUT /api/addresses/:id
// @access  Private
exports.updateAddress = asyncHandler(async (req, res, next) => {
  const { street, city, state, zip, country, phone, isDefault, addressType, tag } = req.body;
  
  const user = await User.findById(req.user.id);
  const address = user.addresses.id(req.params.id);
  
  if (!address) {
    return next(new ErrorResponse('Address not found', 404));
  }

  address.street = street || address.street;
  address.city = city || address.city;
  address.state = state || address.state;
  address.zip = zip || address.zip;
  address.country = country || address.country;
  address.phone = phone || address.phone;
  address.addressType = addressType || address.addressType;
  address.tag = tag || address.tag;

  if (isDefault) {
    user.addresses.forEach(addr => { addr.isDefault = false; });
    address.isDefault = true;
  }

  await user.save();

  res.status(200).json({
    success: true,
    data: address
  });
});

// @desc    Delete address
// @route   DELETE /api/addresses/:id
// @access  Private
exports.deleteAddress = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  const address = user.addresses.id(req.params.id);
  if (!address) {
    return next(new ErrorResponse('Address not found', 404));
  }

  // If deleting default address, set another as default if available
  if (address.isDefault && user.addresses.length > 1) {
    const newDefault = user.addresses.find(addr => !addr._id.equals(req.params.id));
    if (newDefault) newDefault.isDefault = true;
  }

  user.addresses.pull(req.params.id);
  await user.save();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Set default address
// @route   PUT /api/addresses/:id/set-default
// @access  Private
exports.setDefaultAddress = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  const address = user.addresses.id(req.params.id);
  if (!address) {
    return next(new ErrorResponse('Address not found', 404));
  }

  user.addresses.forEach(addr => { addr.isDefault = false; });
  address.isDefault = true;
  await user.save();

  res.status(200).json({
    success: true,
    data: address
  });
});

// @desc    To count address
// @route   PUT /api/addresses/count
// @access  Private
exports.getAddressCount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('addresses');
  res.status(200).json({
    success: true,
    count: user.addresses.length,
    maxAllowed: 4
  });
});