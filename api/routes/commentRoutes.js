const express = require("express");
const router = express.Router();
const {
	createCommentController,
	getCommentsController,
	likeCommentController,
	deleteCommentController,
} = require("../controllers/commentController");
const { getCommentOwner } = require("../middleware/getOwner");
const { requireAuth, requireOwnerOrRoles } = require("../middleware/auth");

router.post("/:id/comments", requireAuth, createCommentController);
router.get("/:id/comments", getCommentsController);
router.post(
	"/:id/comments/:commentId/like",
	requireAuth,
	likeCommentController
);
router.delete(
	"/:id/comments/:commentId",
	requireAuth,
	getCommentOwner,
	requireOwnerOrRoles((req) => req.commentOwner._id, "organizer", "admin"),
	deleteCommentController
);

module.exports = router;

