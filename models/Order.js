const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  size: {
    type: String,
    required: true,
  },
  color: {
    type: String,
  },
  price: {
    type: Number,
    required: true,
  },
});

const shippingInfoSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
  },
  pinCode: {
    type: String,
    required: true,
  },
  phoneNo: {
    type: String,
    required: true,
  },
});

const paymentInfoSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
  },
});

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  orderItems: [orderItemSchema],
  shippingInfo: shippingInfoSchema,
  paymentInfo: paymentInfoSchema,
  itemsPrice: {
    type: Number,
    required: true,
    default: 0,
  },
  taxPrice: {
    type: Number,
    required: true,
    default: 0,
    max: [100, 'Tax price cannot be more than 100'],
  },
  shippingPrice: {
    type: Number,
    required: true,
    default: 0,
  },
  totalPrice: {
    type: Number,
    required: true,
    default: 0,
  },
  orderStatus: {
    type: String,
    required: true,
    default: 'Processing',
    enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled'],
  },
  trackingInfo: {
    carrier: {
      type: String,
      enum: ['FedEx', 'UPS', 'USPS', 'DHL', 'Other'],
      default: 'Other',
    },
    trackingNumber: String,
    trackingUrl: String,
    status: {
      type: String,
      enum: ['label_created', 'in_transit', 'out_for_delivery', 'delivered', 'exception'],
      default: 'label_created',
    },
    events: [
      {
        description: String,
        location: String,
        timestamp: Date,
        status: String,
      },
    ],
    estimatedDelivery: Date,
    lastUpdated: Date,
  },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);