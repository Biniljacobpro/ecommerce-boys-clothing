const ErrorResponse = require('../utils/errorResponse');

exports.verifyWebhook = (req, res, next) => {
  const webhookSecret = req.headers['x-webhook-secret'];
  
  if (webhookSecret !== process.env.SHIPPING_WEBHOOK_SECRET) {
    return next(new ErrorResponse('Unauthorized webhook attempt', 401));
  }
  
  next();
};