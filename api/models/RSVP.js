const mongoose = require("mongoose");

const rsvpSchema = new mongoose.Schema(
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
		status: {
			type: String,
			enum: ["attending", "maybe", "cancelled"],
			required: true,
			index: true,
		},
	},
	{ timestamps: true }
);

// Compound index to ensure one RSVP per user per event
rsvpSchema.index({ event: 1, user: 1 }, { unique: true });

// Index for common queries
rsvpSchema.index({ user: 1, status: 1 });
rsvpSchema.index({ event: 1, status: 1 });

// Static method to get RSVP counts for an event
rsvpSchema.statics.getEventRsvpCounts = async function (eventId) {
	// Convert string ID to ObjectId if needed
	const eventObjectId =
		typeof eventId === "string"
			? new mongoose.Types.ObjectId(eventId)
			: eventId;
	const result = await this.aggregate([
		{ $match: { event: eventObjectId } },
		{ $group: { _id: "$status", count: { $sum: 1 } } },
	]);

	// Convert array to object with status as keys
	return result.reduce(
		(acc, { _id, count }) => ({
			...acc,
			[_id]: count,
		}),
		{ attending: 0, maybe: 0, cancelled: 0 }
	);
};

// Update event's attendees count when RSVP changes
rsvpSchema.post("save", async function (doc) {
	const Event = mongoose.model("Event");
	const counts = await this.constructor.getEventRsvpCounts(doc.event);

	await Event.findByIdAndUpdate(doc.event, {
		$set: {
			attendeesCount: counts.attending,
			maybesCount: counts.maybe,
		},
	});
});

// Also update on remove
rsvpSchema.post("remove", async function (doc) {
	const Event = mongoose.model("Event");
	const counts = await this.constructor.getEventRsvpCounts(doc.event);

	await Event.findByIdAndUpdate(doc.event, {
		$set: {
			attendeesCount: counts.attending,
			maybesCount: counts.maybe,
		},
	});
});

module.exports = mongoose.model("RSVP", rsvpSchema);
