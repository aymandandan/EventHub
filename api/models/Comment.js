const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    },
    content: { 
      type: String, 
      required: true, 
      maxlength: 2000,
      trim: true
    },
    meta: {
      edited: { 
        type: Boolean, 
        default: false 
      },
      likes: { 
        type: Number, 
        default: 0 
      },
      // Store users who liked the comment to prevent duplicate likes
      likedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }]
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Add a virtual for replies
commentSchema.virtual('replies', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parentComment',
  justOne: false
});

// Index for common queries
commentSchema.index({ event: 1, parentComment: 1, createdAt: 1 });
commentSchema.index({ user: 1, createdAt: -1 });

// Static method to get comments for an event with pagination
commentSchema.statics.getEventComments = async function(eventId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  
  const [comments, total] = await Promise.all([
    this.find({ 
      event: eventId,
      parentComment: null // Only get top-level comments
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'name avatarUrl')
    .populate({
      path: 'replies',
      populate: {
        path: 'user',
        select: 'name avatarUrl'
      },
      options: { sort: { createdAt: 1 } }
    }),
    this.countDocuments({ event: eventId, parentComment: null })
  ]);

  return {
    comments,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    hasMore: page * limit < total,
  };
};

// Method to add a like to a comment
commentSchema.methods.addLike = async function(userId) {
  // Check if user already liked this comment
  if (this.meta.likedBy.includes(userId)) {
    throw new Error('You have already liked this comment');
  }
  
  this.meta.likedBy.push(userId);
  this.meta.likes += 1;
  return this.save();
};

// Method to remove a like from a comment
commentSchema.methods.removeLike = async function(userId) {
  const userIndex = this.meta.likedBy.indexOf(userId);
  if (userIndex === -1) {
    throw new Error('You have not liked this comment');
  }
  
  this.meta.likedBy.splice(userIndex, 1);
  this.meta.likes = Math.max(0, this.meta.likes - 1);
  return this.save();
};

// Middleware to delete replies when a comment is deleted
commentSchema.pre('remove', async function(next) {
  await this.model('Comment').deleteMany({ parentComment: this._id });
  next();
});

module.exports = mongoose.model("Comment", commentSchema);
