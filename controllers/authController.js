const jwt = require('jsonwebtoken');
const config = require('../config/config');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middlewares/async');
const sendEmail = require('../utils/emailService');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const bcrypt = require('bcryptjs');
const emailValidator = require('email-validator');
const crypto = require('crypto');

// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
// controllers/authController.js

exports.register = asyncHandler(async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // ===== TRIM FIELDS =====
    const trimmedName = name?.trim();
    const trimmedEmail = email?.trim().toLowerCase();

    // ===== NAME VALIDATION =====
    const nameRegex = /^[A-Za-z ]+$/;
    const repeatedCharRegex = /(.)\1{2,}/;

    if (!trimmedName || !nameRegex.test(trimmedName)) {
      return next(new ErrorResponse("Name must contain only letters and spaces.", 400));
    }

    if (trimmedName.length < 3) {
      return next(new ErrorResponse("Name must be at least 3 characters long.", 400));
    }

    if (repeatedCharRegex.test(trimmedName.replace(/\s/g, ''))) {
      return next(new ErrorResponse("Name cannot have repetitive characters like 'aaa' or 'sss'.", 400));
    }

    // ===== EMAIL VALIDATION =====
    if (!trimmedEmail || !emailValidator.validate(trimmedEmail)) {
      return next(new ErrorResponse("Please enter a valid email address.", 400));
    }

    const emailParts = trimmedEmail.split('@');
    if (emailParts.length !== 2) {
      return next(new ErrorResponse("Invalid email format.", 400));
    }

    const emailDomain = emailParts[1].toLowerCase().trim();
    const domainParts = emailDomain.split('.');
    const tld = domainParts[domainParts.length - 1];

    const validTLDs = ['com', 'net', 'org', 'in', 'co', 'edu', 'gov', 'io', 'info', 'ajce'];
    if (!validTLDs.includes(tld)) {
      return next(new ErrorResponse(`Unsupported email TLD '.${tld}'`, 400));
    }

    const blockedSubstrings = ['.uds', '.ddd'];
    if (blockedSubstrings.some(sub => trimmedEmail.includes(sub))) {
      return next(new ErrorResponse("Email format not allowed (e.g., '.uds', '.ddd').", 400));
    }

    const allowedDomains = [
      'gmail.com',
      'yahoo.com',
      'outlook.com',
      'protonmail.com',
      'icloud.com',
      'mca.ajce.in',
      'duck.com'
    ];

    if (!allowedDomains.includes(emailDomain)) {
      return next(new ErrorResponse(`Email domain '${emailDomain}' is not allowed.`, 400));
    }

    if (trimmedEmail.includes('--') || /\d-\d/.test(trimmedEmail)) {
      return next(new ErrorResponse("Email format not allowed.", 400));
    }

    // ===== PASSWORD VALIDATION =====
if (!password) {
  return next(new ErrorResponse("Password is required.", 400));
}

if (/\s/.test(password)) {
  return next(new ErrorResponse("Password cannot contain spaces.", 400));
}

const trimmedPassword = password.trim();

const strongPasswordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@#$%^&+=!]).{8,}$/;
if (!strongPasswordRegex.test(trimmedPassword)) {
  return next(new ErrorResponse(
    "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
    400
  ));
}


    // ===== CHECK IF USER EXISTS =====
    const existingUser = await User.findOne({ email: trimmedEmail });
    if (existingUser) {
      return next(new ErrorResponse("User already exists!", 400));
    }

    // ===== CREATE USER =====
    const user = await User.create({
      name: trimmedName,
      email: trimmedEmail,
      password: trimmedPassword //  Save trimmed password; hashing happens inside Mongoose
    });

    // ===== SEND WELCOME EMAIL =====
    try {
      await sendEmail({
        email: trimmedEmail,
        subject: 'Welcome to DressUp - Elevate Your Style!',
        message: `
          Dear ${trimmedName},

          Thank you for registering with DressUp! We're thrilled to have you as part of our fashion community.

          With your new account, you can:
          - Browse our latest boys' clothing collections
          - Save your favorite items
          - Enjoy fast checkout
          - Track your orders

          Our slogan "elevate your style" reflects our commitment to helping you find the perfect outfits for every occasion.

          Start shopping now and discover how we can help elevate your wardrobe!

          Warm regards,
          The DressUp Team
        `,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2c3e50;">Welcome to DressUp!</h1>
            <p style="font-size: 16px;">Dear ${trimmedName},</p>
            <p>Thank you for registering with DressUp! We're thrilled to have you as part of our fashion community.</p>
            
            <h3 style="color: #2c3e50;">Your account benefits:</h3>
            <ul>
              <li>Browse our latest boys' clothing collections</li>
              <li>Save your favorite items</li>
              <li>Enjoy fast checkout</li>
              <li>Track your orders</li>
            </ul>
            
            <p>Our slogan <strong>"elevate your style"</strong> reflects our commitment to helping you find the perfect outfits for every occasion.</p>
            
            <p>Start shopping now and discover how we can help elevate your wardrobe!</p>
            
            <div style="margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL || 'https://yourstore.com'}" 
                 style="background-color: #2c3e50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Start Shopping
              </a>
            </div>
            
            <p style="margin-top: 30px;">Warm regards,<br>The DressUp Team</p>
            
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777;">
              <p>DressUp - Elevate Your Style</p>
              <p>${process.env.FRONTEND_URL || 'https://yourstore.com'}</p>
            </div>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Welcome email failed:', emailError);
      // Don't fail registration if email fails
    }

    // ===== SEND TOKEN =====
    sendTokenResponse(user, 201, res);

  } catch (error) {
    console.error("Registration error:", error);
    next(new ErrorResponse(error.message || "Registration failed. Please try again.", 500));
  }
});


// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email & password
  if (!email || !password) {
    return next(new ErrorResponse('Please provide an email and password', 400));
  }

  // Check for user
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  sendTokenResponse(user, 200, res);
});

// @desc    Admin login
// @route   POST /api/v1/auth/admin/login
// @access  Public
exports.adminLogin = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Check if the provided email matches the admin email
  if (email !== config.adminEmail) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // Check if the provided password matches the admin password
  if (password !== config.adminPassword) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // Find or create admin user
  let admin = await User.findOne({ email: config.adminEmail });

  if (!admin) {
    admin = await User.create({
      name: 'Admin',
      email: config.adminEmail,
      password: config.adminPassword,
      role: 'admin',
    });
  }

  sendTokenResponse(admin, 200, res);
});

// @desc    Get current logged in user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc    Log user out / clear cookie
// @route   GET /api/v1/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    data: {},
  });
});

// Get token from model, create cookie and send response
// Modify the sendTokenResponse function
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });

  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  res.status(statusCode).cookie('token', token, options).json({
    success: true,
    token
  });
};

// @desc    Authenticate with Google
// @route   POST /api/v1/auth/google
// @access  Public
exports.googleAuth = asyncHandler(async (req, res, next) => {
  const { token } = req.body;

  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const { name, email, picture } = ticket.getPayload();

  // Check if user exists
  let user = await User.findOne({ email });

  if (!user) {
    // Create new user if doesn't exist
    user = await User.create({
      name,
      email,
      password: 'google-auth', // You might want to handle this differently
      avatar: picture,
      isVerified: true,
    });
  }

  sendTokenResponse(user, 200, res);
});