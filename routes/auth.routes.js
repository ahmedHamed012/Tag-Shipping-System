const express = require("express");
const authController = require("../controllers/auth.controller");
const { requireAuth, requireGuest } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/login", requireGuest, authController.renderLogin);
router.post("/login", requireGuest, authController.login);

router.get("/reset-password", requireAuth, authController.renderResetPassword);
router.post("/reset-password", requireAuth, authController.resetPassword);

router.post("/signout", requireAuth, authController.signout);

module.exports = router;
