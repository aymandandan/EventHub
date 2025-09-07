
const router = require("express").Router();
const apiResponse = require("../utils/apiResponse");

// health route
router.get("/health", (req, res) => {
    apiResponse.success(res, { message: "OK" });
});

// auth routes
router.use("/auth", require("./authRoutes"));

module.exports = router;
