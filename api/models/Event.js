const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
	{
		title: { type: String, required: true, trim: true, index: true },
		description: { type: String, required: true },
		startAt: { type: Date, required: true, index: true },
		endAt: { type: Date, required: true },
		location: {
			type: String,
			required: true,
			trim: true,
		},
		isOnline: { type: Boolean, default: false },
		onlineUrl: { type: String, trim: true },
		organizer: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		capacity: { type: Number, required: true, min: 1 },
		isPrivate: { type: Boolean, default: false },
		tags: { type: [String], default: [], index: true },
		coverImage: { type: String },
		status: {
			type: String,
			enum: ["upcoming", "ongoing", "completed", "cancelled"],
			default: "upcoming",
			index: true,
		},
	},
	{ timestamps: true, toJSON: { virtuals: true } }
);

// Virtual for checking if event is full
// This will be populated when querying with .populate('isFull')
eventSchema.virtual("isFull").get(function () {
	return this.attendeesCount >= this.capacity;
});

// Indexes for common queries
eventSchema.index({ startAt: 1, status: 1 });
eventSchema.index({ organizer: 1, startAt: -1 });
eventSchema.index({ tags: 1, startAt: -1 });

// Text index for search
eventSchema.index({ title: "text", description: "text", location: "text" });

// Middleware to update status based on dates
eventSchema.pre("save", function (next) {
	const now = new Date();
	if (this.startAt <= now && this.endAt >= now) {
		this.status = "ongoing";
	} else if (this.endAt < now) {
		this.status = "completed";
	}
	next();
});

// Static method for event search
eventSchema.statics.search = function (query) {
	const { q, tags, from, to, page = 1, limit = 10, sort = "startAt" } = query;
	const skip = (page - 1) * limit;

	const filter = {};

	// Text search
	if (q) {
		filter.$text = { $search: q };
	}

	// Tag filter
	if (tags) {
		filter.tags = { $in: Array.isArray(tags) ? tags : [tags] };
	}

	// Date range
	if (from || to) {
		filter.startAt = {};
		if (from) filter.startAt.$gte = new Date(from);
		if (to) filter.startAt.$lte = new Date(to);
	}

	return this.find(filter)
		.sort({ [sort]: 1 })
		.skip(skip)
		.limit(limit)
		.populate("organizer", "name email");
};

module.exports = mongoose.model("Event", eventSchema);
