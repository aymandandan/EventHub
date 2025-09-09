
const Event = require("../models/Event");
const Comment = require("../models/Comment");
const RSVP = require("../models/RSVP");
const Notification = require("../models/Notification");
const ApiResponse = require("../utils/apiResponse");

const getEventOwner = async (req, res, next) => {
    const event = await Event.findById(req.params.id);
    if (!event) {
        return ApiResponse.notFound(res, "Event not found");
    }
    req.eventOwner = event.organizer;
    next();
};

const getCommentOwner = async (req, res, next) => {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
        return ApiResponse.notFound(res, "Comment not found");
    }
    req.commentOwner = comment.user;
    next();
};

const getrsvpOwner = async (req, res, next) => {
    const rsvp = await RSVP.findById(req.params.id);
    if (!rsvp) {
        return ApiResponse.notFound(res, "RSVP not found");
    }
    req.rsvpOwner = rsvp.user;
    next();
};

const getNotificationOwner = async (req, res, next) => {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
        return ApiResponse.notFound(res, "Notification not found");
    }
    req.notificationOwner = notification.user;
    next();
};

module.exports = {
    getEventOwner,
    getCommentOwner,
    getrsvpOwner,
    getNotificationOwner
};
