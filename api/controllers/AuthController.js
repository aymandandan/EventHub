const User = require("../models/User");
const ApiResponse = require("../utils/apiResponse");
const jwt = require("jsonwebtoken");

const generateAccessToken = (userId, roles = ["user"]) => {
	return jwt.sign({ userId, roles }, process.env.ACCESS_TOKEN_SECRET, {
		expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
	});
};

const generateRefreshToken = (userId, roles = ["user"]) => {
	return jwt.sign({ userId, roles }, process.env.REFRESH_TOKEN_SECRET, {
		expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
	});
};

/*
@desc Register a new user
@route POST /api/auth/register
@access Public
*/
const registerController = async (req, res) => {
	try {
		const { name, email, password } = req.body;

        // check if all fields are provided
		if (!name || !email || !password) {
			return ApiResponse.badRequest(res, "All fields are required");
		}

        // check if user already exists
		const existingUser = await User.findOne({ email }).select("+passwordHash");
		if (existingUser) {
			return ApiResponse.badRequest(res, "User already exists");
		}
        
		const user = await User.create({ name, email, passwordHash: password });
        
        user.passwordHash = undefined;
        
		ApiResponse.success(res, user);
	} catch (error) {
		ApiResponse.error(res, error.message);
	}
};

/*
@desc Login user and generate tokens
@route POST /api/auth/login
@access Public
*/
const loginController = async (req, res) => {
	try {
		const { email, password } = req.body;

        // check if all fields are provided
		if (!email || !password) {
			return ApiResponse.badRequest(res, "All fields are required");
		}

		// fetch user
		const user = await User.findOne({ email }).select("+passwordHash +refreshTokenHash");

		// check if user exists
		if (!user) {
			return ApiResponse.badRequest(res, "User not found");
		}

		// check if password is correct
		const isPasswordValid = await user.verifyPassword(password);
		if (!isPasswordValid) {
			return ApiResponse.badRequest(res, "Invalid password");
		}

		// generate tokens
		const accessToken = generateAccessToken(user._id, user.roles);
		const refreshToken = generateRefreshToken(user._id, user.roles);

        // set refresh token in cookie
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: process.env.REFRESH_TOKEN_EXPIRES_IN || 7 * 24 * 60 * 60 * 1000,
        });

        // save refresh token
        await user.saveRefreshToken(refreshToken);

        user.passwordHash = undefined;
        user.refreshTokenHash = undefined;

		// return user and tokens
		ApiResponse.success(res, { user, accessToken, refreshToken });
	} catch (error) {
		ApiResponse.error(res, error.message);
	}
};

/*
@desc Refresh access token
@route POST /api/auth/refresh
@access Public
*/
const refreshController = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        // check if refresh token is provided
        if (!refreshToken) {
            return ApiResponse.badRequest(res, "Refresh token is required");
        }

        // verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

        // check if user exists
        const user = await User.findOne({ _id: decoded.userId });
        if (!user) {
            return ApiResponse.badRequest(res, "User not found");
        }

        // check if refresh token is valid
        const isRefreshTokenValid = await user.verifyRefreshToken(refreshToken);
        if (!isRefreshTokenValid) {
            return ApiResponse.badRequest(res, "Invalid refresh token");
        }

        // generate new access token
        const accessToken = generateAccessToken(user._id, user.roles);

        // return access token
        ApiResponse.success(res, { accessToken });
    } catch (error) {
        ApiResponse.error(res, error.message);       
    }
};


/*
@desc Logout user and revoke refresh token
@route POST /api/auth/logout
@access Private
*/
const logoutController = async (req, res) => {
    try {
        // check if user is authenticated
        if (!req.user) {
            return ApiResponse.unauthorized(res, "User not authenticated");
        }

        // check if refresh token is provided
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            return ApiResponse.badRequest(res, "Refresh token is required");
        }

        // check if refresh token is valid
        const isRefreshTokenValid = await req.user.verifyRefreshToken(refreshToken);
        if (!isRefreshTokenValid) {
            return ApiResponse.badRequest(res, "Invalid refresh token");
        }

        // revoke refresh token
        req.user.refreshTokenHash = null;
        await req.user.save();

        // clear refresh token in cookie
        res.clearCookie("refreshToken");

        // return success message
        ApiResponse.success(res, { message: "Logged out successfully" });
    } catch (error) {
        ApiResponse.error(res, error.message);
    }
};


module.exports = {
	registerController,
	loginController,
    refreshController,
    logoutController,
};
