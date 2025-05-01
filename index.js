const express = require('express');
require('colors');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const path = require('path');
const useragent = require('express-useragent');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const errorHandler = require('./middlewares/errorMiddleware');
const connectDB = require('./config/db');

// Load env vars
dotenv.config({ path: '.env' });

// Connect to database
connectDB();

// Route files
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const userRoutes = require('./routes/userRoutes');
const wishlist = require('./routes/wishlistRoutes');

const app = express();

// Set security headers
app.use(helmet());

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// Safe and effective sanitizer middleware
app.use((req, res, next) => {
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      // Only replace potentially dangerous MongoDB operators
      return value.replace(/\$/g, '_').replace(/\[(\w+)\]/g, '_$1_');
    }
    return value;
  };

  const sanitizeObject = (obj) => {
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        // Sanitize keys that start with $
        if (key.startsWith('$')) {
          const newKey = '_' + key.slice(1);
          obj[newKey] = sanitizeValue(obj[key]);
          delete obj[key];
        } else {
          // Recursively sanitize nested objects/arrays
          if (typeof obj[key] === 'object') {
            sanitizeObject(obj[key]);
          } else {
            obj[key] = sanitizeValue(obj[key]);
          }
        }
      });
    }
  };

  // Apply to body, query, and params
  sanitizeObject(req.body);
  sanitizeObject(req.query);
  sanitizeObject(req.params);

  next();
});

// Prevent XSS attacks
app.use(xss());

// Prevent http param pollution
app.use(hpp());

// User agent middleware
app.use(useragent.express());

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 mins
  max: 100,
});
app.use(limiter);



// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Mount routers
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/wishlist', wishlist);

// Error handler middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(
    PORT,
    console.log(
      `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.green.bold
    )
  );
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`.red.bold);
    server.close(() => process.exit(1));
  });