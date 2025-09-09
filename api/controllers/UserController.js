const User = require("../models/User");
const ApiResponse = require("../utils/apiResponse");

/*
@desc Get all users
@route GET /api/users
@access Private
*/
const getAllUsersController = async (req, res) => {
	try {
		const { page = 1, limit = 10 } = req.query;
		const skip = (page - 1) * limit;

		const { q, role, sort = "name" } = req.query;
		const filter = {};

		if (q) {
			filter.$text = { $search: q };
		}

		if (role) {
			filter.role = role;
		}

		const users = await User.find(filter)
			.skip(skip)
			.limit(limit)
			.sort({ [sort]: 1 });
		const total = await User.countDocuments(filter);

		const data = {
			users,
			pagination: {
				total,
				page,
				pages: Math.ceil(total / limit),
				limit,
			},
		};

		ApiResponse.success(res, data, 200, "Users retrieved successfully");
	} catch (error) {
		ApiResponse.error(res, error.message);
	}
};

/* 
@desc Get user profile
@route GET /api/users/:id
@access Public/Private
*/
const getUserProfileController = async (req, res) => {
	try {
		// get requested user profile
		const profile = await User.findById(req.params.id);
		if (!profile) {
			return ApiResponse.notFound(res, "User not found");
		}

		// if not owner or admin, remove sensitive fields
		if (!req.user || String(profile._id) !== String(req.user._id) || !req.user.isAdmin()) {
			profile.roles = undefined;
		}
		// remove timestamps if not admin
		if (!req.user || !req.user.isAdmin()) {
			profile.createdAt = undefined;
			profile.updatedAt = undefined;
		}
		// remove sensitive fields
		profile.passwordHash = undefined;
		profile.refreshTokenHash = undefined;

		ApiResponse.success(res, profile, 200, "User retrieved successfully");
	} catch (error) {
		ApiResponse.error(res, error.message);
	}
};

/*
@desc update user profile
@route PUT /api/users/:id
@access Private
*/
const updateUserProfileController = async (req, res) => {
	try {
		// get private user profile
		const profile = await User.findById(req.params.id);
		if (!profile) {
			return ApiResponse.notFound(res, "User not found");
		}

		// update user profile
		if (req.body.name) {
			profile.name = req.body.name;
		}
		if (req.body.email) {
			profile.email = req.body.email;
		}
		if (req.body.avatarUrl) {
			profile.avatarUrl = req.body.avatarUrl;
		}
		if (req.body.bio) {
			profile.bio = req.body.bio;
		}
		// only admin can change roles
		if (req.user.isAdmin() && req.body.roles) {
			profile.roles = req.body.roles;
		}
		await profile.save();

		ApiResponse.success(res, profile, 200, "User updated successfully");
	} catch (error) {
		ApiResponse.error(res, error.message);
	}
};

/*
@desc delete user
@route DELETE /api/users/:id
@access Private
*/
const deleteUserController = async (req, res) => {
	try {
		// get private user profile
		const profile = await User.findById(req.params.id);
		if (!profile) {
			return ApiResponse.notFound(res, "User not found");
		}
		await profile.deleteOne();
		ApiResponse.success(res, profile, 200, "User deleted successfully");
	} catch (error) {
		ApiResponse.error(res, error.message);
	}
};

module.exports = {
	getAllUsersController,
	getUserProfileController,
	updateUserProfileController,
	deleteUserController,
};
