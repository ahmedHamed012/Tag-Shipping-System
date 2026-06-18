const prisma = require("../prisma/prismaClient");
const path = require("path");
const fs = require("fs");
const { parseCouriersFromExcel } = require("../utils/excelUtils");

/**
 * Get all couriers with pagination and search
 */
exports.getAllCouriers = async (req, res) => {
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
          creator: {
            select: { id: true, fullName: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.courier.count({ where }),
    ]);

    res.render("couriers/index", {
      couriers,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalCouriers: total,
      limit,
      search,
    });
  } catch (error) {
    console.error("Error fetching couriers:", error);
    res.status(500).render("error", { error: error.message });
  }
};

/**
 * Get single courier
 */
exports.getCourier = async (req, res) => {
  try {
    const { id } = req.params;

    const courier = await prisma.courier.findUnique({
      where: { id: parseInt(id) },
      include: {
        creator: {
          select: { id: true, fullName: true },
        },
        shipments: {
          select: {
            id: true,
            policyNumber: true,
            shipmentStatus: true,
            createdAt: true,
            receiver: {
              select: {
                fullName: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!courier) {
      return res
        .status(404)
        .json({ success: false, error: "الساعي غير موجود" });
    }

    res.json({ success: true, data: courier });
  } catch (error) {
    console.error("Error fetching courier:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Create new courier
 */
exports.createCourier = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      address,
      nationalId,
      drivingLicense,
      courierType,
      deliveryFeePerShipment,
    } = req.body;

    if (!fullName || !phone) {
      return res.status(400).json({
        success: false,
        error: "الاسم الكامل ورقم الهاتف مطلوبان",
      });
    }

    // Validate courier type
    if (courierType && !["PICKUP", "DELIVERY"].includes(courierType)) {
      return res.status(400).json({
        success: false,
        error: "نوع الساعي غير صحيح. يجب أن يكون PICKUP أو DELIVERY",
      });
    }

    // Check if courier with same phone already exists
    const existing = await prisma.courier.findFirst({
      where: {
        phone,
        isDeleted: false,
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "رقم الهاتف مستخدم بالفعل",
      });
    }

    // Handle file uploads
    let idCardFront = null;
    let idCardBack = null;
    let drivingLicenseFront = null;
    let drivingLicenseBack = null;

    if (req.files) {
      if (req.files.idCardFront) {
        idCardFront = `/uploads/${req.files.idCardFront[0].filename}`;
      }
      if (req.files.idCardBack) {
        idCardBack = `/uploads/${req.files.idCardBack[0].filename}`;
      }
      if (req.files.drivingLicenseFront) {
        drivingLicenseFront = `/uploads/${req.files.drivingLicenseFront[0].filename}`;
      }
      if (req.files.drivingLicenseBack) {
        drivingLicenseBack = `/uploads/${req.files.drivingLicenseBack[0].filename}`;
      }
    }

    const courier = await prisma.courier.create({
      data: {
        fullName: fullName.trim(),
        email: email?.trim() || null,
        phone: phone.trim(),
        address: address?.trim() || null,
        nationalId: nationalId?.trim() || null,
        idCardFront,
        idCardBack,
        drivingLicense: drivingLicense?.trim() || null,
        drivingLicenseFront,
        drivingLicenseBack,
        courierType: courierType || "PICKUP",
        deliveryFeePerShipment: deliveryFeePerShipment ? parseFloat(deliveryFeePerShipment) : null,
        createdBy: req.user?.id || null,
      },
      include: {
        _count: { select: { shipments: true } },
        creator: { select: { id: true, fullName: true } },
      },
    });

    res.json({
      success: true,
      message: "تم إضافة الساعي بنجاح",
      data: courier,
    });
  } catch (error) {
    console.error("Error creating courier:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Update courier
 */
exports.updateCourier = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      email,
      phone,
      address,
      nationalId,
      drivingLicense,
      courierType,
      deliveryFeePerShipment,
    } = req.body;

    if (!fullName || !phone) {
      return res.status(400).json({
        success: false,
        error: "الاسم الكامل ورقم الهاتف مطلوبان",
      });
    }

    // Validate courier type
    if (courierType && !["PICKUP", "DELIVERY"].includes(courierType)) {
      return res.status(400).json({
        success: false,
        error: "نوع الساعي غير صحيح. يجب أن يكون PICKUP أو DELIVERY",
      });
    }

    // Check if another courier with same phone exists
    const existing = await prisma.courier.findFirst({
      where: {
        phone,
        id: { not: parseInt(id) },
        isDeleted: false,
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "رقم الهاتف مستخدم بالفعل",
      });
    }

    // Get current courier to preserve existing files
    const currentCourier = await prisma.courier.findUnique({
      where: { id: parseInt(id) },
    });

    if (!currentCourier) {
      return res.status(404).json({
        success: false,
        error: "الساعي غير موجود",
      });
    }

    // Handle file uploads
    let idCardFront = currentCourier.idCardFront;
    let idCardBack = currentCourier.idCardBack;
    let drivingLicenseFront = currentCourier.drivingLicenseFront;
    let drivingLicenseBack = currentCourier.drivingLicenseBack;

    if (req.files) {
      if (req.files.idCardFront) {
        // Delete old file if exists
        if (idCardFront) {
          const oldPath = path.join(__dirname, "../public", idCardFront);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        idCardFront = `/uploads/${req.files.idCardFront[0].filename}`;
      }
      if (req.files.idCardBack) {
        if (idCardBack) {
          const oldPath = path.join(__dirname, "../public", idCardBack);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        idCardBack = `/uploads/${req.files.idCardBack[0].filename}`;
      }
      if (req.files.drivingLicenseFront) {
        if (drivingLicenseFront) {
          const oldPath = path.join(
            __dirname,
            "../public",
            drivingLicenseFront,
          );
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        drivingLicenseFront = `/uploads/${req.files.drivingLicenseFront[0].filename}`;
      }
      if (req.files.drivingLicenseBack) {
        if (drivingLicenseBack) {
          const oldPath = path.join(__dirname, "../public", drivingLicenseBack);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        drivingLicenseBack = `/uploads/${req.files.drivingLicenseBack[0].filename}`;
      }
    }

    const courier = await prisma.courier.update({
      where: { id: parseInt(id) },
      data: {
        fullName: fullName.trim(),
        email: email?.trim() || null,
        phone: phone.trim(),
        address: address?.trim() || null,
        nationalId: nationalId?.trim() || null,
        idCardFront,
        idCardBack,
        drivingLicense: drivingLicense?.trim() || null,
        drivingLicenseFront,
        drivingLicenseBack,
        ...(courierType && { courierType }),
        deliveryFeePerShipment: deliveryFeePerShipment !== undefined && deliveryFeePerShipment !== ''
          ? parseFloat(deliveryFeePerShipment)
          : undefined,
        updatedBy: req.user?.id || null,
      },
      include: {
        _count: { select: { shipments: true } },
        creator: { select: { id: true, fullName: true } },
      },
    });

    res.json({
      success: true,
      message: "تم تحديث بيانات الساعي بنجاح",
      data: courier,
    });
  } catch (error) {
    console.error("Error updating courier:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Toggle courier status
 */
exports.toggleCourierStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const courier = await prisma.courier.findUnique({
      where: { id: parseInt(id) },
    });

    if (!courier) {
      return res.status(404).json({
        success: false,
        error: "الساعي غير موجود",
      });
    }

    const updated = await prisma.courier.update({
      where: { id: parseInt(id) },
      data: {
        isActive: !courier.isActive,
        updatedBy: req.user?.id || null,
      },
      include: {
        _count: { select: { shipments: true } },
      },
    });

    res.json({
      success: true,
      message: `تم ${updated.isActive ? "تفعيل" : "تعطيل"} الساعي بنجاح`,
      data: updated,
    });
  } catch (error) {
    console.error("Error toggling courier status:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Delete courier (soft delete)
 */
exports.deleteCourier = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.courier.update({
      where: { id: parseInt(id) },
      data: { isDeleted: true },
    });

    res.json({
      success: true,
      message: "تم حذف الساعي بنجاح",
    });
  } catch (error) {
    console.error("Error deleting courier:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get couriers for dropdown
 */
exports.getCouriersForDropdown = async (req, res) => {
  try {
    const couriers = await prisma.courier.findMany({
      where: { isDeleted: false, isActive: true },
      select: {
        id: true,
        fullName: true,
        phone: true,
      },
      orderBy: { fullName: "asc" },
    });

    res.json({ success: true, data: couriers });
  } catch (error) {
    console.error("Error fetching couriers:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get couriers by type (PICKUP or DELIVERY)
 */
exports.getCouriersByType = async (req, res) => {
  try {
    const { type } = req.query;

    if (!type || !["PICKUP", "DELIVERY"].includes(type.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: "نوع الساعي غير صحيح. يجب أن يكون PICKUP أو DELIVERY",
      });
    }

    const couriers = await prisma.courier.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        courierType: type.toUpperCase(),
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        courierType: true,
      },
      orderBy: { fullName: "asc" },
    });

    res.json({ success: true, data: couriers });
  } catch (error) {
    console.error("Error fetching couriers by type:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Bulk upload couriers from Excel
 */
exports.bulkUploadCouriers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "لم يتم اختيار ملف",
      });
    }

    const couriers = await parseCouriersFromExcel(req.file.path);

    if (!couriers || couriers.length === 0) {
      return res.status(400).json({
        success: false,
        error: "الملف لا يحتوي على بيانات صحيحة",
      });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [],
      addedCouriers: [],
    };

    const userId = req.user?.id || null;

    for (const courierData of couriers) {
      try {
        // Check if courier with same phone exists
        const existing = await prisma.courier.findFirst({
          where: {
            phone: courierData.phone.trim(),
            isDeleted: false,
          },
        });

        if (existing) {
          results.failed++;
          results.errors.push(
            `فشل: ${courierData.fullName} - رقم الهاتف مستخدم بالفعل`,
          );
          continue;
        }

        const created = await prisma.courier.create({
          data: {
            fullName: courierData.fullName.trim(),
            email: courierData.email?.trim() || null,
            phone: courierData.phone.trim(),
            address: courierData.address?.trim() || null,
            nationalId: courierData.nationalId?.trim() || null,
            drivingLicense: courierData.drivingLicense?.trim() || null,
            courierType: courierData.courierType || "PICKUP",
            createdBy: userId,
          },
        });

        results.success++;
        results.addedCouriers.push(courierData.fullName);
      } catch (error) {
        results.failed++;
        results.errors.push(`فشل: ${courierData.fullName} - ${error.message}`);
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error("Error bulk uploading couriers:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Assign shipment to courier
 */
exports.assignShipmentToCourier = async (req, res) => {
  try {
    const { shipmentId, courierId, policyNumber } = req.body;

    if ((!shipmentId && !policyNumber) || !courierId) {
      return res.status(400).json({
        success: false,
        error: "رقم الشحنة/الباركود ورقم الساعي مطلوبان",
      });
    }

    const courier = await prisma.courier.findFirst({
      where: { id: parseInt(courierId), isDeleted: false, isActive: true },
      select: { id: true, fullName: true },
    });

    if (!courier) {
      return res.status(404).json({
        success: false,
        error: "الساعي غير موجود أو غير نشط",
      });
    }

    // Get shipment details by id or scanned policy number
    const shipment = await prisma.shipment.findFirst({
      where: shipmentId
        ? { id: parseInt(shipmentId), isDeleted: false }
        : { policyNumber: policyNumber.trim(), isDeleted: false },
      include: { receiver: true },
    });

    if (!shipment) {
      return res.status(404).json({
        success: false,
        error: "الشحنة غير موجودة",
      });
    }

    // Validate: Not already assigned to same courier
    if (shipment.courierId === parseInt(courierId, 10)) {
      return res.status(400).json({
        success: false,
        error: "الشحنة مسندة بالفعل لهذا الساعي",
      });
    }

    // Validate: must be received at warehouse before going out for delivery
    if (shipment.shipmentStatus !== "تم الاستقبال") {
      return res.status(400).json({
        success: false,
        error: `لا يمكن إسناد الشحنة لأن حالتها الحالية هي "${shipment.shipmentStatus}". يجب أن تكون "تم الاستقبال"`,
      });
    }

    // Update shipment with courier and status
    const updated = await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        courierId: parseInt(courierId, 10),
        shipmentStatus: "قيد التوصيل",
        lastModifiedBy: req.user?.id || null,
      },
      include: {
        courier: true,
        merchant: true,
        receiver: true,
      },
    });

    res.json({
      success: true,
      message: "تم إسناد الشحنة للساعي بنجاح",
      data: updated,
      shipmentNumber: updated.policyNumber || updated.id,
    });
  } catch (error) {
    console.error("Error assigning shipment:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get current shipments for courier (not yet delivered)
 */
exports.getCurrentShipments = async (req, res) => {
  try {
    const { courierId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const where = {
      courierId: parseInt(courierId),
      shipmentStatus: "قيد التوصيل",
      isDeleted: false,
    };

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        include: {
          receiver: true,
          merchant: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.shipment.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        shipments,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalShipments: total,
          limit,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching current shipments:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get previous shipments for courier (returned/delivered)
 */
exports.getPreviousShipments = async (req, res) => {
  try {
    const { courierId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const where = {
      courierId: parseInt(courierId),
      shipmentStatus: {
        notIn: ["مرتجع", "مرتجع للتاجر", "مرتجع للمستودع", "قيد التوصيل"],
      },
      isDeleted: false,
    };

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        include: {
          receiver: true,
          merchant: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.shipment.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        shipments,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalShipments: total,
          limit,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching previous shipments:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Generate delivery sheet for courier
 */
exports.generateDeliverySheet = async (req, res) => {
  try {
    const { courierId } = req.params;

    const courier = await prisma.courier.findUnique({
      where: { id: parseInt(courierId) },
    });

    if (!courier) {
      return res.status(404).json({
        success: false,
        error: "الساعي غير موجود",
      });
    }

    // Get today's shipments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const shipments = await prisma.shipment.findMany({
      where: {
        courierId: parseInt(courierId),
        // We rely on update time as assignment timestamp (assignment updates shipment)
        updatedAt: {
          gte: today,
          lt: tomorrow,
        },
        shipmentStatus: "قيد التوصيل",
        isDeleted: false,
      },
      include: {
        receiver: true,
        merchant: true,
        items: true,
      },
      orderBy: { createdAt: "asc" },
    });

    res.render("couriers/delivery-sheet", {
      courier,
      shipments,
      date: today.toLocaleDateString("ar-SA"),
      count: shipments.length,
    });
  } catch (error) {
    console.error("Error generating delivery sheet:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get settlement data for courier (unsettled shipments only)
 */
exports.getCourierSettlement = async (req, res) => {
  try {
    const { courierId } = req.params;
    const { startDate, endDate } = req.query;

    const courier = await prisma.courier.findUnique({
      where: { id: parseInt(courierId) },
    });

    if (!courier) {
      return res.status(404).json({ success: false, error: "الساعي غير موجود" });
    }

    const where = {
      courierId: parseInt(courierId),
      isDeleted: false,
      isSettled: false,
    };

    if (startDate) where.updatedAt = { ...(where.updatedAt || {}), gte: new Date(startDate) };
    if (endDate)   where.updatedAt = { ...(where.updatedAt || {}), lte: new Date(endDate + "T23:59:59.999Z") };

    const shipments = await prisma.shipment.findMany({
      where,
      include: {
        receiver: { select: { fullName: true, phone1: true, governorate: true, city: true } },
        merchant: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Status groups
    const DELIVERED   = ["تم التوصيل"];
    const PARTIAL_EX  = ["تسليم جزئي", "استبدال"];
    const RETURNED    = ["مرتجع", "مرتجع للتاجر", "مرتجع للمستودع", "مرتجع جزئي", "مرتجع استبدال"];
    const STILL_OUT   = ["قيد التوصيل"];

    const groups = {
      delivered:  shipments.filter(s => DELIVERED.includes(s.shipmentStatus)),
      partialEx:  shipments.filter(s => PARTIAL_EX.includes(s.shipmentStatus)),
      returned:   shipments.filter(s => RETURNED.includes(s.shipmentStatus)),
      stillOut:   shipments.filter(s => STILL_OUT.includes(s.shipmentStatus)),
    };

    // Shipments that can be settled (everything except still-out)
    const settleable = [...groups.delivered, ...groups.partialEx, ...groups.returned];

    const feePerShipment = parseFloat(courier.deliveryFeePerShipment || 0);

    // Cash collected from customers = sum of deliveryCollectedAmount for completed shipments
    const totalCollected = settleable.reduce(
      (sum, s) => sum + parseFloat(s.deliveryCollectedAmount || 0), 0
    );
    // Courier earns a fee for each completed (non-still-out) shipment
    const courierEarnings = settleable.length * feePerShipment;
    const netHandover = totalCollected - courierEarnings;

    res.json({
      success: true,
      data: {
        courier,
        groups,
        stats: {
          total:       shipments.length,
          delivered:   groups.delivered.length,
          partialEx:   groups.partialEx.length,
          returned:    groups.returned.length,
          stillOut:    groups.stillOut.length,
          settleable:  settleable.length,
        },
        financial: {
          feePerShipment,
          totalCollected:  parseFloat(totalCollected.toFixed(2)),
          courierEarnings: parseFloat(courierEarnings.toFixed(2)),
          netHandover:     parseFloat(netHandover.toFixed(2)),
        },
      },
    });
  } catch (error) {
    console.error("Error getting settlement data:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Save & lock a courier settlement
 */
exports.saveSettlement = async (req, res) => {
  try {
    const { courierId } = req.params;
    const { startDate, endDate, notes } = req.body;

    const courier = await prisma.courier.findUnique({ where: { id: parseInt(courierId) } });
    if (!courier) return res.status(404).json({ success: false, error: "الساعي غير موجود" });

    const where = {
      courierId: parseInt(courierId),
      isDeleted: false,
      isSettled: false,
      shipmentStatus: {
        in: ["تم التوصيل", "تسليم جزئي", "استبدال",
             "مرتجع", "مرتجع للتاجر", "مرتجع للمستودع", "مرتجع جزئي", "مرتجع استبدال"],
      },
    };

    if (startDate) where.updatedAt = { ...(where.updatedAt || {}), gte: new Date(startDate) };
    if (endDate)   where.updatedAt = { ...(where.updatedAt || {}), lte: new Date(endDate + "T23:59:59.999Z") };

    const shipments = await prisma.shipment.findMany({ where, select: { id: true, deliveryCollectedAmount: true } });

    if (shipments.length === 0) {
      return res.json({ success: false, error: "لا توجد شحنات قابلة للتقفيل" });
    }

    const feePerShipment = parseFloat(courier.deliveryFeePerShipment || 0);
    const totalCollected  = shipments.reduce((sum, s) => sum + parseFloat(s.deliveryCollectedAmount || 0), 0);
    const courierEarnings = shipments.length * feePerShipment;
    const netHandover     = totalCollected - courierEarnings;

    const settlement = await prisma.$transaction(async (tx) => {
      const s = await tx.courierSettlement.create({
        data: {
          courierId:      parseInt(courierId),
          periodFrom:     startDate ? new Date(startDate) : new Date(),
          periodTo:       endDate   ? new Date(endDate + "T23:59:59.999Z") : new Date(),
          shipmentCount:  shipments.length,
          totalCollected: parseFloat(totalCollected.toFixed(2)),
          courierEarnings:parseFloat(courierEarnings.toFixed(2)),
          netHandover:    parseFloat(netHandover.toFixed(2)),
          notes:          notes || null,
          createdBy:      req.user?.id || null,
        },
      });

      await tx.shipment.updateMany({
        where: { id: { in: shipments.map(s => s.id) } },
        data: { isSettled: true, settlementId: s.id },
      });

      return s;
    });

    res.json({ success: true, message: "تم حفظ التقفيل بنجاح", settlement });
  } catch (error) {
    console.error("Error saving settlement:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get settlement history for a courier
 */
exports.getSettlementHistory = async (req, res) => {
  try {
    const { courierId } = req.params;
    const settlements = await prisma.courierSettlement.findMany({
      where: { courierId: parseInt(courierId) },
      include: { _count: { select: { shipments: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    res.json({ success: true, settlements });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
