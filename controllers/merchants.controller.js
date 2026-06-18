const prisma = require("../prisma/prismaClient");
const { parseMerchantsFromExcel } = require("../utils/excelUtils");

async function generateUniqueIdentifier() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let identifier;
  let exists = true;
  while (exists) {
    identifier = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const found = await prisma.merchant.findUnique({ where: { identifier } });
    exists = !!found;
  }
  return identifier;
}

const toDecimalOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

exports.getAllMerchants = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    const where = {
      isDeleted: false,
      OR: [
        { name: { contains: search } },
        { phone: { contains: search } },
        { address: { contains: search } },
      ],
    };

    const totalMerchants = await prisma.merchant.count({ where });
    const merchants = await prisma.merchant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        _count: {
          select: {
            priceList: true,
          },
        },
      },
    });

    res.render("merchants/index", {
      merchants,
      currentPage: page,
      totalPages: Math.ceil(totalMerchants / limit),
      totalMerchants,
      limit,
      search,
    });
  } catch (error) {
    console.error("Error fetching merchants:", error);
    res.status(500).render("error", { error: error.message });
  }
};

exports.getCreateMerchantPage = async (req, res) => {
  res.render("merchants/create");
};

exports.createMerchant = async (req, res) => {
  try {
    const {
      name,
      phone,
      address,
      commercialRegister,
      taxCard,
      website,
      facebookPage,
      instagramPage,
      maxShipmentWeight,
      extraWeightFeePerKg,
      priceList,
    } = req.body;

    if (!name || !phone || !address) {
      return res.status(400).json({
        success: false,
        error: "الاسم ورقم الهاتف والعنوان حقول مطلوبة",
      });
    }

    const existing = await prisma.merchant.findFirst({
      where: { phone, isDeleted: false },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "رقم الهاتف مستخدم بالفعل",
      });
    }

    let parsedPriceList = [];
    if (Array.isArray(priceList)) {
      parsedPriceList = priceList;
    } else if (typeof priceList === "string" && priceList.trim() !== "") {
      parsedPriceList = JSON.parse(priceList);
    }

    const cleanPriceList = parsedPriceList
      .filter(
        (item) =>
          item.governorate &&
          item.city &&
          item.shipmentStatus &&
          item.price !== undefined &&
          item.price !== null &&
          item.price !== "",
      )
      .map((item) => ({
        governorate: item.governorate,
        city: item.city,
        shipmentStatus: item.shipmentStatus,
        price: Number(item.price),
      }))
      .filter((item) => !Number.isNaN(item.price));

    const attachments = (req.files || []).map((file) => ({
      fileName: file.originalname,
      fileUrl: "/uploads/" + file.filename,
      mimeType: file.mimetype || null,
    }));

    const identifier = await generateUniqueIdentifier();

    const merchant = await prisma.merchant.create({
      data: {
        identifier,
        name,
        phone,
        address,
        commercialRegister: commercialRegister || null,
        taxCard: taxCard || null,
        website: website || null,
        facebookPage: facebookPage || null,
        instagramPage: instagramPage || null,
        maxShipmentWeight: toDecimalOrNull(maxShipmentWeight),
        extraWeightFeePerKg: toDecimalOrNull(extraWeightFeePerKg),
        createdBy: req.user?.id || null,
        priceList: {
          create: cleanPriceList,
        },
        attachments: {
          create: attachments,
        },
      },
      include: {
        priceList: true,
        attachments: true,
      },
    });

    res.json({
      success: true,
      message: "تم إنشاء التاجر بنجاح",
      merchant,
    });
  } catch (error) {
    console.error("Error creating merchant:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getMerchant = async (req, res) => {
  try {
    const { id } = req.params;

    const merchant = await prisma.merchant.findUnique({
      where: { id },
      include: {
        priceList: true,
      },
    });

    if (!merchant || merchant.isDeleted) {
      return res.status(404).json({
        success: false,
        error: "التاجر غير موجود",
      });
    }

    res.json({ success: true, merchant });
  } catch (error) {
    console.error("Error fetching merchant:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateMerchant = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      phone,
      address,
      commercialRegister,
      taxCard,
      website,
      facebookPage,
      instagramPage,
      maxShipmentWeight,
      extraWeightFeePerKg,
    } = req.body;

    const merchant = await prisma.merchant.findUnique({ where: { id } });
    if (!merchant || merchant.isDeleted) {
      return res.status(404).json({ success: false, error: "التاجر غير موجود" });
    }

    const duplicate = await prisma.merchant.findFirst({
      where: {
        phone,
        id: { not: id },
        isDeleted: false,
      },
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        error: "رقم الهاتف مستخدم من قبل تاجر آخر",
      });
    }

    const newAttachments = (req.files || []).map((file) => ({
      fileName: file.originalname,
      fileUrl: "/uploads/" + file.filename,
      mimeType: file.mimetype || null,
    }));

    const updated = await prisma.merchant.update({
      where: { id },
      data: {
        name,
        phone,
        address,
        commercialRegister: commercialRegister || null,
        taxCard: taxCard || null,
        website: website || null,
        facebookPage: facebookPage || null,
        instagramPage: instagramPage || null,
        maxShipmentWeight: toDecimalOrNull(maxShipmentWeight),
        extraWeightFeePerKg: toDecimalOrNull(extraWeightFeePerKg),
        updatedBy: req.user?.id || null,
        attachments: newAttachments.length > 0 ? { create: newAttachments } : undefined,
      },
      include: { attachments: true },
    });

    res.json({
      success: true,
      message: "تم تحديث بيانات التاجر بنجاح",
      merchant: updated,
    });
  } catch (error) {
    console.error("Error updating merchant:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.toggleMerchantStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const merchant = await prisma.merchant.findUnique({ where: { id } });
    if (!merchant || merchant.isDeleted) {
      return res.status(404).json({ success: false, error: "التاجر غير موجود" });
    }

    const updated = await prisma.merchant.update({
      where: { id },
      data: {
        isActive: !merchant.isActive,
        updatedBy: req.user?.id || null,
      },
    });

    res.json({
      success: true,
      message: updated.isActive ? "تم تفعيل التاجر" : "تم تعطيل التاجر",
      merchant: updated,
    });
  } catch (error) {
    console.error("Error toggling merchant:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteMerchant = async (req, res) => {
  try {
    const { id } = req.params;
    const merchant = await prisma.merchant.findUnique({ where: { id } });

    if (!merchant || merchant.isDeleted) {
      return res.status(404).json({ success: false, error: "التاجر غير موجود" });
    }

    await prisma.merchant.update({
      where: { id },
      data: {
        isDeleted: true,
        updatedBy: req.user?.id || null,
      },
    });

    res.json({ success: true, message: "تم حذف التاجر بنجاح" });
  } catch (error) {
    console.error("Error deleting merchant:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.bulkUploadMerchants = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "لم يتم تحميل ملف" });
    }

    const merchants = await parseMerchantsFromExcel(req.file.path);
    if (merchants.length === 0) {
      return res.status(400).json({
        success: false,
        error: "الملف فارغ أو لا يحتوي على بيانات صحيحة",
      });
    }

    const results = { success: [], failed: [] };
    for (const merchantData of merchants) {
      try {
        if (!merchantData.name || !merchantData.phone || !merchantData.address) {
          results.failed.push({
            merchant: merchantData.name || merchantData.phone || "غير محدد",
            errors: ["الاسم ورقم الهاتف والعنوان حقول مطلوبة"],
          });
          continue;
        }

        const existing = await prisma.merchant.findFirst({
          where: { phone: merchantData.phone, isDeleted: false },
        });
        if (existing) {
          results.failed.push({
            merchant: merchantData.phone,
            errors: ["رقم الهاتف موجود بالفعل"],
          });
          continue;
        }

        const bulkIdentifier = await generateUniqueIdentifier();
        const created = await prisma.merchant.create({
          data: {
            identifier: bulkIdentifier,
            name: merchantData.name,
            phone: merchantData.phone,
            address: merchantData.address,
            commercialRegister: merchantData.commercialRegister || null,
            taxCard: merchantData.taxCard || null,
            website: merchantData.website || null,
            facebookPage: merchantData.facebookPage || null,
            instagramPage: merchantData.instagramPage || null,
            maxShipmentWeight: toDecimalOrNull(merchantData.maxShipmentWeight),
            extraWeightFeePerKg: toDecimalOrNull(merchantData.extraWeightFeePerKg),
            createdBy: req.user?.id || null,
          },
        });

        results.success.push({ merchant: created.name, id: created.id });
      } catch (error) {
        results.failed.push({
          merchant: merchantData.phone || merchantData.name || "غير محدد",
          errors: [error.message],
        });
      }
    }

    return res.json({
      success: true,
      message: `تم رفع ${results.success.length} تاجر بنجاح`,
      results,
    });
  } catch (error) {
    console.error("Error uploading merchants:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateMerchantPriceList = async (req, res) => {
  try {
    const { id } = req.params;
    const { priceList } = req.body;

    const merchant = await prisma.merchant.findUnique({ where: { id } });
    if (!merchant || merchant.isDeleted) {
      return res.status(404).json({ success: false, error: "التاجر غير موجود" });
    }

    const parsedPriceList = Array.isArray(priceList) ? priceList : [];
    const cleanPriceList = parsedPriceList
      .filter(
        (item) =>
          item.governorate &&
          item.city &&
          item.shipmentStatus &&
          item.price !== undefined &&
          item.price !== null &&
          item.price !== "",
      )
      .map((item) => ({
        governorate: item.governorate,
        city: item.city,
        shipmentStatus: item.shipmentStatus,
        price: Number(item.price),
      }))
      .filter((item) => !Number.isNaN(item.price));

    await prisma.$transaction([
      prisma.merchantPrice.deleteMany({ where: { merchantId: id } }),
      prisma.merchantPrice.createMany({
        data: cleanPriceList.map((item) => ({ ...item, merchantId: id })),
      }),
    ]);

    return res.json({
      success: true,
      message: "تم تحديث قائمة أسعار التاجر بنجاح",
    });
  } catch (error) {
    console.error("Error updating merchant price list:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
