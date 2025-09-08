const jwt = require("jsonwebtoken");
const ApiResponse = require("../utils/apiResponse");
const logger = require("../utils/logger");
const User = require("../models/User");

/**
 * Middleware to verify JWT token from Authorization header
 */
const requireAuth = async (req, res, next) => {
	// Get token from header
	const token = req.header("Authorization")?.replace("Bearer ", "");

	if (!token) {
		return ApiResponse.unauthorized(res, "No token provided");
	}

	try {
		// Verify token
		const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
		const user = await User.findById(decoded.userId);
		req.user = user;
		next();
	} catch (err) {
		logger.error("Token verification failed:", err);
		return ApiResponse.unauthorized(res, "Invalid or expired token");
	}
};

/**
 * Middleware to check if user has required roles
 * @param {...string} roles - List of allowed roles
 */
const requireRole = (...roles) => {
	return (req, res, next) => {
		if (!req.user) {
			return ApiResponse.unauthorized(res, "Authentication required");
		}

		const hasRole = roles.some((role) => req.user.roles.includes(role));

		if (!hasRole) {
			return ApiResponse.forbidden(
				res,
				`Access denied. Required role: ${roles.join(" or ")}`
			);
		}

		next();
	};
};

const requireOwnerOrRoles = (getOwnerId, ...roles) => {
	return (req, res, next) => {
		if (!req.user) {
			return ApiResponse.unauthorized(res, "Authentication required");
		}

		const isRole = roles.some((role) => req.user.roles.includes(role));
		const isOwner = String(getOwnerId(req)) === String(req.user._id);

		if (isRole || isOwner) {
			return next();
		}

		return ApiResponse.forbidden(
			res,
			`Access denied. You must be the owner or have one of these roles: ${roles.join(
				", "
			)}`
		);
	};
};

module.exports = {
	requireAuth,
	requireRole,
	requireOwnerOrRoles,
};
