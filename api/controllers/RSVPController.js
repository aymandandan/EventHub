const Event = require("../models/Event");
const RSVP = require("../models/RSVP");
const ApiResponse = require("../utils/apiResponse");

/*
@desc Create/Update RSVP for current user
@route POST /api/events/:id/rsvp
@access Private
*/
const createRSVPController = async (req, res) => {
	try {
		const event = await Event.findById(req.params.id);
		if (!event) {
			return ApiResponse.notFound(res, "Event not found");
		}
		// check if event is private and user is not organizer
		if (
			event.isPrivate &&
			event.organizer.toString() !== req.user._id.toString()
		) {
			return ApiResponse.unauthorized(res, "Event is private");
		}
		// check if event is full
		if (event.isFull) {
			return ApiResponse.error(res, "Event is full", 409);
		}
		// check if status is valid
		if (
			req.body.status !== "attending" &&
			req.body.status !== "maybe" &&
			req.body.status !== "cancelled"
		) {
			return ApiResponse.error(res, "Invalid RSVP status", 400);
		}

		// check if user has already RSVPed for this event
		const rsvpExists = await RSVP.findOne({
			event: req.params.id,
			user: req.user._id,
		});

		if (rsvpExists) {
			rsvpExists.status = req.body.status;
			await rsvpExists.save();
			return ApiResponse.success(
				res,
				rsvpExists,
				200,
				"RSVP updated successfully"
			);
		} else {
			const rsvp = await RSVP.create({
				event: req.params.id,
				user: req.user._id,
				status: req.body.status,
			});
			ApiResponse.success(res, rsvp, 201, "RSVP created successfully");
		}
	} catch (error) {
		ApiResponse.error(res, error.message);
	}
};

/*
@desc Remove user's rsvp
@route DELETE /api/events/:id/rsvp
@access Private
*/
const deleteRSVPController = async (req, res) => {
	try {
		const rsvp = await RSVP.findOneAndDelete({
			event: req.params.id,
			user: req.user._id,
		});
		if (!rsvp) {
			return ApiResponse.notFound(res, "RSVP not found");
		}
		ApiResponse.success(res, rsvp, 200, "RSVP deleted successfully");
	} catch (error) {
		ApiResponse.error(res, error.message);
	}
};

/*
@desc Get List RSVPs (owner) + counts
@route GET /api/events/:id/rsvps
@access Private
*/
const getRSVPsController = async (req, res) => {
	try {
		const rsvps = await RSVP.find({ event: req.params.id }).populate(
			"user",
			"name"
		);
		const counts = await RSVP.getEventRsvpCounts(req.params.id);
		ApiResponse.success(
			res,
			{ counts, data: rsvps },
			200,
			"RSVPs retrieved successfully"
		);
	} catch (error) {
		ApiResponse.error(res, error.message);
	}
};

module.exports = {
	createRSVPController,
	deleteRSVPController,
	getRSVPsController,
};
