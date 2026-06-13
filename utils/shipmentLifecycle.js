/**
 * Shipment Lifecycle Utilities
 * Handles all shipment status transitions and workflow logic
 */

// ======================================================
// SHIPMENT STATUSES
// ======================================================

const SHIPMENT_STATUSES = {
  // Pickup & Warehouse Phase
  PICKUP_REQUESTED: "Pickup Requested",
  PICKUP_COLLECTED: "Pickup Collected",
  RECEIVED_AT_WAREHOUSE: "Received at Warehouse",

  // Delivery Phase
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED_SUCCESSFULLY: "Delivered Successfully",
  PARTIAL_DELIVERY: "Partial Delivery",
  EXCHANGE: "Exchange",
  RETURNED_WITH_FEES_PAID: "Returned with Shipping Fees Paid",
  REJECTED_WITHOUT_PAYMENT: "Rejected Without Payment",
  CANCELLED: "Cancelled",

  // Return States
  PARTIAL_RETURN: "Partial Return",
  RETURNED_TO_WAREHOUSE: "Returned to Warehouse",
};

// ======================================================
// SHIPMENT TYPES
// ======================================================

const SHIPMENT_TYPES = {
  NORMAL: "normal",
  PARTIAL_RETURN: "partial_return",
  EXCHANGE: "exchange",
};

// ======================================================
// COURIER TYPES
// ======================================================

const COURIER_TYPES = {
  PICKUP: "PICKUP",
  DELIVERY: "DELIVERY",
};

// ======================================================
// STATUS TRANSITION RULES
// ======================================================

/**
 * Defines valid status transitions for shipments
 * Maps current status to allowed next statuses
 */
const VALID_TRANSITIONS = {
  [SHIPMENT_STATUSES.PICKUP_REQUESTED]: [
    SHIPMENT_STATUSES.PICKUP_COLLECTED,
    SHIPMENT_STATUSES.CANCELLED,
  ],

  [SHIPMENT_STATUSES.PICKUP_COLLECTED]: [
    SHIPMENT_STATUSES.RECEIVED_AT_WAREHOUSE,
  ],

  [SHIPMENT_STATUSES.RECEIVED_AT_WAREHOUSE]: [
    SHIPMENT_STATUSES.OUT_FOR_DELIVERY,
    SHIPMENT_STATUSES.CANCELLED,
  ],

  [SHIPMENT_STATUSES.OUT_FOR_DELIVERY]: [
    SHIPMENT_STATUSES.DELIVERED_SUCCESSFULLY,
    SHIPMENT_STATUSES.PARTIAL_DELIVERY,
    SHIPMENT_STATUSES.EXCHANGE,
    SHIPMENT_STATUSES.RETURNED_WITH_FEES_PAID,
    SHIPMENT_STATUSES.REJECTED_WITHOUT_PAYMENT,
    SHIPMENT_STATUSES.CANCELLED,
  ],

  [SHIPMENT_STATUSES.PARTIAL_RETURN]: [
    SHIPMENT_STATUSES.RETURNED_TO_WAREHOUSE,
    SHIPMENT_STATUSES.CANCELLED,
  ],

  // Terminal states - no transitions allowed from these
  [SHIPMENT_STATUSES.DELIVERED_SUCCESSFULLY]: [],
  [SHIPMENT_STATUSES.RETURNED_TO_WAREHOUSE]: [],
  [SHIPMENT_STATUSES.CANCELLED]: [],
  [SHIPMENT_STATUSES.REJECTED_WITHOUT_PAYMENT]: [],
};

// ======================================================
// VALIDATION FUNCTIONS
// ======================================================

/**
 * Check if a status transition is valid
 * @param {string} currentStatus - Current shipment status
 * @param {string} newStatus - Proposed new status
 * @returns {boolean} True if transition is valid
 */
function isValidTransition(currentStatus, newStatus) {
  const allowedStatuses = VALID_TRANSITIONS[currentStatus] || [];
  return allowedStatuses.includes(newStatus);
}

/**
 * Validate if a courier type can be assigned to a shipment status
 * @param {string} courierType - PICKUP or DELIVERY
 * @param {string} shipmentStatus - Current shipment status
 * @returns {boolean} True if assignment is valid
 */
function canAssignCourierType(courierType, shipmentStatus) {
  if (courierType === COURIER_TYPES.PICKUP) {
    return shipmentStatus === SHIPMENT_STATUSES.PICKUP_REQUESTED;
  }

  if (courierType === COURIER_TYPES.DELIVERY) {
    return (
      shipmentStatus === SHIPMENT_STATUSES.RECEIVED_AT_WAREHOUSE ||
      shipmentStatus === SHIPMENT_STATUSES.PARTIAL_RETURN
    );
  }

  return false;
}

