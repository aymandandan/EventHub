const express = require("express");
const router = express.Router();

const {
    verifyToken,
	requireAuth,
	requireRole,
	requireOwnerOrRoles,
} = require("../middleware/auth");
const {
	getAllUsersController,
	getUserProfileController,
	updateUserProfileController,
	deleteUserController,
} = require("../controllers/UserController");

// verify token
router.use(verifyToken);

// Get all users (admin only)
router.get("/", requireAuth, requireRole("admin"), getAllUsersController);

// Get user profile (public)
router.get("/:id", getUserProfileController);

// Update user (owner or admin)
router.put(
	"/:id",
	requireAuth,
	requireOwnerOrRoles((req) => req.params.id, "admin"),
	updateUserProfileController
);

// Delete user (owner or admin)
router.delete(
	"/:id",
	requireAuth,
	requireOwnerOrRoles((req) => req.params.id, "admin"),
	deleteUserController
);

module.exports = router;
