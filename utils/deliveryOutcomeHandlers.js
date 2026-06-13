/**
 * Delivery Outcome Handlers
 * Handles all delivery workflow outcomes and their business logic
 */

const prisma = require("../prisma/prismaClient");
const {
  SHIPMENT_STATUSES,
  SHIPMENT_TYPES,
  prepareChildShipmentData,
  calculateCourierSettlement,
  calculateMerchantBalanceChange,
} = require("./shipmentLifecycle");

// ======================================================
// PARTIAL DELIVERY HANDLER
// ======================================================

/**
 * Handle partial delivery outcome
 * 1. Add collected amount to courier settlement
 * 2. Create new shipment with remaining balance
 * 3. Update original shipment status
 * @param {object} shipment - Original shipment
 * @param {number} collectedAmount - Amount collected from customer
 * @param {string} partialDeliveryReason - Optional reason
 * @param {number} userId - User performing the action
 * @returns {object} Updated shipment and new child shipment
 */
async function handlePartialDelivery(
  shipment,
  collectedAmount,
  partialDeliveryReason,
  userId,
) {
  try {
    // Validate collected amount
    if (collectedAmount <= 0 || collectedAmount >= shipment.totalAmount) {
      throw new Error("Invalid collected amount for partial delivery");
    }

    // Update original shipment
    const updatedShipment = await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        shipmentStatus: SHIPMENT_STATUSES.PARTIAL_DELIVERY,
        deliveryCollectedAmount: collectedAmount,
        lastModifiedBy: userId,
      },
      include: {
        items: true,
        receiver: true,
        merchant: true,
      },
    });

    // Create child shipment for remaining amount
    const childData = prepareChildShipmentData(
      shipment,
      SHIPMENT_STATUSES.PARTIAL_DELIVERY,
      {
        collectedAmount,
        partialDeliveryReason,
      },
    );

    const childShipment = await prisma.shipment.create({
      data: {
        ...childData,
        createdBy: userId,
        lastModifiedBy: userId,
      },
      include: {
        receiver: true,
        merchant: true,
      },
    });

    return {
      success: true,
      originalShipment: updatedShipment,
      childShipment: childShipment,
      settlementAmount: parseFloat(collectedAmount),
      message: `Partial delivery processed. Remaining amount: ${childShipment.totalAmount}`,
    };
  } catch (error) {
    throw new Error(`Partial delivery processing failed: ${error.message}`);
  }
}

// ======================================================
// EXCHANGE HANDLER
// ======================================================

/**
 * Handle exchange outcome
 * 1. Mark original shipment as delivered successfully
 * 2. Create new exchange shipment with 0 amount
 * 3. New shipment is at warehouse ready for return
 * @param {object} shipment - Original shipment
 * @param {number} userId - User performing the action
 * @returns {object} Updated shipment and exchange shipment
 */
async function handleExchange(shipment, userId) {
  try {
    // Update original shipment as delivered
    const updatedShipment = await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        shipmentStatus: SHIPMENT_STATUSES.EXCHANGE,
        deliveryCollectedAmount: 0,
        lastModifiedBy: userId,
      },
      include: {
        items: true,
        receiver: true,
        merchant: true,
      },
    });

    // Create exchange shipment
    const exchangeData = prepareChildShipmentData(
      shipment,
      SHIPMENT_STATUSES.EXCHANGE,
      {},
    );

    const exchangeShipment = await prisma.shipment.create({
      data: {
        ...exchangeData,
        createdBy: userId,
        lastModifiedBy: userId,
      },
      include: {
        receiver: true,
        merchant: true,
      },
    });

    return {
      success: true,
      originalShipment: updatedShipment,
      exchangeShipment: exchangeShipment,
      settlementAmount: parseFloat(shipment.totalAmount),
      message: "Exchange processed. New shipment created for replacement.",
    };
  } catch (error) {
    throw new Error(`Exchange processing failed: ${error.message}`);
  }
}

// ======================================================
// RETURNED WITH FEES PAID HANDLER
// ======================================================

/**
 * Handle return with shipping fees paid
 * 1. Customer refuses shipment but pays shipping fees
 * 2. Add shipping fees to courier settlement
 * 3. Mark shipment as returned to warehouse
 * @param {object} shipment - Original shipment
 * @param {number} shippingFeesCollected - Shipping fees collected
 * @param {string} returnReason - Reason for return
 * @param {number} userId - User performing the action
 * @returns {object} Updated shipment
 */
async function handleReturnWithFeesPaid(
  shipment,
  shippingFeesCollected,
  returnReason,
  userId,
) {
  try {
    if (shippingFeesCollected <= 0) {
      throw new Error("Shipping fees must be greater than 0");
    }

    // Update shipment
    const updatedShipment = await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        shipmentStatus: SHIPMENT_STATUSES.RETURNED_WITH_FEES_PAID,
        deliveryCollectedAmount: shippingFeesCollected,
        returnReason: returnReason,
        lastModifiedBy: userId,
      },
      include: {
        items: true,
        receiver: true,
        merchant: true,
      },
    });

    return {
      success: true,
      shipment: updatedShipment,
      settlementAmount: parseFloat(shippingFeesCollected),
      message: `Return with fees processed. Shipping fees: ${shippingFeesCollected}`,
    };
  } catch (error) {
    throw new Error(`Return with fees processing failed: ${error.message}`);
  }
}

