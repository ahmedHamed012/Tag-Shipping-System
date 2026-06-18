const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const STATUS = {
  PICKUP_REQUESTED:      'طلب بيك اب',
  RECEIVED_AT_WAREHOUSE: 'تم الاستقبال',
  OUT_FOR_DELIVERY:      'قيد التوصيل',
  DELIVERED:             'تم التوصيل',
  PARTIALLY_DELIVERED:   'تسليم جزئي',
  REPLACEMENT:           'استبدال',
  RETURNED_SHIPPING_PAID:'مرتجع مع دفع الشحن',
  REFUSED_SHIPPING_PAID: 'رفض التسليم مع دفع الشحن',
  CANCELLED:             'ملغاة',
  POSTPONED:             'مؤجل',
  RETURNED_TO_WAREHOUSE: 'مرتجع للمستودع',
  RETURNED:              'مرتجع',
  RETURNED_TO_MERCHANT:  'مرتجع للتاجر',
  PARTIAL_RETURN:        'مرتجع جزئي',
  REPLACEMENT_RETURN:    'مرتجع استبدال',
};

const ALLOWED_TRANSITIONS = {
  [STATUS.PICKUP_REQUESTED]:      [STATUS.RECEIVED_AT_WAREHOUSE],
  [STATUS.RECEIVED_AT_WAREHOUSE]: [STATUS.OUT_FOR_DELIVERY, STATUS.CANCELLED],
  [STATUS.OUT_FOR_DELIVERY]:      [STATUS.DELIVERED, STATUS.PARTIALLY_DELIVERED, STATUS.REPLACEMENT,
                                   STATUS.RETURNED_SHIPPING_PAID, STATUS.REFUSED_SHIPPING_PAID, STATUS.POSTPONED],
  [STATUS.DELIVERED]:             [],
  [STATUS.PARTIALLY_DELIVERED]:   [],
  [STATUS.REPLACEMENT]:           [],
  [STATUS.RETURNED_SHIPPING_PAID]:[STATUS.RECEIVED_AT_WAREHOUSE],
  [STATUS.REFUSED_SHIPPING_PAID]: [STATUS.RETURNED_TO_WAREHOUSE],
  [STATUS.CANCELLED]:             [],
  [STATUS.POSTPONED]:             [STATUS.RETURNED_TO_WAREHOUSE],
  [STATUS.RETURNED_TO_WAREHOUSE]: [STATUS.RETURNED, STATUS.RETURNED_TO_MERCHANT],
  [STATUS.RETURNED]:              [],
  [STATUS.RETURNED_TO_MERCHANT]:  [],
  [STATUS.PARTIAL_RETURN]:        [STATUS.RETURNED_TO_WAREHOUSE],
  [STATUS.REPLACEMENT_RETURN]:    [STATUS.RECEIVED_AT_WAREHOUSE],
};

// Transitions TO Received-at-Warehouse that require specifying a pickup courier
const REQUIRES_PICKUP_COURIER = [STATUS.RETURNED_SHIPPING_PAID, STATUS.REPLACEMENT_RETURN];

// Transition TO Out-for-Delivery requires specifying a delivery courier
const REQUIRES_DELIVERY_COURIER = [STATUS.RECEIVED_AT_WAREHOUSE];

// Statuses that require extra data and cannot be set via bulk update
const BULK_BLOCKED_STATUSES = [STATUS.PARTIALLY_DELIVERED, STATUS.REPLACEMENT, STATUS.RETURNED_SHIPPING_PAID];

exports.STATUS = STATUS;
exports.ALLOWED_TRANSITIONS = ALLOWED_TRANSITIONS;

/**
 * Get all shipments with pagination
 */
