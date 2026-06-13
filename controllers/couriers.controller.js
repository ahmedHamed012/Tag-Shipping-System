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

    // Validate: Status not "Cancelled"
    if (["Cancelled", "ملغى", "ملغاة"].includes(shipment.shipmentStatus)) {
      return res.status(400).json({
        success: false,
        error: "لا يمكن إسناد شحنة ملغاة",
      });
    }

    // Update shipment with courier and status
    const updated = await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        courierId: parseInt(courierId, 10),
        shipmentStatus: "Out for Delivery",
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
      shipmentStatus: { in: ["Out for Delivery", "في الطريق", "قيد التوصيل"] },
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
      // "Previous Shipments": assigned shipments that have not been returned to warehouse yet
      shipmentStatus: {
        notIn: [
          "Returned",
          "مرجوع",
          "Returned to Warehouse",
          "تم الإرجاع للمخزن",
        ],
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
        shipmentStatus: { in: ["Out for Delivery", "في الطريق"] },
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
 * Get settlement data for courier
 */
exports.getCourierSettlement = async (req, res) => {
  try {
    const { courierId } = req.params;
    const { startDate, endDate } = req.query;

    const courier = await prisma.courier.findUnique({
      where: { id: parseInt(courierId) },
    });

    if (!courier) {
      return res.status(404).json({
        success: false,
        error: "الساعي غير موجود",
      });
    }

    // Build date filter
    const where = {
      courierId: parseInt(courierId),
      isDeleted: false,
    };

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    // Get shipment statistics
    const shipments = await prisma.shipment.findMany({
      where,
      include: { merchant: true },
      orderBy: { createdAt: "desc" },
    });

    // Organize by status
    const shipmentsByStatus = {
      delivered: shipments.filter((s) => s.shipmentStatus === "Delivered"),
      outForDelivery: shipments.filter(
        (s) =>
          s.shipmentStatus === "Out for Delivery" ||
          s.shipmentStatus === "في الطريق",
      ),
      pending: shipments.filter((s) => s.shipmentStatus === "Pending"),
      returned: shipments.filter(
        (s) => s.shipmentStatus === "Returned" || s.shipmentStatus === "مرجوع",
      ),
    };

    // Calculate totals
    const stats = {
      totalShipments: shipments.length,
      delivered: shipmentsByStatus.delivered.length,
      pending: shipmentsByStatus.pending.length,
      outForDelivery: shipmentsByStatus.outForDelivery.length,
      totalAmount: shipments.reduce(
        (sum, s) => sum + parseFloat(s.totalAmount || 0),
        0,
      ),
      commissionAmount: shipments.reduce(
        (sum, s) => sum + parseFloat(s.commissionAmount || 0),
        0,
      ),
      netAmount: shipments.reduce(
        (sum, s) =>
          sum + parseFloat((s.totalAmount || 0) - (s.commissionAmount || 0)),
        0,
      ),
    };

    res.json({
      success: true,
      data: {
        courier,
        stats,
        shipments: shipmentsByStatus,
      },
    });
  } catch (error) {
    console.error("Error getting settlement data:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
