/**
 * Shipment Status Transition Utilities
 * Handles status transitions and courier assignments
 */

const prisma = require("../prisma/prismaClient");
const {
  SHIPMENT_STATUSES,
  COURIER_TYPES,
  isValidTransition,
  canAssignCourierType,
} = require("./shipmentLifecycle");

// ======================================================
// STATUS TRANSITION HANDLERS
// ======================================================

/**
 * Transition shipment to new status
 * @param {number} shipmentId - Shipment ID
 * @param {string} newStatus - New status
 * @param {number} userId - User performing action
 * @returns {object} Updated shipment
 */
async function transitionShipmentStatus(shipmentId, newStatus, userId) {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: parseInt(shipmentId) },
    });

    if (!shipment) {
      throw new Error("Shipment not found");
    }

    // Validate transition
    if (!isValidTransition(shipment.shipmentStatus, newStatus)) {
      throw new Error(
        `Invalid status transition from "${shipment.shipmentStatus}" to "${newStatus}"`,
      );
    }

    const updatedShipment = await prisma.shipment.update({
      where: { id: parseInt(shipmentId) },
      data: {
        shipmentStatus: newStatus,
        lastModifiedBy: userId,
      },
      include: {
        courier: true,
        merchant: true,
        receiver: true,
        items: true,
      },
    });

    return {
      success: true,
      shipment: updatedShipment,
      message: `Shipment status updated to "${newStatus}"`,
    };
  } catch (error) {
    throw new Error(`Status transition failed: ${error.message}`);
  }
}

// ======================================================
// COURIER ASSIGNMENT HANDLERS
// ======================================================

/**
 * Assign courier to shipment based on shipment status
 * @param {number} shipmentId - Shipment ID
 * @param {number} courierId - Courier ID
 * @param {number} userId - User performing action
 * @returns {object} Updated shipment
 */
async function assignCourierToShipment(shipmentId, courierId, userId) {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: parseInt(shipmentId) },
    });

    if (!shipment) {
      throw new Error("Shipment not found");
    }

    const courier = await prisma.courier.findUnique({
      where: { id: parseInt(courierId) },
    });

    if (!courier) {
      throw new Error("Courier not found");
    }

    if (courier.isDeleted || !courier.isActive) {
      throw new Error("Courier is not active");
    }

    // Validate courier type can be assigned to this status
    if (!canAssignCourierType(courier.courierType, shipment.shipmentStatus)) {
      throw new Error(
        `Cannot assign ${courier.courierType} courier to shipment with status "${shipment.shipmentStatus}"`,
      );
    }

    const updatedShipment = await prisma.shipment.update({
      where: { id: parseInt(shipmentId) },
      data: {
        courierId: parseInt(courierId),
        lastModifiedBy: userId,
      },
      include: {
        courier: true,
        merchant: true,
        receiver: true,
      },
    });

    return {
      success: true,
      shipment: updatedShipment,
      message: `Courier "${courier.fullName}" assigned to shipment`,
    };
  } catch (error) {
    throw new Error(`Courier assignment failed: ${error.message}`);
  }
}

/**
 * Assign pickup courier to shipment
 * Shipment must be in "Pickup Requested" status
 * @param {number} shipmentId - Shipment ID
 * @param {number} courierId - Courier ID (must be PICKUP type)
 * @param {number} userId - User performing action
 * @returns {object} Updated shipment
 */
async function assignPickupCourier(shipmentId, courierId, userId) {
  try {
    const courier = await prisma.courier.findUnique({
      where: { id: parseInt(courierId) },
    });

    if (!courier) {
      throw new Error("Courier not found");
    }

    if (courier.courierType !== COURIER_TYPES.PICKUP) {
      throw new Error("Selected courier is not a pickup courier");
    }

    return await assignCourierToShipment(shipmentId, courierId, userId);
  } catch (error) {
    throw new Error(`Pickup courier assignment failed: ${error.message}`);
  }
}

/**
 * Assign delivery courier to shipment
 * Shipment must be in "Received at Warehouse" or "Partial Return" status
 * @param {number} shipmentId - Shipment ID
 * @param {number} courierId - Courier ID (must be DELIVERY type)
 * @param {number} userId - User performing action
 * @returns {object} Updated shipment with "Out for Delivery" status
 */
async function assignDeliveryCourier(shipmentId, courierId, userId) {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: parseInt(shipmentId) },
    });

    if (!shipment) {
      throw new Error("Shipment not found");
    }

    // Check if shipment is in valid status for delivery
    const validStatuses = [
      SHIPMENT_STATUSES.RECEIVED_AT_WAREHOUSE,
      SHIPMENT_STATUSES.PARTIAL_RETURN,
    ];

    if (!validStatuses.includes(shipment.shipmentStatus)) {
      throw new Error(
        `Shipment must be in "${SHIPMENT_STATUSES.RECEIVED_AT_WAREHOUSE}" or "${SHIPMENT_STATUSES.PARTIAL_RETURN}" status to assign delivery courier`,
      );
    }

    const courier = await prisma.courier.findUnique({
      where: { id: parseInt(courierId) },
    });

    if (!courier) {
      throw new Error("Courier not found");
    }

    if (courier.courierType !== COURIER_TYPES.DELIVERY) {
      throw new Error("Selected courier is not a delivery courier");
    }

    // Assign courier and update status to "Out for Delivery"
    const updatedShipment = await prisma.shipment.update({
      where: { id: parseInt(shipmentId) },
      data: {
        courierId: parseInt(courierId),
        shipmentStatus: SHIPMENT_STATUSES.OUT_FOR_DELIVERY,
        lastModifiedBy: userId,
      },
      include: {
        courier: true,
        merchant: true,
        receiver: true,
      },
    });

    return {
      success: true,
      shipment: updatedShipment,
      message: `Delivery courier "${courier.fullName}" assigned and shipment status updated to "Out for Delivery"`,
    };
  } catch (error) {
    throw new Error(`Delivery courier assignment failed: ${error.message}`);
  }
}

