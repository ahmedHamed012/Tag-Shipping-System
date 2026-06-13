/**
 * Shipment Lifecycle Routes
 * API endpoints for shipment workflow operations
 */

const express = require("express");
const router = express.Router();
const shipmentLifecycleController = require("../controllers/shipmentLifecycle.controller");

// ======================================================
// MIDDLEWARE (Optional - Add Auth if needed)
// ======================================================

// You can add auth middleware here if required
// const { authenticate } = require("../middleware/auth.middleware");

// ======================================================
// STATUS TRANSITIONS
// ======================================================

/**
 * Transition shipment to new status
 * POST /shipments/lifecycle/transition-status/:id
 */
router.post(
  "/transition-status/:id",
  shipmentLifecycleController.transitionStatus,
);

// ======================================================
// COURIER ASSIGNMENT
// ======================================================

/**
 * Assign pickup courier to shipment
 * POST /shipments/lifecycle/assign-pickup-courier/:id
 */
router.post(
  "/assign-pickup-courier/:id",
  shipmentLifecycleController.assignPickupCourierHandler,
);

/**
 * Assign delivery courier to shipment (marks as Out for Delivery)
 * POST /shipments/lifecycle/assign-delivery-courier/:id
 */
router.post(
  "/assign-delivery-courier/:id",
  shipmentLifecycleController.assignDeliveryCourierHandler,
);

// ======================================================
// PICKUP PHASE WORKFLOWS
// ======================================================

/**
 * Mark shipment pickup as collected
 * POST /shipments/lifecycle/pickup-collected/:id
 */
router.post(
  "/pickup-collected/:id",
  shipmentLifecycleController.markPickupCollectedHandler,
);

/**
 * Mark shipment as received at warehouse
 * POST /shipments/lifecycle/received-at-warehouse/:id
 */
router.post(
  "/received-at-warehouse/:id",
  shipmentLifecycleController.markReceivedAtWarehouseHandler,
);

// ======================================================
// DELIVERY PHASE WORKFLOWS
// ======================================================

/**
 * Process generic delivery outcome
 * POST /shipments/lifecycle/delivery-outcome/:id
 * Body: { outcome: "status", data: {...} }
 */
router.post(
  "/delivery-outcome/:id",
  shipmentLifecycleController.processDeliveryOutcomeHandler,
);

/**
 * Mark successful delivery
 * POST /shipments/lifecycle/delivered/:id
 */
router.post("/delivered/:id", shipmentLifecycleController.markDeliveredHandler);

/**
 * Process partial delivery
 * POST /shipments/lifecycle/partial-delivery/:id
 * Body: { collectedAmount: number, partialDeliveryReason?: string }
 */
router.post(
  "/partial-delivery/:id",
  shipmentLifecycleController.partialDeliveryHandler,
);

/**
 * Process exchange
 * POST /shipments/lifecycle/exchange/:id
 */
router.post("/exchange/:id", shipmentLifecycleController.exchangeHandler);

/**
 * Process return with shipping fees paid
 * POST /shipments/lifecycle/return-with-fees/:id
 * Body: { shippingFeesCollected: number, returnReason?: string }
 */
router.post(
  "/return-with-fees/:id",
  shipmentLifecycleController.returnWithFeesHandler,
);

/**
 * Process rejection without payment
 * POST /shipments/lifecycle/rejected/:id
 * Body: { returnReason?: string }
 */
router.post("/rejected/:id", shipmentLifecycleController.rejectedHandler);

// ======================================================
// CANCELLATION
// ======================================================

/**
 * Cancel shipment
 * POST /shipments/lifecycle/cancel/:id
 * Body: { cancellationReason?: string }
 */
router.post("/cancel/:id", shipmentLifecycleController.cancelShipmentHandler);

// ======================================================
// QUERIES & DETAILS
// ======================================================

/**
 * Get shipment details with full lifecycle information
 * GET /shipments/lifecycle/:id
 */
router.get("/:id", shipmentLifecycleController.getShipmentLifecycleDetails);

/**
 * Get shipments by status
 * GET /shipments/lifecycle/status/:status
 */
router.get("/status/:status", shipmentLifecycleController.getShipmentsByStatus);

/**
 * Get child shipments (partial/exchange)
 * GET /shipments/lifecycle/children/:parentId
 */
router.get(
  "/children/:parentId",
  shipmentLifecycleController.getChildShipments,
);

// ======================================================
// EXPORTS
// ======================================================

module.exports = router;
