const express = require("express");
const router = express.Router();
const {
	createRSVPController,
	deleteRSVPController,
	getRSVPsController,
} = require("../controllers/RSVPController");
const { requireAuth, requireOwnerOrRoles } = require("../middleware/auth");
const { getEventOwner } = require("../middleware/getOwner");

router.post("/:id/rsvp", requireAuth, createRSVPController);
router.delete(
	"/:id/rsvp",
	requireAuth,
	getEventOwner,
	requireOwnerOrRoles((req) => req.eventOwner._id, "organizer", "admin"),
	deleteRSVPController
);
router.get("/:id/rsvps", requireAuth, getRSVPsController);

module.exports = router;