/**
 * Unassign courier from shipment (only for pickup phase)
 * @param {number} shipmentId - Shipment ID
 * @param {number} userId - User performing action
 * @returns {object} Updated shipment
 */
async function unassignCourier(shipmentId, userId) {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: parseInt(shipmentId) },
    });

    if (!shipment) {
      throw new Error("Shipment not found");
    }

    // Can only unassign during pickup phase
    if (shipment.shipmentStatus !== SHIPMENT_STATUSES.PICKUP_REQUESTED) {
      throw new Error(
        "Can only unassign courier from shipments in Pickup Requested status",
      );
    }

    const updatedShipment = await prisma.shipment.update({
      where: { id: parseInt(shipmentId) },
      data: {
        courierId: null,
        lastModifiedBy: userId,
      },
      include: {
        courier: true,
        merchant: true,
        receiver: true,
      },
    });

    return {
      success: true,
      shipment: updatedShipment,
      message: "Courier unassigned from shipment",
    };
  } catch (error) {
    throw new Error(`Courier unassignment failed: ${error.message}`);
  }
}

// ======================================================
// COMMON TRANSITIONS
// ======================================================

/**
 * Mark pickup as collected
 * Transition from "Pickup Requested" to "Pickup Collected"
 * @param {number} shipmentId - Shipment ID
 * @param {number} userId - User performing action
 * @returns {object} Updated shipment
 */
async function markPickupCollected(shipmentId, userId) {
  return transitionShipmentStatus(
    shipmentId,
    SHIPMENT_STATUSES.PICKUP_COLLECTED,
    userId,
  );
}

/**
 * Mark shipment as received at warehouse
 * Transition from "Pickup Collected" to "Received at Warehouse"
 * @param {number} shipmentId - Shipment ID
 * @param {number} userId - User performing action
 * @returns {object} Updated shipment
 */
async function markReceivedAtWarehouse(shipmentId, userId) {
  return transitionShipmentStatus(
    shipmentId,
    SHIPMENT_STATUSES.RECEIVED_AT_WAREHOUSE,
    userId,
  );
}

/**
 * Mark shipment for delivery (assigns to delivery courier)
 * @param {number} shipmentId - Shipment ID
 * @param {number} courierId - Delivery courier ID
 * @param {number} userId - User performing action
 * @returns {object} Updated shipment
 */
async function markForDelivery(shipmentId, courierId, userId) {
  return assignDeliveryCourier(shipmentId, courierId, userId);
}

/**
 * Cancel shipment
 * Can be cancelled from various statuses
 * @param {number} shipmentId - Shipment ID
 * @param {string} cancellationReason - Reason for cancellation
 * @param {number} userId - User performing action
 * @returns {object} Updated shipment
 */
async function cancelShipment(shipmentId, cancellationReason, userId) {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: parseInt(shipmentId) },
    });

    if (!shipment) {
      throw new Error("Shipment not found");
    }

    // Can cancel from various statuses, but not terminal ones
    const terminalStatuses = [
      SHIPMENT_STATUSES.DELIVERED_SUCCESSFULLY,
      SHIPMENT_STATUSES.RETURNED_TO_WAREHOUSE,
      SHIPMENT_STATUSES.CANCELLED,
      SHIPMENT_STATUSES.REJECTED_WITHOUT_PAYMENT,
    ];

    if (terminalStatuses.includes(shipment.shipmentStatus)) {
      throw new Error(
        `Cannot cancel shipment with status: ${shipment.shipmentStatus}`,
      );
    }

    const updatedShipment = await prisma.shipment.update({
      where: { id: parseInt(shipmentId) },
      data: {
        shipmentStatus: SHIPMENT_STATUSES.CANCELLED,
        additionalNotes: cancellationReason,
        lastModifiedBy: userId,
      },
      include: {
        courier: true,
        merchant: true,
        receiver: true,
      },
    });

    return {
      success: true,
      shipment: updatedShipment,
      message: "Shipment cancelled",
    };
  } catch (error) {
    throw new Error(`Cancellation failed: ${error.message}`);
  }
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  // Core functions
  transitionShipmentStatus,
  assignCourierToShipment,
  assignPickupCourier,
  assignDeliveryCourier,
  unassignCourier,

  // Common transitions
  markPickupCollected,
  markReceivedAtWarehouse,
  markForDelivery,
  cancelShipment,
};
