const bcrypt = require("bcryptjs");
const prisma = require("../prisma/prismaClient");

exports.renderLogin = (req, res) => {
  if (req.session?.user) {
    return res.redirect("/dashboard");
  }

  return res.render("auth/login", {
    error: null,
    identifier: "",
  });
};

exports.login = async (req, res) => {
  try {
    const identifier = (req.body.identifier || "").trim();
    const password = req.body.password || "";

    if (!identifier || !password) {
      return res.status(400).render("auth/login", {
        error: "يرجى إدخال البريد/الهاتف وكلمة المرور",
        identifier,
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        isDeleted: false,
        OR: [{ email: identifier }, { phone: identifier }],
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        password: true,
      },
    });

    if (!user) {
      return res.status(401).render("auth/login", {
        error: "بيانات الدخول غير صحيحة",
        identifier,
      });
    }

    if (!user.isActive) {
      return res.status(403).render("auth/login", {
        error: "هذا الحساب غير مفعل",
        identifier,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).render("auth/login", {
        error: "بيانات الدخول غير صحيحة",
        identifier,
      });
    }

    req.session.user = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };

    return res.redirect("/dashboard");
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).render("auth/login", {
      error: "حدث خطأ أثناء تسجيل الدخول",
      identifier: req.body.identifier || "",
    });
  }
};

exports.renderResetPassword = (req, res) => {
  return res.render("auth/reset-password", {
    error: null,
    success: null,
  });
};

exports.resetPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.redirect("/auth/login");
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).render("auth/reset-password", {
        error: "جميع الحقول مطلوبة",
        success: null,
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).render("auth/reset-password", {
        error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل",
        success: null,
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).render("auth/reset-password", {
        error: "تأكيد كلمة المرور غير مطابق",
        success: null,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, isDeleted: true, isActive: true },
    });

    if (!user || user.isDeleted || !user.isActive) {
      return res.status(404).render("auth/reset-password", {
        error: "الحساب غير متاح",
        success: null,
      });
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentValid) {
      return res.status(400).render("auth/reset-password", {
        error: "كلمة المرور الحالية غير صحيحة",
        success: null,
      });
    }

    const isSameAsCurrent = await bcrypt.compare(newPassword, user.password);
    if (isSameAsCurrent) {
      return res.status(400).render("auth/reset-password", {
        error: "كلمة المرور الجديدة يجب أن تكون مختلفة",
        success: null,
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        lastModifiedBy: userId,
      },
    });

    await prisma.log.create({
      data: {
        action: "RESET_PASSWORD",
        entity: "User",
        entityId: userId,
        details: JSON.stringify({ source: "self_service" }),
        userId,
        ipAddress: req.ip,
      },
    });

    return res.render("auth/reset-password", {
      error: null,
      success: "تم تحديث كلمة المرور بنجاح",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).render("auth/reset-password", {
      error: "حدث خطأ أثناء تحديث كلمة المرور",
      success: null,
    });
  }
};

exports.signout = (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Signout error:", error);
      return res.redirect("/dashboard");
    }

    res.clearCookie("sid");
    return res.redirect("/auth/login");
  });
};
