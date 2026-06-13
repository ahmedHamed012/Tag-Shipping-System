const bcrypt = require("bcryptjs");
const { validateUser } = require("../utils/validators");
const { parseUsersFromExcel } = require("../utils/excelUtils");

const prisma = require("../prisma/prismaClient");

/**
 * Get all users with pagination
 */
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";

    const skip = (page - 1) * limit;

    // Build where clause for search
    const where = {
      isDeleted: false,
      OR: [
        { fullName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ],
    };

    // Get total count
    const totalUsers = await prisma.user.count({ where });

    // Get paginated users
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        profilePicture: true,
        creator: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    const totalPages = Math.ceil(totalUsers / limit);
    console.log(users);
    res.render("users/index", {
      users,
      currentPage: page,
      totalPages,
      totalUsers,
      limit,
      search,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).render("error", { error: error.message });
  }
};

/**
 * Create new user
 */
exports.createUser = async (req, res) => {
  try {
    console.log("Received user creation request with data:", req.body);
    const { fullName, email, phone, address, nationalId, role, password } =
      req.body;

    // Validate input
    const validation = validateUser(
      { fullName, email, phone, nationalId, password, role },
      false,
    );
    if (!validation.isValid) {
      return res
        .status(400)
        .json({ success: false, errors: validation.errors });
    }

    // Check if email or phone already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }, { nationalId }],
        isDeleted: false,
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "البريد الإلكتروني أو رقم الهاتف أو رقم الهوية موجود بالفعل",
      });
    }

    // Process uploaded files
    const filePaths = {};
    if (req.files) {
      if (req.files.idCardFront && req.files.idCardFront[0]) {
        filePaths.idCardFront = "/uploads/" + req.files.idCardFront[0].filename;
      }
      if (req.files.idCardBack && req.files.idCardBack[0]) {
        filePaths.idCardBack = "/uploads/" + req.files.idCardBack[0].filename;
      }
      if (req.files.profilePicture && req.files.profilePicture[0]) {
        filePaths.profilePicture =
          "/uploads/" + req.files.profilePicture[0].filename;
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        fullName,
        email,
        phone,
        address: address || null,
        nationalId,
        password: hashedPassword,
        role: role || "OPERATION",
        idCardFront: filePaths.idCardFront || null,
        idCardBack: filePaths.idCardBack || null,
        profilePicture: filePaths.profilePicture || null,
        createdBy: req.user?.id || null,
      },
    });

    // Log the action
    await prisma.log.create({
      data: {
        action: "CREATE_USER",
        entity: "User",
        entityId: newUser.id,
        details: JSON.stringify({
          fullName,
          email,
          phone,
          role,
          hasAttachments: Object.keys(filePaths).length > 0,
        }),
        userId: req.user?.id || 1,
        ipAddress: req.ip,
      },
    });

    res.json({
      success: true,
      message: "تم إنشاء المستخدم بنجاح",
      user: newUser,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Update user
 */
exports.updateUser = async (req, res) => {
  try {
    console.log("Received user update request with data:", req.body);
    const { id } = req.params;
    const { fullName, email, phone, address, nationalId, role, password } =
      req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
    });

    if (!user || user.isDeleted) {
      return res
        .status(404)
        .json({ success: false, error: "المستخدم غير موجود" });
    }

    // Validate input
    const validation = validateUser(
      { fullName, email, phone, nationalId, password, role },
      true,
    );
    if (!validation.isValid) {
      return res
        .status(400)
        .json({ success: false, errors: validation.errors });
    }

    // Check for duplicate email/phone (exclude current user)
    const duplicateUser = await prisma.user.findFirst({
      where: {
        AND: [
          {
            OR: [{ email }, { phone }, { nationalId }],
          },
          { id: { not: parseInt(id) } },
        ],
        isDeleted: false,
      },
    });

    if (duplicateUser) {
      return res.status(400).json({
        success: false,
        error: "البريد الإلكتروني أو رقم الهاتف أو رقم الهوية مستخدم من قبل",
      });
    }

    // Process uploaded files
    const filePaths = {};
    if (req.files) {
      if (req.files.idCardFront && req.files.idCardFront[0]) {
        filePaths.idCardFront = "/uploads/" + req.files.idCardFront[0].filename;
      }
      if (req.files.idCardBack && req.files.idCardBack[0]) {
        filePaths.idCardBack = "/uploads/" + req.files.idCardBack[0].filename;
      }
      if (req.files.profilePicture && req.files.profilePicture[0]) {
        filePaths.profilePicture =
          "/uploads/" + req.files.profilePicture[0].filename;
      }
    }

    // Update data
    const updateData = {
      fullName,
      email,
      phone,
      address: address || null,
      nationalId,
      role,
      lastModifiedBy: req.user?.id || null,
    };

    // Add file paths if uploaded
    if (filePaths.idCardFront) updateData.idCardFront = filePaths.idCardFront;
    if (filePaths.idCardBack) updateData.idCardBack = filePaths.idCardBack;
    if (filePaths.profilePicture)
      updateData.profilePicture = filePaths.profilePicture;

    // Hash new password only if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    // Log the action
    await prisma.log.create({
      data: {
        action: "UPDATE_USER",
        entity: "User",
        entityId: parseInt(id),
        details: JSON.stringify({
          fullName,
          email,
          phone,
          role,
          passwordChanged: !!password,
          attachmentsUpdated: Object.keys(filePaths).length > 0,
        }),
        userId: req.user?.id || 1,
        ipAddress: req.ip,
      },
    });

    res.json({
      success: true,
      message: "تم تحديث المستخدم بنجاح",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Toggle user active status
 */
exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
    });

    if (!user || user.isDeleted) {
      return res
        .status(404)
        .json({ success: false, error: "المستخدم غير موجود" });
    }

    // Toggle status
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        isActive: !user.isActive,
        lastModifiedBy: req.user?.id || null,
      },
    });

    // Log the action
    await prisma.log.create({
      data: {
        action: "UPDATE_USER_STATUS",
        entity: "User",
        entityId: parseInt(id),
        details: JSON.stringify({
          previousStatus: user.isActive,
          newStatus: !user.isActive,
        }),
        userId: req.user?.id || 1,
        ipAddress: req.ip,
      },
    });

    res.json({
      success: true,
      message: updatedUser.isActive ? "تم تفعيل المستخدم" : "تم تعطيل المستخدم",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error toggling user status:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Delete user (soft delete)
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
    });

    if (!user || user.isDeleted) {
      return res
        .status(404)
        .json({ success: false, error: "المستخدم غير موجود" });
    }

    // Soft delete user
    const deletedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        isDeleted: true,
        lastModifiedBy: req.user?.id || null,
      },
    });

    // Log the action
    await prisma.log.create({
      data: {
        action: "DELETE_USER",
        entity: "User",
        entityId: parseInt(id),
        details: JSON.stringify({
          fullName: user.fullName,
          email: user.email,
        }),
        userId: req.user?.id || 1,
        ipAddress: req.ip,
      },
    });

    res.json({
      success: true,
      message: "تم حذف المستخدم بنجاح",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Bulk upload users from Excel
 */
exports.bulkUploadUsers = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "لم يتم تحميل ملف" });
    }

    // Parse Excel file
    const users = await parseUsersFromExcel(req.file.path);

    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        error: "الملف فارغ أو لا يحتوي على بيانات صحيحة",
      });
    }

    const results = {
      success: [],
      failed: [],
    };

    // Process each user
    for (const userData of users) {
      try {
        // Validate
        const validation = validateUser(userData, false);
        if (!validation.isValid) {
          results.failed.push({
            user: userData.email,
            errors: validation.errors,
          });
          continue;
        }

        // Check for duplicates
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [
              { email: userData.email },
              { phone: userData.phone },
              { nationalId: userData.nationalId },
            ],
            isDeleted: false,
          },
        });

        if (existingUser) {
          results.failed.push({
            user: userData.email,
            errors: ["البريد الإلكتروني أو رقم الهاتف أو الهوية موجود بالفعل"],
          });
          continue;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 10);

        // Create user
        const newUser = await prisma.user.create({
          data: {
            fullName: userData.fullName,
            email: userData.email,
            phone: userData.phone,
            address: userData.address || null,
            nationalId: userData.nationalId,
            password: hashedPassword,
            role: userData.role || "OPERATION",
            createdBy: req.user?.id || null,
          },
        });

        // Log
        await prisma.log.create({
          data: {
            action: "CREATE_USER",
            entity: "User",
            entityId: newUser.id,
            details: JSON.stringify({
              source: "bulk_upload",
              ...userData,
            }),
            userId: req.user?.id || 1,
            ipAddress: req.ip,
          },
        });

        results.success.push({
          user: userData.email,
          id: newUser.id,
        });
      } catch (error) {
        results.failed.push({
          user: userData.email,
          errors: [error.message],
        });
      }
    }

    res.json({
      success: true,
      message: `تم رفع ${results.success.length} مستخدم بنجاح`,
      results,
    });
  } catch (error) {
    console.error("Error uploading users:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get single user
 */
exports.getUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        address: true,
        nationalId: true,
        role: true,
        isActive: true,
        createdAt: true,
        idCardFront: true,
        idCardBack: true,
        profilePicture: true,
      },
    });

    if (!user || user.isDeleted) {
      return res
        .status(404)
        .json({ success: false, error: "المستخدم غير موجود" });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