/**
 * Validate partial delivery inputs
 * @param {number} totalAmount - Original shipment amount
 * @param {number} collectedAmount - Amount collected from customer
 * @returns {object} Validation result {valid: boolean, error?: string}
 */
function validatePartialDelivery(totalAmount, collectedAmount) {
  if (!collectedAmount || collectedAmount <= 0) {
    return {
      valid: false,
      error: "Collected amount must be greater than 0",
    };
  }

  if (collectedAmount >= totalAmount) {
    return {
      valid: false,
      error: "Collected amount must be less than total amount",
    };
  }

  return { valid: true };
}

/**
 * Validate delivery outcome inputs
 * @param {string} outcome - Delivery outcome type
 * @param {object} data - Outcome data
 * @returns {object} Validation result
 */
function validateDeliveryOutcome(outcome, data) {
  switch (outcome) {
    case SHIPMENT_STATUSES.PARTIAL_DELIVERY:
      return validatePartialDelivery(
        parseFloat(data.totalAmount),
        parseFloat(data.collectedAmount),
      );

    case SHIPMENT_STATUSES.RETURNED_WITH_FEES_PAID:
      if (
        !data.shippingFeesCollected ||
        parseFloat(data.shippingFeesCollected) <= 0
      ) {
        return {
          valid: false,
          error: "Shipping fees must be greater than 0",
        };
      }
      return { valid: true };

    case SHIPMENT_STATUSES.EXCHANGE:
    case SHIPMENT_STATUSES.DELIVERED_SUCCESSFULLY:
    case SHIPMENT_STATUSES.REJECTED_WITHOUT_PAYMENT:
      return { valid: true };

    default:
      return { valid: false, error: "Invalid delivery outcome" };
  }
}

// ======================================================
// SHIPMENT SERIAL HANDLING
// ======================================================

/**
 * Generate child shipment serial based on outcome
 * @param {string} parentSerial - Parent shipment serial (e.g., "SH-1001")
 * @param {string} shipmentType - partial_return or exchange
 * @returns {string} New serial with suffix
 */
function generateChildShipmentSerial(parentSerial, shipmentType) {
  const suffix = shipmentType === SHIPMENT_TYPES.PARTIAL_RETURN ? "-P" : "-R";
  return `${parentSerial}${suffix}`;
}

/**
 * Extract parent serial and suffix from serial number
 * @param {string} serial - Serial number (e.g., "SH-1001-P")
 * @returns {object} {parent: "SH-1001", suffix: "P"} or null
 */
function parseShipmentSerial(serial) {
  const match = serial.match(/^(.+?)(-[PR])$/);
  if (!match) return null;
  return {
    parent: match[1],
    suffix: match[2].substring(1),
  };
}

// ======================================================
// SHIPMENT CREATION HELPERS
// ======================================================

/**
 * Calculate remaining amount for partial delivery
 * @param {number} totalAmount - Original amount
 * @param {number} collectedAmount - Collected from customer
 * @returns {number} Remaining amount
 */
function calculateRemainingAmount(totalAmount, collectedAmount) {
  return totalAmount - collectedAmount;
}

/**
 * Get shipment type based on parent and suffix
 * @param {string} serial - Shipment serial
 * @returns {string} Shipment type
 */
function getShipmentTypeFromSerial(serial) {
  const parsed = parseShipmentSerial(serial);
  if (!parsed) return SHIPMENT_TYPES.NORMAL;
  return parsed.suffix === "P"
    ? SHIPMENT_TYPES.PARTIAL_RETURN
    : SHIPMENT_TYPES.EXCHANGE;
}

/**
 * Prepare data for creating a child shipment (partial/exchange)
 * @param {object} originalShipment - Original shipment object
 * @param {string} outcome - PARTIAL_DELIVERY or EXCHANGE
 * @param {object} outcomeData - Data from delivery outcome
 * @returns {object} New shipment data
 */
