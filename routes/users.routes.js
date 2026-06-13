const express = require("express");
const multer = require("multer");
const path = require("path");
const usersController = require("../controllers/users.controller");
const { generateUserTemplate } = require("../utils/excelUtils");

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../public/uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("يجب رفع ملفات صور فقط"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 3, // Maximum 3 files
  },
});

// ─────── PAGE ROUTES ───────

// Get all users (render page)
router.get("/", usersController.getAllUsers);

// ─────── API ROUTES ───────

// Create user with file uploads
router.post(
  "/api/create",
  upload.fields([
    { name: "idCardFront", maxCount: 1 },
    { name: "idCardBack", maxCount: 1 },
    { name: "profilePicture", maxCount: 1 },
  ]),
  usersController.createUser,
);

// Update user with file uploads
router.post(
  "/api/update/:id",
  upload.fields([
    { name: "idCardFront", maxCount: 1 },
    { name: "idCardBack", maxCount: 1 },
    { name: "profilePicture", maxCount: 1 },
  ]),
  usersController.updateUser,
);

// Get single user
router.get("/api/get/:id", usersController.getUser);

// Toggle user status
router.post("/api/toggle-status/:id", usersController.toggleUserStatus);

// Delete user
router.delete("/api/delete/:id", usersController.deleteUser);

// Bulk upload users from Excel
router.post(
  "/api/bulk-upload",
  upload.single("file"),
  usersController.bulkUploadUsers,
);

// Download Excel template
router.get("/api/download-template", (req, res) => {
  try {
    const template = generateUserTemplate();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="template-users.xlsx"',
    );
    res.end(template);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
