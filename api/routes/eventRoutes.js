const express = require("express");
const router = express.Router();

const {
	verifyToken,
	requireAuth,
	requireRole,
	requireOwnerOrRoles,
} = require("../middleware/auth");
const {
	getAllEventsController,
	getEventController,
	createEventController,
	updateEventController,
	deleteEventController,
} = require("../controllers/EventsController");
const { getEventOwner } = require("../middleware/getOwner");

// verify token
router.use(verifyToken);

router.get("/", getAllEventsController);
router.get("/:id", getEventController);
router.post(
	"/",
	requireAuth,
	requireRole("organizer", "admin"),
	createEventController
);
router.put(
	"/:id",
	requireAuth,
	getEventOwner,
	requireOwnerOrRoles((req) => req.eventOwner._id, "organizer", "admin"),
	updateEventController
);
router.delete(
	"/:id",
	requireAuth,
	getEventOwner,
	requireOwnerOrRoles((req) => req.eventOwner._id, "organizer", "admin"),
	deleteEventController
);

module.exports = router;
