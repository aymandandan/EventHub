const logger = require('../utils/logger');
const ApiResponse = require('../utils/apiResponse');

/**
 * Error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error(err.stack);

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return ApiResponse.unauthorized(res, 'Invalid token');
  }
  
  if (err.name === 'TokenExpiredError') {
    return ApiResponse.unauthorized(res, 'Token expired');
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return ApiResponse.validationError(res, err);
  }

  // Handle MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return ApiResponse.error(
      res,
      `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
      400
    );
  }

  // Handle mongoose cast error (e.g., invalid ObjectId)
  if (err.name === 'CastError') {
    return ApiResponse.error(res, 'Invalid ID format', 400);
  }

  // Default to 500 server error
  return ApiResponse.error(
    res,
    process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    500
  );
};

module.exports = errorHandler;
