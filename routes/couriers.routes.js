const express = require("express");
const multer = require("multer");
const path = require("path");
const couriersController = require("../controllers/couriers.controller");
const { generateCourierTemplate } = require("../utils/excelUtils");
const prisma = require("../prisma/prismaClient");

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
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/jpg"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Main page
router.get("/", couriersController.getAllCouriers);

// API endpoint for list with pagination (AJAX)
router.get("/api/list", async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    const where = {
      isDeleted: false,
      OR: [
        { fullName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ],
    };

    const [couriers, total] = await Promise.all([
      prisma.courier.findMany({
        where,
        include: {
          _count: {
            select: { shipments: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.courier.count({ where }),
    ]);

    res.json({
      success: true,
      data: couriers,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching couriers:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create page
router.get("/create", (req, res) => {
  res.render("couriers/create");
});

// Assign shipments page
router.get("/assign-shipments", (req, res) => {
  res.render("couriers/assign-shipments");
});

// Settlement page
router.get("/settlement", (req, res) => {
  res.render("couriers/settlement");
});

// API endpoints for CRUD
router.post(
  "/api/create",
  upload.fields([
    { name: "idCardFront", maxCount: 1 },
    { name: "idCardBack", maxCount: 1 },
    { name: "drivingLicenseFront", maxCount: 1 },
    { name: "drivingLicenseBack", maxCount: 1 },
  ]),
  couriersController.createCourier
);

router.get("/api/get/:id", couriersController.getCourier);

router.post(
  "/api/update/:id",
  upload.fields([
    { name: "idCardFront", maxCount: 1 },
    { name: "idCardBack", maxCount: 1 },
    { name: "drivingLicenseFront", maxCount: 1 },
    { name: "drivingLicenseBack", maxCount: 1 },
  ]),
  couriersController.updateCourier
);

router.post("/api/toggle-status/:id", couriersController.toggleCourierStatus);

router.delete("/api/delete/:id", couriersController.deleteCourier);

// Dropdown API
router.get("/api/dropdown", couriersController.getCouriersForDropdown);

// Bulk upload
router.post(
  "/api/bulk-upload",
  upload.single("file"),
  couriersController.bulkUploadCouriers
);

// Download template
router.get("/api/download-template", (req, res) => {
  try {
    const template = generateCourierTemplate();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="template-couriers.xlsx"'
    );
    res.end(template);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Shipment assignment
router.post("/api/assign-shipment", couriersController.assignShipmentToCourier);

// Get shipments for courier
router.get("/api/current-shipments/:courierId", couriersController.getCurrentShipments);
router.get("/api/previous-shipments/:courierId", couriersController.getPreviousShipments);

// Delivery sheet
router.get("/delivery-sheet/:courierId", couriersController.generateDeliverySheet);
router.get("/api/delivery-sheet/:courierId", couriersController.generateDeliverySheet);

// Settlement
router.get("/api/settlement/:courierId",         couriersController.getCourierSettlement);
router.post("/api/settlement/:courierId/save",   couriersController.saveSettlement);
router.get("/api/settlement/:courierId/history", couriersController.getSettlementHistory);

module.exports = router;