exports.getAllShipments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const status = req.query.status || "";
    const merchantId = req.query.merchantId || "";
    const dateFrom = req.query.dateFrom || "";
    const dateTo = req.query.dateTo || "";
    const customerName = req.query.customerName || "";
    const customerPhone = req.query.customerPhone || "";
    const governorate = req.query.governorate || "";
    const area = req.query.area || "";
    const courierId = req.query.courierId || "";

    const skip = (page - 1) * limit;

    const where = {
      isDeleted: false,
      ...(search && {
        OR: [
          { policyNumber: { contains: search } },
          { receiver: { fullName: { contains: search } } },
          { receiver: { phone1: { contains: search } } },
          { merchant: { name: { contains: search } } },
        ],
      }),
      ...(status && { shipmentStatus: status }),
      ...(merchantId && { merchantId }),
      ...(courierId && { courierId: parseInt(courierId) }),
      ...(customerName && { receiver: { fullName: { contains: customerName } } }),
      ...(customerPhone && { receiver: { phone1: { contains: customerPhone } } }),
      ...(governorate && { receiver: { governorate: { contains: governorate } } }),
      ...(area && { receiver: { city: { contains: area } } }),
      ...((dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo + "T23:59:59.999Z") }),
        },
      }),
    };

    const [totalShipments, shipments, merchants, couriers] = await Promise.all([
      prisma.shipment.count({ where }),
      prisma.shipment.findMany({
        where,
        include: {
          merchant: { select: { id: true, name: true, phone: true } },
          receiver: {
            select: { id: true, fullName: true, phone1: true, governorate: true, city: true },
          },
          courier: { select: { id: true, fullName: true, phone: true } },
          items: { select: { id: true, productName: true, count: true } },
          creator: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.merchant.findMany({
        where: { isDeleted: false, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.courier.findMany({
        where: { isDeleted: false, isActive: true },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      }),
    ]);

    const totalPages = Math.ceil(totalShipments / limit);

    res.render("Shipments/index", {
      shipments,
      currentPage: page,
      totalPages,
      totalShipments,
      limit,
      search,
      status,
      merchantId,
      dateFrom,
      dateTo,
      customerName,
      customerPhone,
      governorate,
      area,
      courierId,
      merchants,
      couriers,
    });
  } catch (error) {
    console.error("Error fetching shipments:", error);
    res.status(500).render("error", { error: error.message });
  }
};

/**
 * Render create shipment form
 */
exports.createShipmentForm = async (req, res) => {
  try {
    const merchants = await prisma.merchant.findMany({
      where: { isDeleted: false, isActive: true },
      select: {
        id: true,
        name: true,
        maxShipmentWeight: true,
        extraWeightFeePerKg: true,
      },
    });

    res.render("Shipments/create", { merchants });
  } catch (error) {
    console.error("Error rendering create form:", error);
    res.status(500).render("error", { error: error.message });
  }
};

/**
 * Search receiver by phone
 */
exports.searchReceiver = async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone || phone.trim().length < 5) {
      return res.json({ success: false, error: "أدخل رقم هاتف صحيح" });
    }

    const receiver = await prisma.receiver.findFirst({
      where: {
        OR: [{ phone1: phone }, { phone2: phone }],
        isDeleted: false,
      },
      select: {
        id: true,
        fullName: true,
        phone1: true,
        phone2: true,
        address: true,
        governorate: true,
        city: true,
        notes: true,
      },
    });

    if (!receiver) {
      return res.json({ success: false, error: "المستقبل غير موجود" });
    }

    res.json({ success: true, receiver });
  } catch (error) {
    console.error("Error searching receiver:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Calculate shipment quote
 */
/**
 * Calculate shipment quote
 */
exports.calculateQuote = async (req, res) => {
  try {
    const {
      merchantId,
      governorate,
      city,
      amountGained,
      isFastDelivery,
      items,
    } = req.body;

    console.log("Request body:", req.body);
    if (!merchantId || !governorate || !city) {
      return res.json({ success: false, error: "بيانات ناقصة" });
    }

    // Get merchant data
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { maxShipmentWeight: true, extraWeightFeePerKg: true },
    });

    if (!merchant) {
      return res.json({ success: false, error: "التاجر غير موجود" });
    }

    console.log(merchantId, governorate, city);
    // Get shipping cost from price list
    const priceRecord = await prisma.merchantPrice.findFirst({
      where: {
        merchantId,
        governorate,
        city,
        shipmentStatus: "طلب بيك اب",
        isDeleted: false,
      },
      select: { price: true },
    });

    console.log("Price record:", priceRecord);

    if (!priceRecord) {
      return res.json({
        success: false,
        error: "لا توجد قائمة أسعار لهذا التاجر في هذه المنطقة",
      });
    }

    let shippingCost = parseFloat(priceRecord.price);

    // Apply fast delivery multiplier (1.5x)
    if (isFastDelivery) {
      shippingCost = shippingCost * 1.5;
    }

    // Apply extra weight fee
    const amountGainedNum = parseFloat(amountGained) || 0;
    const maxWeightNum = parseFloat(merchant.maxShipmentWeight) || 0;
    const extraFeeNum = parseFloat(merchant.extraWeightFeePerKg) || 0;

    if (maxWeightNum > 0 && amountGainedNum > maxWeightNum && extraFeeNum > 0) {
      const excessWeight = amountGainedNum - maxWeightNum;
      shippingCost += excessWeight * extraFeeNum;
    }

    // Calculate products total from items (price * count)
    let productsTotal = 0;
    if (Array.isArray(items)) {
      productsTotal = items.reduce((sum, item) => {
        const price = parseFloat(item.price) || 0;
        const count = parseInt(item.count) || 1;
        return sum + price * count;
      }, 0);
    }

    const shipmentTotal = productsTotal + shippingCost;

    res.json({
      success: true,
      shippingCost: parseFloat(shippingCost.toFixed(2)),
      productsTotal: parseFloat(productsTotal.toFixed(2)),
      price: parseFloat(shipmentTotal.toFixed(2)), // kept for backward compatibility
      shipmentTotal: parseFloat(shipmentTotal.toFixed(2)),
    });
  } catch (error) {
    console.error("Error calculating quote:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Create new shipment
 */
exports.createShipment = async (req, res) => {
  try {
    let {
      merchantId,
      receiver,
      receiverId,
      policyNumber,
      isOpenable,
      isFastDelivery,
      amountGained,
      additionalNotes,
      items,
      governorate,
      city,
      totalAmount,
    } = req.body;

    console.log("Request body for creating shipment:", req.body);
    // Validate required fields
    if (
      !merchantId ||
      // !receiverId ||
      !amountGained ||
      !items ||
      items.length === 0 ||
      !governorate ||
      !city
    ) {
      return res.json({ success: false, error: "بيانات ناقصة" });
    }

    // Verify merchant and receiver exist
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    if (receiverId) {
      const receiverExists = await prisma.receiver.findUnique({
        where: { id: parseInt(receiverId) },
      });

      if (!receiverExists) {
        return res.json({
          success: false,
          error: "المستقبل غير موجود",
        });
      }
    }

    if (!receiverId) {
      const receiverData = await prisma.receiver.create({
        data: {
          fullName: receiver.fullName,
          phone1: receiver.phone1,
          phone2: receiver.phone2,
          address: receiver.address,
          notes: receiver.notes,
          governorate: receiver.governorate,
          city: receiver.city,
        },
      });
      receiverId = receiverData.id;
    }

    if (!merchant) {
      return res.json({
        success: false,
        error: "التاجر غير موجود",
      });
    }

    // Create shipment with initial status "طلب بيك اب"
    const shipment = await prisma.shipment.create({
      data: {
        merchantId,
        receiverId: parseInt(receiverId),
        policyNumber: policyNumber || null,
        isOpenable: isOpenable === "true" || isOpenable === true,
        isFastDelivery: isFastDelivery,
        shipmentStatus: "طلب بيك اب", // Initial status
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        amountGained: parseFloat(0),
        additionalNotes: additionalNotes || null,
        createdBy: req.user?.id || null,
      },
    });

    // Create shipment items (now including price)
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await prisma.shipmentItem.create({
          data: {
            shipmentId: shipment.id,
            productName: item.productName,
            productDescription: item.productDescription || null,
            netWeight: item.netWeight ? parseFloat(item.netWeight) : null,
            size: item.size || null,
            count: parseInt(item.count) || 1,
            price: parseFloat(item.price) || 0,
            createdBy: req.user?.id || null,
          },
        });
      }
    }

    // Log the action
    await prisma.log.create({
      data: {
        action: "إنشاء شحنة جديدة",
        entity: "Shipment",
        entityId: shipment.id,
        details: JSON.stringify({
          merchantId,
          receiverId,
          totalAmount,
          amountGained: 0,
          itemsCount: items.length,
        }),
        userId: req.user?.id || 1,
        ipAddress: req.ip,
      },
    });

    res.json({
      success: true,
      message: "تم إنشاء الشحنة بنجاح",
      shipment: shipment.id,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
    });
  } catch (error) {
    console.error("Error creating shipment:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get single shipment
 */
exports.getShipment = async (req, res) => {
  try {
    const { id } = req.params;

    const shipment = await prisma.shipment.findUnique({
      where: { id: parseInt(id) },
      include: {
        merchant: true,
        receiver: true,
        items: true,
        creator: { select: { id: true, fullName: true } },
      },
    });

    if (!shipment || shipment.isDeleted) {
      return res.json({ success: false, error: "الشحنة غير موجودة" });
    }

    res.json({ success: true, shipment });
  } catch (error) {
    console.error("Error fetching shipment:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Update shipment status (enforces lifecycle rules)
 */
exports.updateShipmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { shipmentStatus, collectedAmount, courierId } = req.body;

    if (!shipmentStatus) {
      return res.json({ success: false, error: "حالة الشحنة مطلوبة" });
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id: parseInt(id) },
      include: { items: true },
    });

    if (!shipment || shipment.isDeleted) {
      return res.json({ success: false, error: "الشحنة غير موجودة" });
    }

    // Validate transition
    const allowed = ALLOWED_TRANSITIONS[shipment.shipmentStatus] || [];
    if (!allowed.includes(shipmentStatus)) {
      return res.json({
        success: false,
        error: `لا يمكن الانتقال من "${shipment.shipmentStatus}" إلى "${shipmentStatus}"`,
      });
    }

    const updateData = { shipmentStatus, lastModifiedBy: req.user?.id || null };

    // Status 5 (Partially Delivered): requires collected amount
    if (shipmentStatus === STATUS.PARTIALLY_DELIVERED) {
      if (collectedAmount === undefined || collectedAmount === null || collectedAmount === '') {
        return res.json({ success: false, error: "أدخل المبلغ المحصل من العميل" });
      }
      updateData.deliveryCollectedAmount = parseFloat(collectedAmount);
    }

    // Status 7 (Returned with Shipping Fee Paid): requires shipping amount collected
    if (shipmentStatus === STATUS.RETURNED_SHIPPING_PAID) {
      if (collectedAmount === undefined || collectedAmount === null || collectedAmount === '') {
        return res.json({ success: false, error: "أدخل مبلغ الشحن المحصل من العميل" });
      }
      updateData.deliveryCollectedAmount = parseFloat(collectedAmount);
    }

    // Transitioning to Received-at-Warehouse from statuses that need a pickup courier
    if (shipmentStatus === STATUS.RECEIVED_AT_WAREHOUSE && REQUIRES_PICKUP_COURIER.includes(shipment.shipmentStatus)) {
      if (!courierId) {
        return res.json({ success: false, error: "حدد مندوب الاستلام" });
      }
      updateData.courierId = parseInt(courierId);
    }

    // Transitioning to Out-for-Delivery requires a delivery courier
    if (shipmentStatus === STATUS.OUT_FOR_DELIVERY) {
      if (!courierId) {
        return res.json({ success: false, error: "حدد مندوب التوصيل" });
      }
      updateData.courierId = parseInt(courierId);
    }

    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({ where: { id: parseInt(id) }, data: updateData });

      // Status 5: auto-create child shipment with policyNumber-P and status 14
      if (shipmentStatus === STATUS.PARTIALLY_DELIVERED) {
        const collected = parseFloat(collectedAmount);
        const remaining = Math.max(0, parseFloat(shipment.totalAmount) - collected);
        const child = await tx.shipment.create({
          data: {
            merchantId: shipment.merchantId,
            receiverId: shipment.receiverId,
            courierId: shipment.courierId,
            parentShipmentId: shipment.id,
            policyNumber: (shipment.policyNumber || `SH-${shipment.id}`) + '-P',
            isOpenable: shipment.isOpenable,
            isFastDelivery: shipment.isFastDelivery,
            shipmentStatus: STATUS.PARTIAL_RETURN,
            shipmentType: 'partial_return',
            totalAmount: remaining,
            amountGained: 0,
            additionalNotes: shipment.additionalNotes,
            createdBy: req.user?.id || null,
          },
        });
        for (const item of shipment.items) {
          await tx.shipmentItem.create({
            data: {
              shipmentId: child.id,
              productName: item.productName,
              productDescription: item.productDescription,
              netWeight: item.netWeight,
              size: item.size,
              count: item.count,
              price: item.price,
              createdBy: req.user?.id || null,
            },
          });
        }
      }

      // Status 6: auto-create child shipment with policyNumber-R and status 15, amount 0
      if (shipmentStatus === STATUS.REPLACEMENT) {
        const child = await tx.shipment.create({
          data: {
            merchantId: shipment.merchantId,
            receiverId: shipment.receiverId,
            courierId: shipment.courierId,
            parentShipmentId: shipment.id,
            policyNumber: (shipment.policyNumber || `SH-${shipment.id}`) + '-R',
            isOpenable: shipment.isOpenable,
            isFastDelivery: shipment.isFastDelivery,
            shipmentStatus: STATUS.REPLACEMENT_RETURN,
            shipmentType: 'replacement_return',
            totalAmount: 0,
            amountGained: 0,
            additionalNotes: shipment.additionalNotes,
            createdBy: req.user?.id || null,
          },
        });
        for (const item of shipment.items) {
          await tx.shipmentItem.create({
            data: {
              shipmentId: child.id,
              productName: item.productName,
              productDescription: item.productDescription,
              netWeight: item.netWeight,
              size: item.size,
              count: item.count,
              price: 0,
              createdBy: req.user?.id || null,
            },
          });
        }
      }

      await tx.log.create({
        data: {
          action: "UPDATE_SHIPMENT_STATUS",
          entity: "Shipment",
          entityId: parseInt(id),
          details: JSON.stringify({
            fromStatus: shipment.shipmentStatus,
            toStatus: shipmentStatus,
            collectedAmount: collectedAmount || null,
          }),
          userId: req.user?.id || 1,
          ipAddress: req.ip,
        },
      });
    });

    res.json({ success: true, message: "تم تحديث حالة الشحنة" });
  } catch (error) {
    console.error("Error updating shipment:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Delete shipment
 */
exports.deleteShipment = async (req, res) => {
  try {
    const { id } = req.params;

    const shipment = await prisma.shipment.update({
      where: { id: parseInt(id) },
      data: {
        isDeleted: true,
        lastModifiedBy: req.user?.id || null,
      },
    });

    // Log the action
    await prisma.log.create({
      data: {
        action: "DELETE_SHIPMENT",
        entity: "Shipment",
        entityId: parseInt(id),
        details: JSON.stringify({ policyNumber: shipment.policyNumber }),
        userId: req.user?.id || 1,
        ipAddress: req.ip,
      },
    });

    res.json({ success: true, message: "تم حذف الشحنة" });
  } catch (error) {
    console.error("Error deleting shipment:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get shipment by barcode/policyNumber
 */
exports.getShipmentByBarcode = async (req, res) => {
  try {
    const { barcode } = req.query;
    if (!barcode) return res.json({ success: false, error: "أدخل الباركود" });

    const shipment = await prisma.shipment.findFirst({
      where: { policyNumber: barcode, isDeleted: false },
      include: {
        merchant: { select: { id: true, name: true } },
        receiver: { select: { id: true, fullName: true, phone1: true, governorate: true, city: true } },
        courier: { select: { id: true, fullName: true } },
      },
    });

    if (!shipment) return res.json({ success: false, error: "لم يتم العثور على الشحنة" });
    res.json({ success: true, shipment });
  } catch (error) {
    console.error("Error fetching shipment by barcode:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Bulk update shipment status (validates lifecycle transitions)
 */
exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { shipmentIds, shipmentStatus } = req.body;
    if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
      return res.json({ success: false, error: "اختر شحنة على الأقل" });
    }
    if (!shipmentStatus) {
      return res.json({ success: false, error: "اختر الحالة الجديدة" });
    }

    // Block statuses that require extra data or auto-create child shipments
    if (BULK_BLOCKED_STATUSES.includes(shipmentStatus)) {
      return res.json({
        success: false,
        error: "هذه الحالة تتطلب بيانات إضافية. استخدم التحديث الفردي لكل شحنة.",
      });
    }

    const shipments = await prisma.shipment.findMany({
      where: { id: { in: shipmentIds.map(Number) }, isDeleted: false },
      select: { id: true, shipmentStatus: true },
    });

    const invalid = shipments.filter(s => !(ALLOWED_TRANSITIONS[s.shipmentStatus] || []).includes(shipmentStatus));
    if (invalid.length > 0) {
      const details = invalid.map(s => `#${s.id} (${s.shipmentStatus})`).join('، ');
      return res.json({
        success: false,
        error: `انتقال غير مسموح به للشحنات التالية: ${details}`,
      });
    }

    await prisma.shipment.updateMany({
      where: { id: { in: shipmentIds.map(Number) }, isDeleted: false },
      data: { shipmentStatus, lastModifiedBy: req.user?.id || null },
    });

    await prisma.log.create({
      data: {
        action: "BULK_UPDATE_SHIPMENT_STATUS",
        entity: "Shipment",
        entityId: shipmentIds[0],
        details: JSON.stringify({ shipmentIds, newStatus: shipmentStatus }),
        userId: req.user?.id || 1,
        ipAddress: req.ip,
      },
    });

    res.json({ success: true, message: `تم تحديث ${shipmentIds.length} شحنة بنجاح` });
  } catch (error) {
    console.error("Error bulk updating shipments:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get price list by merchant and location
 */
exports.getPriceList = async (req, res) => {
  try {
    const { merchantId, governorate, city } = req.query;

    if (!merchantId || !governorate || !city) {
      return res.json({ success: false, error: "بيانات ناقصة" });
    }

    const priceList = await prisma.merchantPrice.findMany({
      where: {
        merchantId,
        governorate,
        city,
        isDeleted: false,
      },
      select: {
        id: true,
        shipmentStatus: true,
        price: true,
      },
    });

    res.json({ success: true, priceList });
  } catch (error) {
    console.error("Error fetching price list:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