function prepareChildShipmentData(originalShipment, outcome, outcomeData) {
  const isPartial = outcome === SHIPMENT_STATUSES.PARTIAL_DELIVERY;

  const childData = {
    merchantId: originalShipment.merchantId,
    receiverId: originalShipment.receiverId,
    policyNumber: generateChildShipmentSerial(
      originalShipment.policyNumber,
      isPartial ? SHIPMENT_TYPES.PARTIAL_RETURN : SHIPMENT_TYPES.EXCHANGE,
    ),
    shipmentType: isPartial
      ? SHIPMENT_TYPES.PARTIAL_RETURN
      : SHIPMENT_TYPES.EXCHANGE,
    parentShipmentId: originalShipment.id,
    isOpenable: originalShipment.isOpenable,
    isFastDelivery: originalShipment.isFastDelivery,
  };

  if (isPartial) {
    childData.shipmentStatus = SHIPMENT_STATUSES.PARTIAL_RETURN;
    childData.totalAmount = calculateRemainingAmount(
      parseFloat(originalShipment.totalAmount),
      parseFloat(outcomeData.collectedAmount),
    );
    childData.amountGained = childData.totalAmount;
    childData.additionalNotes = outcomeData.partialDeliveryReason || "";
  } else {
    // Exchange
    childData.shipmentStatus = SHIPMENT_STATUSES.RECEIVED_AT_WAREHOUSE;
    childData.totalAmount = 0;
    childData.amountGained = 0;
    childData.additionalNotes = "Replacement shipment from exchange";
  }

  return childData;
}

// ======================================================
// SETTLEMENT CALCULATIONS
// ======================================================

/**
 * Calculate courier settlement based on delivery outcome
 * @param {string} shipmentStatus - Final shipment status
 * @param {object} shipment - Shipment data
 * @returns {number} Amount to add to courier settlement
 */
function calculateCourierSettlement(shipmentStatus, shipment) {
  switch (shipmentStatus) {
    case SHIPMENT_STATUSES.DELIVERED_SUCCESSFULLY:
      return parseFloat(shipment.totalAmount);

    case SHIPMENT_STATUSES.PARTIAL_DELIVERY:
      return parseFloat(shipment.deliveryCollectedAmount || 0);

    case SHIPMENT_STATUSES.RETURNED_WITH_FEES_PAID:
      return parseFloat(shipment.deliveryCollectedAmount || 0); // Shipping fees only

    case SHIPMENT_STATUSES.REJECTED_WITHOUT_PAYMENT:
    case SHIPMENT_STATUSES.CANCELLED:
      return 0; // No settlement

    default:
      return 0;
  }
}

/**
 * Calculate merchant balance change based on delivery outcome
 * @param {string} shipmentStatus - Final shipment status
 * @param {object} shipment - Shipment data
 * @returns {number} Amount to add/deduct from merchant balance
 */
function calculateMerchantBalanceChange(shipmentStatus, shipment) {
  switch (shipmentStatus) {
    case SHIPMENT_STATUSES.DELIVERED_SUCCESSFULLY:
    case SHIPMENT_STATUSES.PARTIAL_DELIVERY:
      return parseFloat(shipment.totalAmount); // Add to balance

    case SHIPMENT_STATUSES.REJECTED_WITHOUT_PAYMENT:
      return -parseFloat(shipment.totalAmount); // Deduct from balance

    case SHIPMENT_STATUSES.RETURNED_WITH_FEES_PAID:
    case SHIPMENT_STATUSES.EXCHANGE:
    case SHIPMENT_STATUSES.CANCELLED:
      return 0; // No balance change

    default:
      return 0;
  }
}

/**
 * Determine if a shipment status affects merchant/courier settlements
 * @param {string} status - Shipment status
 * @returns {boolean}
 */
function isSettlementStatus(status) {
  const settlementStatuses = [
    SHIPMENT_STATUSES.DELIVERED_SUCCESSFULLY,
    SHIPMENT_STATUSES.PARTIAL_DELIVERY,
    SHIPMENT_STATUSES.RETURNED_WITH_FEES_PAID,
    SHIPMENT_STATUSES.REJECTED_WITHOUT_PAYMENT,
  ];
  return settlementStatuses.includes(status);
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  // Constants
  SHIPMENT_STATUSES,
  SHIPMENT_TYPES,
  COURIER_TYPES,
  VALID_TRANSITIONS,

  // Validation
  isValidTransition,
  canAssignCourierType,
  validatePartialDelivery,
  validateDeliveryOutcome,

  // Serial Handling
  generateChildShipmentSerial,
  parseShipmentSerial,
  getShipmentTypeFromSerial,

  // Shipment Creation
  calculateRemainingAmount,
  prepareChildShipmentData,

  // Settlement
  calculateCourierSettlement,
  calculateMerchantBalanceChange,
  isSettlementStatus,
};
