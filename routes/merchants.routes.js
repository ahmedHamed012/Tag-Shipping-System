const express = require("express");
const multer = require("multer");
const path = require("path");
const merchantsController = require("../controllers/merchants.controller");
const { generateMerchantTemplate } = require("../utils/excelUtils");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../public/uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 15,
  },
});

router.get("/", merchantsController.getAllMerchants);
router.get("/create", merchantsController.getCreateMerchantPage);
router.get("/:id/dashboard", merchantsController.getMerchantDashboard);

router.post("/api/create", upload.array("attachments", 10), merchantsController.createMerchant);
router.get("/api/get/:id", merchantsController.getMerchant);
router.post("/api/update/:id", upload.array("attachments", 10), merchantsController.updateMerchant);
router.post("/api/toggle-status/:id", merchantsController.toggleMerchantStatus);
router.delete("/api/delete/:id", merchantsController.deleteMerchant);
router.post("/api/update-pricelist/:id", merchantsController.updateMerchantPriceList);
router.post("/api/bulk-upload", upload.single("file"), merchantsController.bulkUploadMerchants);
router.get("/api/download-template", (req, res) => {
  try {
    const template = generateMerchantTemplate();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="template-merchants.xlsx"',
    );
    res.end(template);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
