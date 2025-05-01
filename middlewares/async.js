// Higher-order function to wrap async/await route handlers
const asyncHandler = (fn) => (req, res, next) => {
    // Resolve the promise returned by the async function
    Promise.resolve(fn(req, res, next)).catch(next);
  };
  
  module.exports = asyncHandler;