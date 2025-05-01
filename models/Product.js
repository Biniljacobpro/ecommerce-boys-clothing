const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a product name'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
  },
  price: {
    type: Number,
    required: [true, 'Please add a price'],
    maxlength: [8, 'Price cannot exceed 8 characters'],
  },
  discountPrice: {
    type: Number,
  },
  color: {
    type: String,
  },
  size: {
    type: [String],
    required: true,
  },
  ratings: {
    type: Number,
    default: 0,
  },
  images: [
    {
      public_id: {
        type: String,
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
    },
  ],
  category: {
    type: String,
    required: [true, 'Please add a category'],
    enum: ['shirts', 'pants', 'shoes', 'accessories','t-shirt'],
  },
  stock: {
    type: Number,
    required: [true, 'Please add stock quantity'],
    maxlength: [10, 'Stock cannot exceed 10 characters'],
    default: 1,
  },
  numOfReviews: {
    type: Number,
    default: 0,
  },
  wishlistCount: {
    type: Number,
    default: 0,
  },
  comparisonCount: {
    type: Number,
    default: 0,
    min: 0
  },
  reviews: [
    {
      user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      rating: {
        type: Number,
        required: true,
        min: [1, 'Rating must be at least 1'],
        max: [5, 'Rating cannot exceed 5'],
      },
      comment: {
        type: String,
        required: true,
        maxlength: [250, 'Comment cannot exceed 250 characters'],
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Clean up wishlist items when product is removed
productSchema.pre('remove', async function(next) {
  try {
    const Wishlist = mongoose.model('Wishlist');
    await Wishlist.updateMany(
      { 'items.product': this._id },
      { $pull: { items: { product: this._id } } }
    );
    next();
  } catch (err) {
    next(err);
  }
});

// Update wishlistCount when product is added/removed from wishlists
productSchema.methods.updateWishlistCount = async function() {
  const Wishlist = mongoose.model('Wishlist');
  const count = await Wishlist.countDocuments({ 'items.product': this._id });
  this.wishlistCount = count;
  await this.save();
};

// method to increment comparison count
productSchema.methods.incrementComparisonCount = async function() {
  if (typeof this.comparisonCount !== 'number' || isNaN(this.comparisonCount)) {
    this.comparisonCount = 0;
  }
  this.comparisonCount += 1;
  await this.save();
};

module.exports = mongoose.model('Product', productSchema);