// ======================================================
// REJECTED WITHOUT PAYMENT HANDLER
// ======================================================

/**
 * Handle rejection without payment
 * 1. Customer refuses shipment and does not pay
 * 2. Shipment value is deducted from merchant balance
 * 3. Mark shipment as rejected
 * @param {object} shipment - Original shipment
 * @param {string} returnReason - Reason for rejection
 * @param {number} userId - User performing the action
 * @returns {object} Updated shipment
 */
async function handleRejectedWithoutPayment(shipment, returnReason, userId) {
  try {
    // Update shipment
    const updatedShipment = await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        shipmentStatus: SHIPMENT_STATUSES.REJECTED_WITHOUT_PAYMENT,
        deliveryCollectedAmount: 0,
        returnReason: returnReason,
        lastModifiedBy: userId,
      },
      include: {
        items: true,
        receiver: true,
        merchant: true,
      },
    });

    return {
      success: true,
      shipment: updatedShipment,
      deductedAmount: parseFloat(shipment.totalAmount),
      message: `Rejection processed. Amount deducted from merchant balance: ${shipment.totalAmount}`,
    };
  } catch (error) {
    throw new Error(`Rejection processing failed: ${error.message}`);
  }
}

// ======================================================
// SUCCESSFUL DELIVERY HANDLER
// ======================================================

/**
 * Handle successful delivery
 * 1. Full amount is collected
 * 2. Add to courier settlement
 * 3. Mark as delivered
 * @param {object} shipment - Original shipment
 * @param {number} userId - User performing the action
 * @returns {object} Updated shipment
 */
async function handleSuccessfulDelivery(shipment, userId) {
  try {
    const updatedShipment = await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        shipmentStatus: SHIPMENT_STATUSES.DELIVERED_SUCCESSFULLY,
        deliveryCollectedAmount: shipment.totalAmount,
        lastModifiedBy: userId,
      },
      include: {
        items: true,
        receiver: true,
        merchant: true,
      },
    });

    return {
      success: true,
      shipment: updatedShipment,
      settlementAmount: parseFloat(shipment.totalAmount),
      message: "Shipment delivered successfully.",
    };
  } catch (error) {
    throw new Error(`Delivery processing failed: ${error.message}`);
  }
}

// ======================================================
// PROCESS DELIVERY OUTCOME - MAIN HANDLER
// ======================================================

/**
 * Main handler for all delivery outcomes
 * Routes to appropriate handler based on outcome type
 * @param {number} shipmentId - Shipment ID
 * @param {string} outcome - Delivery outcome type
 * @param {object} data - Outcome-specific data
 * @param {number} userId - User performing the action
 * @returns {object} Result with updated shipment(s)
 */
async function processDeliveryOutcome(shipmentId, outcome, data, userId) {
  try {
    // Fetch shipment
    const shipment = await prisma.shipment.findUnique({
      where: { id: parseInt(shipmentId) },
    });

    if (!shipment) {
      throw new Error("Shipment not found");
    }

    // Check if shipment is ready for delivery outcome
    if (shipment.shipmentStatus !== SHIPMENT_STATUSES.OUT_FOR_DELIVERY) {
      throw new Error(
        `Shipment must be "Out for Delivery" to process outcomes. Current status: ${shipment.shipmentStatus}`,
      );
    }

    // Route to appropriate handler
    switch (outcome) {
      case SHIPMENT_STATUSES.DELIVERED_SUCCESSFULLY:
        return await handleSuccessfulDelivery(shipment, userId);

      case SHIPMENT_STATUSES.PARTIAL_DELIVERY:
        return await handlePartialDelivery(
          shipment,
          parseFloat(data.collectedAmount),
          data.partialDeliveryReason,
          userId,
        );

      case SHIPMENT_STATUSES.EXCHANGE:
        return await handleExchange(shipment, userId);

      case SHIPMENT_STATUSES.RETURNED_WITH_FEES_PAID:
        return await handleReturnWithFeesPaid(
          shipment,
          parseFloat(data.shippingFeesCollected),
          data.returnReason,
          userId,
        );

      case SHIPMENT_STATUSES.REJECTED_WITHOUT_PAYMENT:
        return await handleRejectedWithoutPayment(
          shipment,
          data.returnReason,
          userId,
        );

      default:
        throw new Error(`Unknown delivery outcome: ${outcome}`);
    }
  } catch (error) {
    throw new Error(`Delivery outcome processing failed: ${error.message}`);
  }
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  handlePartialDelivery,
  handleExchange,
  handleReturnWithFeesPaid,
  handleRejectedWithoutPayment,
  handleSuccessfulDelivery,
  processDeliveryOutcome,
};
