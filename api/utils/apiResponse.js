const logger = require('./logger');

class ApiResponse {
  static success(res, data, statusCode = 200, message = 'Success') {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static error(res, message = 'Internal Server Error', statusCode = 500, errors = null) {
    logger.error(message, { statusCode, errors });
    
    return res.status(statusCode).json({
      success: false,
      message,
      errors: errors ? (Array.isArray(errors) ? errors : [errors]) : undefined,
    });
  }

  static validationError(res, errors) {
    return this.error(
      res,
      'Validation Error',
      400,
      errors.array ? errors.array() : errors
    );
  }

  static notFound(res, message = 'Resource not found', error = null) {
    return this.error(res, message, 404, error);
  }

  static unauthorized(res, message = 'Unauthorized', error = null) {
    return this.error(res, message, 401, error);
  }

  static forbidden(res, message = 'Forbidden', error = null) {
    return this.error(res, message, 403, error);
  }
}

module.exports = ApiResponse;
