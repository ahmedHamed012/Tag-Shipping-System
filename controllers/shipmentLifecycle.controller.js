/**
 * Shipment Lifecycle Controller
 * Handles all shipment workflow operations
 */

const prisma = require("../prisma/prismaClient");
const {
  SHIPMENT_STATUSES,
  COURIER_TYPES,
  validateDeliveryOutcome,
} = require("../utils/shipmentLifecycle");
const {
  transitionShipmentStatus,
  assignPickupCourier,
  assignDeliveryCourier,
  markPickupCollected,
  markReceivedAtWarehouse,
  markForDelivery,
  cancelShipment,
} = require("../utils/shipmentTransitions");
const { processDeliveryOutcome } = require("../utils/deliveryOutcomeHandlers");

// ======================================================
// SHIPMENT STATUS TRANSITIONS
// ======================================================

/**
 * Transition shipment to new status
 * POST /shipments/api/transition-status/:id
 */
exports.transitionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { newStatus } = req.body;
    const userId = req.user?.id;

    if (!newStatus) {
      return res.status(400).json({
        success: false,
        error: "الحالة الجديدة مطلوبة",
      });
    }

    const result = await transitionShipmentStatus(id, newStatus, userId);

    res.json(result);
  } catch (error) {
    console.error("Error transitioning shipment status:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ======================================================
// COURIER ASSIGNMENT
// ======================================================

/**
 * Assign pickup courier to shipment
 * POST /shipments/api/assign-pickup-courier/:id
 */
exports.assignPickupCourierHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { courierId } = req.body;
    const userId = req.user?.id;

    if (!courierId) {
      return res.status(400).json({
        success: false,
        error: "معرف المندوب مطلوب",
      });
    }

    const result = await assignPickupCourier(id, courierId, userId);
    res.json(result);
  } catch (error) {
    console.error("Error assigning pickup courier:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Assign delivery courier to shipment
 * POST /shipments/api/assign-delivery-courier/:id
 */
exports.assignDeliveryCourierHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { courierId } = req.body;
    const userId = req.user?.id;

    if (!courierId) {
      return res.status(400).json({
        success: false,
        error: "معرف المندوب مطلوب",
      });
    }

    const result = await assignDeliveryCourier(id, courierId, userId);
    res.json(result);
  } catch (error) {
    console.error("Error assigning delivery courier:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ======================================================
// PICKUP PHASE WORKFLOWS
// ======================================================

/**
 * Mark shipment pickup as collected
 * POST /shipments/api/pickup-collected/:id
 */
exports.markPickupCollectedHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const result = await markPickupCollected(id, userId);
    res.json(result);
  } catch (error) {
    console.error("Error marking pickup collected:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Mark shipment as received at warehouse
 * POST /shipments/api/received-at-warehouse/:id
 */
exports.markReceivedAtWarehouseHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const result = await markReceivedAtWarehouse(id, userId);
    res.json(result);
  } catch (error) {
    console.error("Error marking received at warehouse:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ======================================================
// DELIVERY PHASE WORKFLOWS
// ======================================================

/**
 * Process delivery outcome (partial, exchange, returned, etc.)
 * POST /shipments/api/delivery-outcome/:id
 */
exports.processDeliveryOutcomeHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { outcome, data } = req.body;
    const userId = req.user?.id;

    if (!outcome) {
      return res.status(400).json({
        success: false,
        error: "نوع الحصيلة مطلوب",
      });
    }

    // Validate outcome data
    const validation = validateDeliveryOutcome(outcome, data || {});
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    const result = await processDeliveryOutcome(
      id,
      outcome,
      data || {},
      userId,
    );

    res.json(result);
  } catch (error) {
    console.error("Error processing delivery outcome:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Mark successful delivery
 * POST /shipments/api/delivered/:id
 */
exports.markDeliveredHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const result = await processDeliveryOutcome(
      id,
      SHIPMENT_STATUSES.DELIVERED_SUCCESSFULLY,
      {},
      userId,
    );

    res.json(result);
  } catch (error) {
    console.error("Error marking delivered:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Process partial delivery
 * POST /shipments/api/partial-delivery/:id
 */
exports.partialDeliveryHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { collectedAmount, partialDeliveryReason } = req.body;
    const userId = req.user?.id;

    if (!collectedAmount) {
      return res.status(400).json({
        success: false,
        error: "المبلغ المحصل مطلوب",
      });
    }

    const result = await processDeliveryOutcome(
      id,
      SHIPMENT_STATUSES.PARTIAL_DELIVERY,
      {
        collectedAmount,
        partialDeliveryReason,
      },
      userId,
    );

    res.json(result);
  } catch (error) {
    console.error("Error processing partial delivery:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Process exchange
 * POST /shipments/api/exchange/:id
 */
exports.exchangeHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const result = await processDeliveryOutcome(
      id,
      SHIPMENT_STATUSES.EXCHANGE,
      {},
      userId,
    );

    res.json(result);
  } catch (error) {
    console.error("Error processing exchange:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Process return with shipping fees paid
 * POST /shipments/api/return-with-fees/:id
 */
exports.returnWithFeesHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { shippingFeesCollected, returnReason } = req.body;
    const userId = req.user?.id;

    if (!shippingFeesCollected) {
      return res.status(400).json({
        success: false,
        error: "مبلغ رسوم الشحن مطلوب",
      });
    }

    const result = await processDeliveryOutcome(
      id,
      SHIPMENT_STATUSES.RETURNED_WITH_FEES_PAID,
      {
        shippingFeesCollected,
        returnReason,
      },
      userId,
    );

    res.json(result);
  } catch (error) {
    console.error("Error processing return with fees:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Process rejection without payment
 * POST /shipments/api/rejected/:id
 */
exports.rejectedHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { returnReason } = req.body;
    const userId = req.user?.id;

    const result = await processDeliveryOutcome(
      id,
      SHIPMENT_STATUSES.REJECTED_WITHOUT_PAYMENT,
      {
        returnReason,
      },
      userId,
    );

    res.json(result);
  } catch (error) {
    console.error("Error processing rejection:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ======================================================
// CANCELLATION
// ======================================================

/**
 * Cancel shipment
 * POST /shipments/api/cancel/:id
 */
exports.cancelShipmentHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellationReason } = req.body;
    const userId = req.user?.id;

    const result = await cancelShipment(
      id,
      cancellationReason || "ملغى",
      userId,
    );

    res.json(result);
  } catch (error) {
    console.error("Error cancelling shipment:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ======================================================
// SHIPMENT DETAILS & QUERIES
// ======================================================

/**
 * Get shipment details with lifecycle information
 * GET /shipments/api/lifecycle/:id
 */
exports.getShipmentLifecycleDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const shipment = await prisma.shipment.findUnique({
      where: { id: parseInt(id) },
      include: {
        courier: {
          select: {
            id: true,
            fullName: true,
            courierType: true,
            phone: true,
          },
        },
        merchant: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        receiver: {
          select: {
            id: true,
            fullName: true,
            phone1: true,
            governorate: true,
            city: true,
          },
        },
        items: true,
        parentShipment: {
          select: {
            id: true,
            policyNumber: true,
            shipmentStatus: true,
          },
        },
        childShipments: {
          select: {
            id: true,
            policyNumber: true,
            shipmentStatus: true,
            shipmentType: true,
            totalAmount: true,
          },
        },
        creator: {
          select: {
            id: true,
            fullName: true,
          },
        },
        lastModifier: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (!shipment) {
      return res.status(404).json({
        success: false,
        error: "الشحنة غير موجودة",
      });
    }

    res.json({
      success: true,
      data: shipment,
    });
  } catch (error) {
    console.error("Error fetching shipment lifecycle details:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get shipments by status
 * GET /shipments/api/by-status
 */
exports.getShipmentsByStatus = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "الحالة مطلوبة",
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where: {
          shipmentStatus: status,
          isDeleted: false,
        },
        include: {
          courier: true,
          merchant: true,
          receiver: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.shipment.count({
        where: {
          shipmentStatus: status,
          isDeleted: false,
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        shipments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalShipments: total,
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching shipments by status:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get child shipments (partial/exchange)
 * GET /shipments/api/children/:parentId
 */
exports.getChildShipments = async (req, res) => {
  try {
    const { parentId } = req.params;

    const childShipments = await prisma.shipment.findMany({
      where: {
        parentShipmentId: parseInt(parentId),
        isDeleted: false,
      },
      include: {
        courier: true,
        receiver: true,
        items: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (childShipments.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: "لا توجد شحنات فرعية",
      });
    }

    res.json({
      success: true,
      data: childShipments,
    });
  } catch (error) {
    console.error("Error fetching child shipments:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  // Status transitions
  transitionStatus,

  // Courier assignment
  assignPickupCourierHandler,
  assignDeliveryCourierHandler,

  // Pickup phase
  markPickupCollectedHandler,
  markReceivedAtWarehouseHandler,

  // Delivery phase
  processDeliveryOutcomeHandler,
  markDeliveredHandler,
  partialDeliveryHandler,
  exchangeHandler,
  returnWithFeesHandler,
  rejectedHandler,

  // Cancellation
  cancelShipmentHandler,

  // Queries
  getShipmentLifecycleDetails,
  getShipmentsByStatus,
  getChildShipments,
};
