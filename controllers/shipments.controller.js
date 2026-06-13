const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * Get all shipments with pagination
 */
exports.getAllShipments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const status = req.query.status || "";

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
    };

    const totalShipments = await prisma.shipment.count({ where });

    const shipments = await prisma.shipment.findMany({
      where,
      include: {
        merchant: { select: { id: true, name: true, phone: true } },
        receiver: {
          select: { id: true, fullName: true, phone1: true, governorate: true },
        },
        items: { select: { id: true, productName: true, count: true } },
        creator: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(totalShipments / limit);

    res.render("Shipments/index", {
      shipments,
      currentPage: page,
      totalPages,
      totalShipments,
      limit,
      search,
      status,
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
exports.calculateQuote = async (req, res) => {
  try {
    const { merchantId, governorate, city, amountGained, isFastDelivery } =
      req.body;

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

    // Get price from price list
    const priceRecord = await prisma.merchantPrice.findFirst({
      where: {
        merchantId,
        governorate,
        city,
        isDeleted: false,
      },
      select: { price: true },
    });

    if (!priceRecord) {
      return res.json({
        success: false,
        error: "لا توجد قائمة أسعار لهذا التاجر في هذه المنطقة",
      });
    }

    let totalPrice = parseFloat(priceRecord.price);

    // Apply fast delivery multiplier (1.5x)
    if (isFastDelivery) {
      totalPrice = totalPrice * 1.5;
    }

    // Apply extra weight fee
    const amountGainedNum = parseFloat(amountGained) || 0;
    const maxWeightNum = parseFloat(merchant.maxShipmentWeight) || 0;
    const extraFeeNum = parseFloat(merchant.extraWeightFeePerKg) || 0;

    if (maxWeightNum > 0 && amountGainedNum > maxWeightNum && extraFeeNum > 0) {
      const excessWeight = amountGainedNum - maxWeightNum;
      totalPrice += excessWeight * extraFeeNum;
    }

    res.json({
      success: true,
      price: parseFloat(totalPrice.toFixed(2)),
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
    const {
      merchantId,
      receiverId,
      policyNumber,
      isOpenable,
      isFastDelivery,
      totalAmount,
      amountGained,
      additionalNotes,
      items,
    } = req.body;

    // Validate required fields
    if (
      !merchantId ||
      !receiverId ||
      !totalAmount ||
      !amountGained ||
      !items ||
      items.length === 0
    ) {
      return res.json({ success: false, error: "بيانات ناقصة" });
    }

    // Verify merchant and receiver exist
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
    });
    const receiver = await prisma.receiver.findUnique({
      where: { id: parseInt(receiverId) },
    });

    if (!merchant || !receiver) {
      return res.json({
        success: false,
        error: "التاجر أو المستقبل غير موجود",
      });
    }

    // Create shipment with initial status "طلب بيك اب"
    const shipment = await prisma.shipment.create({
      data: {
        merchantId,
        receiverId: parseInt(receiverId),
        policyNumber: policyNumber || null,
        isOpenable: isOpenable === "true" || isOpenable === true,
        isFastDelivery: isFastDelivery === "true" || isFastDelivery === true,
        shipmentStatus: "طلب بيك اب", // Initial status
        totalAmount: parseFloat(totalAmount),
        amountGained: parseFloat(amountGained),
        additionalNotes: additionalNotes || null,
        createdBy: req.user?.id || null,
      },
    });

    // Create shipment items
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
            createdBy: req.user?.id || null,
          },
        });
      }
    }

    // Log the action
    await prisma.log.create({
      data: {
        action: "CREATE_SHIPMENT",
        entity: "Shipment",
        entityId: shipment.id,
        details: JSON.stringify({
          merchantId,
          receiverId,
          totalAmount,
          amountGained,
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
 * Update shipment status
 */
exports.updateShipmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { shipmentStatus } = req.body;

    if (!shipmentStatus) {
      return res.json({ success: false, error: "حالة الشحنة مطلوبة" });
    }

    const shipment = await prisma.shipment.update({
      where: { id: parseInt(id) },
      data: {
        shipmentStatus,
        lastModifiedBy: req.user?.id || null,
      },
    });

    // Log the action
    await prisma.log.create({
      data: {
        action: "UPDATE_SHIPMENT_STATUS",
        entity: "Shipment",
        entityId: parseInt(id),
        details: JSON.stringify({ newStatus: shipmentStatus }),
        userId: req.user?.id || 1,
        ipAddress: req.ip,
      },
    });

    res.json({ success: true, message: "تم تحديث حالة الشحنة", shipment });
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
