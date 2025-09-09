const Event = require("../models/Event");
const ApiResponse = require("../utils/apiResponse");

/*
@desc Get all events
@route GET /api/events/
@access Public
*/
const getAllEventsController = async (req, res) => {
	try {
		// private events filter
		if (req.user) {
			req.query.isPrivate = {
				$or: [{ isPrivate: false }, { organizer: req.user._id }],
			};
		}

		const events = await Event.search(req.query);
		const data = {
			events,
			pagination: {
				total: await Event.countDocuments(req.query),
				page: req.query.page || 1,
				pages: Math.ceil(
					(await Event.countDocuments(req.query)) / (req.query.limit || 10)
				),
				limit: req.query.limit || 10,
			},
		};
		ApiResponse.success(res, data, 200, "Events retrieved successfully");
	} catch (error) {
		ApiResponse.error(res, error.message);
	}
};

/*
@desc Get event by id
@route GET /api/events/:id
@access Public
*/
const getEventController = async (req, res) => {
	try {
		const event = await Event.findById(req.params.id);
		if (!event) {
			return ApiResponse.notFound(res, "Event not found");
		}

		// private events filter
		if (event.isPrivate && !req.user) {
			return ApiResponse.unauthorized(res, "Event is private");
		}

		ApiResponse.success(res, event, 200, "Event retrieved successfully");
	} catch (error) {
		ApiResponse.error(res, error.message);
	}
};

/*
@desc Create event
@route POST /api/events
@access Organizer
*/
const createEventController = async (req, res) => {
	try {
		const { title, description, startAt, endAt, location, capacity } = req.body;
		if (
			!title ||
			!description ||
			!startAt ||
			!endAt ||
			!location ||
			!capacity
		) {
			return ApiResponse.badRequest(res, "Missing required fields");
		}
		req.body.organizer = req.user._id;
		const event = await Event.create(req.body);
		ApiResponse.success(res, event, 201, "Event created successfully");
	} catch (error) {
		ApiResponse.error(res, error.message);
	}
};

/*
@desc Update event
@route PUT /api/events/:id
@access Organizer(owner)
*/
const updateEventController = async (req, res) => {
	try {
		const event = await Event.findById(req.params.id);
		if (!event) {
			return ApiResponse.notFound(res, "Event not found");
		}
		if (event.organizer.toString() !== req.user._id.toString()) {
			return ApiResponse.unauthorized(
				res,
				"You are not authorized to update this event"
			);
		}

		event.title = req.body.title || event.title;
		event.description = req.body.description || event.description;
		event.startAt = req.body.startAt || event.startAt;
		event.endAt = req.body.endAt || event.endAt;
		event.location = req.body.location || event.location;
		event.isOnline = req.body.isOnline || event.isOnline;
		event.onlineUrl = req.body.onlineUrl || event.onlineUrl;
		event.capacity = req.body.capacity || event.capacity;
		event.isPrivate = req.body.isPrivate || event.isPrivate;
		event.tags = req.body.tags || event.tags;
		event.coverImage = req.body.coverImage || event.coverImage;

		await event.save();
		ApiResponse.success(res, event, 200, "Event updated successfully");
	} catch (error) {
		ApiResponse.error(res, error.message);
	}
};

/*
@desc Delete event
@route DELETE /api/events/:id
@access Organizer(owner)
*/
const deleteEventController = async (req, res) => {
	try {
		const event = await Event.findById(req.params.id);
		if (!event) {
			return ApiResponse.notFound(res, "Event not found");
		}
		if (event.organizer.toString() !== req.user._id.toString()) {
			return ApiResponse.unauthorized(
				res,
				"You are not authorized to delete this event"
			);
		}
		await event.deleteOne();
		ApiResponse.success(res, event, 200, "Event deleted successfully");
	} catch (error) {
		ApiResponse.error(res, error.message);
	}
};

module.exports = {
	getAllEventsController,
	getEventController,
	createEventController,
	updateEventController,
	deleteEventController,
};
