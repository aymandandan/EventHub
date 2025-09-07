const express = require("express");
const router = express.Router();

const { registerController, loginController, refreshController, logoutController } = require("../controllers/AuthController");

// auth routes
router.post("/register", registerController);
router.post("/login", loginController);
router.post("/refresh", refreshController);
router.post("/logout", logoutController);

module.exports = router;
