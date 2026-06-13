const prisma = require("../prisma/prismaClient");
const { parseCountriesFromExcel } = require("../utils/excelUtils");

/**
 * Get all governorates with pagination and search
 */
exports.getAllGovernorates = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    const where = {
      isDeleted: false,
      OR: [{ nameAr: { contains: search } }, { nameEn: { contains: search } }],
    };

    const [governorates, total] = await Promise.all([
      prisma.governorate.findMany({
        where,
        include: {
          _count: { select: { cities: true } },
          creator: {
            select: { id: true, fullName: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.governorate.count({ where }),
    ]);

    res.render("countries/index", {
      governorates,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalGovernorates: total,
      limit,
      search,
    });
  } catch (error) {
    console.error("Error fetching governorates:", error);
    res.status(500).render("error", { error: error.message });
  }
};

/**
 * Get cities by governorate ID
 */
exports.getCitiesByGovernorate = async (req, res) => {
  try {
    const { governorateId } = req.params;

    const cities = await prisma.city.findMany({
      where: {
        governorateId,
        isDeleted: false,
      },
      orderBy: { nameAr: "asc" },
    });

    res.json({ success: true, cities });
  } catch (error) {
    console.error("Error fetching cities:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get all governorates (for dropdown)
 */
exports.getAllGovernoratesForDropdown = async (req, res) => {
  try {
    const governorates = await prisma.governorate.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
      },
      orderBy: { nameAr: "asc" },
    });

    res.json({ success: true, data: governorates });
  } catch (error) {
    console.error("Error fetching governorates:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Create new governorate
 */
exports.createGovernorate = async (req, res) => {
  try {
    const { nameAr, nameEn } = req.body;

    if (!nameAr || nameAr.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "اسم المحافظة بالعربية مطلوب",
      });
    }

    // Check if governorate already exists
    const existing = await prisma.governorate.findFirst({
      where: {
        nameAr: nameAr.trim(),
        isDeleted: false,
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "المحافظة موجودة بالفعل",
      });
    }

    const governorate = await prisma.governorate.create({
      data: {
        nameAr: nameAr.trim(),
        nameEn: nameEn?.trim() || null,
        createdBy: req.user?.id || null,
      },
      include: {
        _count: { select: { cities: true } },
        creator: {
          select: { id: true, fullName: true },
        },
      },
    });

    res.json({ success: true, data: governorate });
  } catch (error) {
    console.error("Error creating governorate:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Update governorate
 */
exports.updateGovernorate = async (req, res) => {
  try {
    const { id } = req.params;
    const { nameAr, nameEn } = req.body;

    if (!nameAr || nameAr.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "اسم المحافظة بالعربية مطلوب",
      });
    }

    // Check if another governorate with same name exists
    const existing = await prisma.governorate.findFirst({
      where: {
        nameAr: nameAr.trim(),
        id: { not: id },
        isDeleted: false,
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "المحافظة موجودة بالفعل",
      });
    }

    const governorate = await prisma.governorate.update({
      where: { id },
      data: {
        nameAr: nameAr.trim(),
        nameEn: nameEn?.trim() || null,
        updatedBy: req.user?.id || null,
      },
      include: {
        _count: { select: { cities: true } },
        creator: {
          select: { id: true, fullName: true },
        },
      },
    });

    res.json({ success: true, data: governorate });
  } catch (error) {
    console.error("Error updating governorate:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Delete governorate (soft delete)
 */
exports.deleteGovernorate = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.governorate.update({
      where: { id },
      data: { isDeleted: true },
    });

    res.json({ success: true, message: "تم حذف المحافظة بنجاح" });
  } catch (error) {
    console.error("Error deleting governorate:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Create new city
 */
exports.createCity = async (req, res) => {
  try {
    const { nameAr, nameEn, governorateId } = req.body;

    if (!nameAr || nameAr.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "اسم المدينة بالعربية مطلوب",
      });
    }

    if (!governorateId) {
      return res.status(400).json({
        success: false,
        error: "المحافظة مطلوبة",
      });
    }

    // Check if city already exists for this governorate
    const existing = await prisma.city.findFirst({
      where: {
        nameAr: nameAr.trim(),
        governorateId,
        isDeleted: false,
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "المدينة موجودة بالفعل في هذه المحافظة",
      });
    }

    const city = await prisma.city.create({
      data: {
        nameAr: nameAr.trim(),
        nameEn: nameEn?.trim() || null,
        governorateId,
        createdBy: req.user?.id || null,
      },
      include: {
        creator: {
          select: { id: true, fullName: true },
        },
      },
    });

    res.json({ success: true, data: city });
  } catch (error) {
    console.error("Error creating city:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Update city
 */
exports.updateCity = async (req, res) => {
  try {
    const { id } = req.params;
    const { nameAr, nameEn } = req.body;

    if (!nameAr || nameAr.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "اسم المدينة بالعربية مطلوب",
      });
    }

    const city = await prisma.city.update({
      where: { id },
      data: {
        nameAr: nameAr.trim(),
        nameEn: nameEn?.trim() || null,
        updatedBy: req.user?.id || null,
      },
      include: {
        creator: {
          select: { id: true, fullName: true },
        },
      },
    });

    res.json({ success: true, data: city });
  } catch (error) {
    console.error("Error updating city:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Delete city (soft delete)
 */
exports.deleteCity = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.city.update({
      where: { id },
      data: { isDeleted: true },
    });

    res.json({ success: true, message: "تم حذف المدينة بنجاح" });
  } catch (error) {
    console.error("Error deleting city:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Bulk upload governorates and cities from Excel
 */
exports.bulkUploadCountries = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "لم يتم اختيار ملف",
      });
    }

    const data = await parseCountriesFromExcel(req.file.path);

    if (!data.governorates || data.governorates.length === 0) {
      return res.status(400).json({
        success: false,
        error: "الملف لا يحتوي على بيانات صحيحة",
      });
    }

    const results = {
      governorates: { success: 0, failed: 0, errors: [] },
      cities: { success: 0, failed: 0, errors: [] },
      newGovernoratesAdded: [],
      newCitiesAdded: [],
    };

    const userId = req.user?.id || null;

    // Process governorates
    for (const gov of data.governorates) {
      try {
        // Check if governorate exists
        let governorate = await prisma.governorate.findFirst({
          where: {
            nameAr: gov.nameAr.trim(),
            isDeleted: false,
          },
        });

        if (!governorate) {
          // Create new governorate
          governorate = await prisma.governorate.create({
            data: {
              nameAr: gov.nameAr.trim(),
              nameEn: gov.nameEn?.trim() || null,
              createdBy: userId,
            },
          });
          results.newGovernoratesAdded.push(gov.nameAr);
          results.governorates.success++;
        } else {
          results.governorates.success++;
        }

        // Process cities for this governorate
        if (gov.cities && Array.isArray(gov.cities)) {
          for (const city of gov.cities) {
            try {
              const existingCity = await prisma.city.findFirst({
                where: {
                  nameAr: city.nameAr.trim(),
                  governorateId: governorate.id,
                  isDeleted: false,
                },
              });

              if (!existingCity) {
                await prisma.city.create({
                  data: {
                    nameAr: city.nameAr.trim(),
                    nameEn: city.nameEn?.trim() || null,
                    governorateId: governorate.id,
                    createdBy: userId,
                  },
                });
                results.newCitiesAdded.push(`${city.nameAr} - ${gov.nameAr}`);
                results.cities.success++;
              } else {
                results.cities.success++;
              }
            } catch (error) {
              results.cities.failed++;
              results.cities.errors.push(
                `فشل: ${city.nameAr} - ${error.message}`,
              );
            }
          }
        }
      } catch (error) {
        results.governorates.failed++;
        results.governorates.errors.push(
          `فشل: ${gov.nameAr} - ${error.message}`,
        );
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error("Error bulk uploading countries:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
