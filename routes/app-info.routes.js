// routes/appInfo.routes.js
const express = require("express");
const router = express.Router();
const appInfoController = require("../controllers/app-info.controller");

// TODO: plug in your existing admin-auth middleware here, e.g.:
// const { requireAdmin } = require("../middlewares/auth.middleware");
// router.use(requireAdmin);
//
// This page can trigger arbitrary code replacement + shell commands,
// so it should be restricted to admin users only.

router.get("/", appInfoController.getAppInfoPage);
router.get("/check-update", appInfoController.checkForUpdate);
router.post("/apply-update", appInfoController.applyUpdate);
router.get("/health", appInfoController.health); // used by the page to detect the app is back up after restart

module.exports = router;
