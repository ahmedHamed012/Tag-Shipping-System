/**
 * Seed script to populate initial database data
 * Run with: node prisma/seed.js
 */

const bcrypt = require("bcryptjs");

const prisma = require("../prisma/prismaClient");

async function main() {
  console.log("🌱 Starting database seed...");

  try {
    const adminEmail = process.env.MAIN_ADMIN_EMAIL || "admin@shipping.com";
    const adminPassword = process.env.MAIN_ADMIN_PASSWORD || "Admin@123";
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: adminEmail },
          { phone: "+966501234567" },
          { nationalId: "1234567890" },
        ],
      },
    });

    let adminUser;

    if (existingUser) {
      adminUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          fullName: "Main Admin",
          email: adminEmail,
          password: hashedPassword,
          role: "ADMIN",
          isActive: true,
          isDeleted: false,
        },
      });
    } else {
      adminUser = await prisma.user.create({
        data: {
          fullName: "Main Admin",
          email: adminEmail,
          phone: "+966501234567",
          nationalId: "1234567890",
          address: "الرياض، السعودية",
          password: hashedPassword,
          role: "ADMIN",
          isActive: true,
          isDeleted: false,
        },
      });
    }

    await prisma.log.create({
      data: {
        action: "SEED_MAIN_ADMIN",
        entity: "User",
        entityId: adminUser.id,
        details: JSON.stringify({
          fullName: adminUser.fullName,
          email: adminUser.email,
          role: "ADMIN",
        }),
        userId: adminUser.id,
        ipAddress: "127.0.0.1",
      },
    });

    console.log("✓ Main admin account is ready");
    console.log("✅ Database seed completed successfully!");
    console.log("\n🔑 Test credentials:");
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
