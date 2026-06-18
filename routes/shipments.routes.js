const express = require("express");
const router = express.Router();
const shipmentsController = require("../controllers/shipments.controller");

/**
 * GET /shipments - Get all shipments (paginated)
 */
router.get("/", shipmentsController.getAllShipments);

/**
 * GET /shipments/create - Show create shipment form
 */
router.get("/create", shipmentsController.createShipmentForm);

/**
 * GET /shipments/api/search-receiver - Search receiver by phone
 */
router.get("/api/search-receiver", shipmentsController.searchReceiver);

/**
 * POST /shipments/api/calculate-quote - Calculate shipment quote
 */
router.post("/api/calculate-quote", shipmentsController.calculateQuote);

/**
 * POST /shipments/api/create - Create new shipment
 */
router.post("/api/create", shipmentsController.createShipment);

/**
 * GET /shipments/api/get/:id - Get single shipment
 */
router.get("/api/get/:id", shipmentsController.getShipment);

/**
 * POST /shipments/api/update-status/:id - Update shipment status
 */
router.post("/api/update-status/:id", shipmentsController.updateShipmentStatus);

/**
 * DELETE /shipments/api/delete/:id - Delete shipment
 */
router.delete("/api/delete/:id", shipmentsController.deleteShipment);

/**
 * GET /shipments/api/barcode - Get shipment by barcode
 */
router.get("/api/barcode", shipmentsController.getShipmentByBarcode);

/**
 * POST /shipments/api/bulk-update-status - Bulk update shipment status
 */
router.post("/api/bulk-update-status", shipmentsController.bulkUpdateStatus);

/**
 * GET /shipments/api/price-list - Get price list
 */
router.get("/api/price-list", shipmentsController.getPriceList);

/**
 * PATCH /shipments/api/update-total/:id - Manually override total amount
 */
router.patch("/api/update-total/:id", shipmentsController.updateTotalAmount);

module.exports = router;
