const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "event_updated",
        "event_cancelled",
        "new_comment",
        "comment_reply",
        "rsvp_update",
      ],
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false, index: true },
    relatedEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      index: true,
    },
    relatedComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
    },
    relatedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Index for common queries
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

// Static method to create a notification
notificationSchema.statics.createNotification = async function (data) {
  const { user, type, title, message, relatedEvent, relatedComment, relatedUser } = data;
  
  return this.create({
    user,
    type,
    title,
    message,
    relatedEvent,
    relatedComment,
    relatedUser,
  });
};

// Static method to mark notifications as read
notificationSchema.statics.markAsRead = async function (notificationIds, userId) {
  return this.updateMany(
    { _id: { $in: notificationIds }, user: userId },
    { $set: { isRead: true } }
  );
};

// Static method to get unread count for a user
notificationSchema.statics.getUnreadCount = async function (userId) {
  return this.countDocuments({ user: userId, isRead: false });
};

// Static method to get user's notifications with pagination
notificationSchema.statics.getUserNotifications = async function (userId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  
  const [notifications, total] = await Promise.all([
    this.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("relatedEvent", "title")
      .populate("relatedUser", "name avatarUrl"),
    this.countDocuments({ user: userId }),
  ]);

  return {
    notifications,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    hasMore: page * limit < total,
  };
};

module.exports = mongoose.model("Notification", notificationSchema);
