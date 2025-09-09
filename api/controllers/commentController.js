const Comment = require("../models/Comment");
const Event = require("../models/Event");
const ApiResponse = require("../utils/apiResponse");

/*
@desc Create a comment or reply
@route POST /api/events/:id/comments
@access Private
*/
const createCommentController = async (req, res) => {
	try {
		const { content, parentComment } = req.body;
		if (!content) {
			return ApiResponse.badRequest(res, "Missing required fields");
		}
		if (parentComment) {
			const parent = await Comment.findById(parentComment);
			if (!parent) {
				return ApiResponse.notFound(res, "Parent comment not found");
			}
		}
		req.body.event = req.params.id;
		req.body.user = req.user._id;
		const comment = await Comment.create(req.body);
		ApiResponse.success(res, comment, 201, "Comment created successfully");
	} catch (error) {
		return ApiResponse.error(res, error.message);
	}
};

/*
@desc Get comments for an event
@route GET /api/events/:id/comments
@access Public / Private
*/
const getCommentsController = async (req, res) => {
	try {
		// check if the event is private and user is not owner
		const event = await Event.findById(req.params.id);
		if (
			event.isPrivate &&
			(!req.user || event.organizer.toString() !== req.user._id.toString())
		) {
			return ApiResponse.unauthorized(res, "Event is private");
		}
		// get comments
		const comments = await Comment.getEventComments(req.params.id, req.query);
		ApiResponse.success(res, comments, 200, "Comments retrieved successfully");
	} catch (error) {
		return ApiResponse.error(res, error.message);
	}
};

/*
@desc like a comment
@route POST /api/events/:id/comments/:commentId/like
@access Private
*/
const likeCommentController = async (req, res) => {
	try {
		const comment = await Comment.findById(req.params.commentId);
		if (!comment) {
			return ApiResponse.notFound(res, "Comment not found");
		}
		if (comment.meta.likedBy.includes(req.user._id)) {
			await comment.removeLike(req.user._id);
			ApiResponse.success(res, comment, 200, "Comment unliked successfully");
		} else {
			await comment.addLike(req.user._id);
			ApiResponse.success(res, comment, 200, "Comment liked successfully");
		}
	} catch (error) {
		return ApiResponse.error(res, error.message);
	}
};

/*
@desc Delete a comment
@route DELETE /api/events/:id/comments/:commentId
@access Private (comment owner or event organizer or admin)
*/
const deleteCommentController = async (req, res) => {
	try {
		const comment = await Comment.findById(req.params.commentId);
		if (!comment) {
			return ApiResponse.notFound(res, "Comment not found");
		}
		const event = await Event.findById(req.params.id);
		if (!event) {
			return ApiResponse.notFound(res, "Event not found");
		}
		// check if user is not owner or organizer or admin
		if (
			comment.user.toString() !== req.user._id.toString() &&
			event.organizer.toString() !== req.user._id.toString() &&
			!req.user.isAdmin()
		) {
			return ApiResponse.unauthorized(
				res,
				"You are not authorized to delete this comment"
			);
		}
		await comment.deleteOne();
		ApiResponse.success(res, comment, 200, "Comment deleted successfully");
	} catch (error) {
		return ApiResponse.error(res, error.message);
	}
};

module.exports = {
	createCommentController,
	getCommentsController,
	likeCommentController,
	deleteCommentController,
};
