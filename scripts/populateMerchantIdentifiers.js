const prisma = require("../prisma/prismaClient");

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";

function randomIdentifier() {
  return Array.from({ length: 4 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
}

async function main() {
  const merchants = await prisma.merchant.findMany({
    where: { identifier: null },
    select: { id: true },
  });

  console.log(`Found ${merchants.length} merchants without identifier`);

  const usedIdentifiers = new Set(
    (await prisma.merchant.findMany({ where: { identifier: { not: null } }, select: { identifier: true } }))
      .map((m) => m.identifier)
  );

  for (const { id } of merchants) {
    let identifier;
    do {
      identifier = randomIdentifier();
    } while (usedIdentifiers.has(identifier));
    usedIdentifiers.add(identifier);

    await prisma.merchant.update({ where: { id }, data: { identifier } });
    console.log(`Set identifier ${identifier} for merchant ${id}`);
  }

  console.log("Done.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
