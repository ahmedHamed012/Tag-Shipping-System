const express = require("express");
const multer = require("multer");
const path = require("path");
const countriesController = require("../controllers/countries.controller");
const { generateCountriesTemplate } = require("../utils/excelUtils");

const router = express.Router();

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

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

// Main page
router.get("/", countriesController.getAllGovernorates);

// API endpoints for governorates
router.post("/api/create-governorate", countriesController.createGovernorate);
router.post(
  "/api/update-governorate/:id",
  countriesController.updateGovernorate,
);
router.delete(
  "/api/delete-governorate/:id",
  countriesController.deleteGovernorate,
);

// API endpoints for cities
router.post("/api/create-city", countriesController.createCity);
router.post("/api/update-city/:id", countriesController.updateCity);
router.delete("/api/delete-city/:id", countriesController.deleteCity);

// Get cities by governorate
router.get(
  "/api/cities/:governorateId",
  countriesController.getCitiesByGovernorate,
);

// Dropdown API
router.get(
  "/api/governorates-dropdown",
  countriesController.getAllGovernoratesForDropdown,
);

// Bulk upload
router.post(
  "/api/bulk-upload",
  upload.single("file"),
  countriesController.bulkUploadCountries,
);

// Download template
router.get("/api/download-template", (req, res) => {
  try {
    const template = generateCountriesTemplate();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="template-countries.xlsx"',
    );
    res.end(template);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
