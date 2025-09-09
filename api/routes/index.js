
const router = require("express").Router();
const apiResponse = require("../utils/apiResponse");

// health route
router.get("/health", (req, res) => {
    apiResponse.success(res, { message: "OK" });
});

// auth routes
router.use("/auth", require("./authRoutes"));

// user routes
router.use("/users", require("./userRoutes"));

// event and rsvp routes
router.use("/events", require("./eventRoutes"), require("./rsvpRoutes"));

// other routes outside of api (not found)
router.use((req, res) => {
    apiResponse.notFound(res, "Invalid route");
});

module.exports = router;
