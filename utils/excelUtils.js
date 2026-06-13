const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

/**
 * Generate Excel template for bulk user upload
 * @returns {Buffer} Excel file buffer
 */
function generateUserTemplate() {
  const ws_data = [
    [
      "الاسم الكامل",
      "البريد الإلكتروني",
      "رقم الهاتف",
      "العنوان",
      "رقم الهوية الوطنية",
      "الدور",
      "الكلمة السرية",
    ],
    [
      "محمد أحمد",
      "user@example.com",
      "+966501234567",
      "الرياض، السعودية",
      "1234567890",
      "OPERATION",
      "Password123",
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(ws_data);

  // Set column widths
  ws["!cols"] = [
    { wch: 20 },
    { wch: 25 },
    { wch: 15 },
    { wch: 25 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
  ];

  // Add validation note
  const wsNotes = ws["!comments"] || {};
  wsNotes["A1"] = { a: "Admin", t: "يجب ملء جميع الحقول المطلوبة" };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "المستخدمين");

  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
}

function generateMerchantTemplate() {
  const ws_data = [
    [
      "اسم التاجر",
      "رقم الهاتف",
      "العنوان",
      "السجل التجاري",
      "البطاقة الضريبية",
      "الموقع الإلكتروني",
      "صفحة فيسبوك",
      "صفحة انستجرام",
      "الحد الاقصى للحمولة (كجم)",
      "رسوم الكيلو الزائد",
    ],
    [
      "تاجر تجريبي",
      "01000000000",
      "القاهرة",
      "CR-12345",
      "TAX-67890",
      "https://example.com",
      "https://facebook.com/example",
      "https://instagram.com/example",
      "25",
      "12.5",
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  ws["!cols"] = [
    { wch: 20 },
    { wch: 18 },
    { wch: 24 },
    { wch: 18 },
    { wch: 18 },
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
    { wch: 20 },
    { wch: 20 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "التجار");
  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
}

/**
 * Parse uploaded Excel file for users
 * @param {string} filePath - Path to uploaded Excel file
 * @returns {Promise<Array>} Array of user objects
 */
async function parseUsersFromExcel(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
    });

    // Skip header row
    const users = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      if (!row[0] || !row[1] || !row[2]) continue; // Skip empty rows

      users.push({
        fullName: row[0]?.toString().trim() || "",
        email: row[1]?.toString().trim() || "",
        phone: row[2]?.toString().trim() || "",
        address: row[3]?.toString().trim() || "",
        nationalId: row[4]?.toString().trim() || "",
        role: row[5]?.toString().trim() || "OPERATION",
        password: row[6]?.toString().trim() || "",
      });
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    return users;
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw new Error(`Failed to parse Excel file: ${error.message}`);
  }
}

async function parseMerchantsFromExcel(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
    });

    const merchants = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0] || !row[1] || !row[2]) continue;

      merchants.push({
        name: row[0]?.toString().trim() || "",
        phone: row[1]?.toString().trim() || "",
        address: row[2]?.toString().trim() || "",
        commercialRegister: row[3]?.toString().trim() || "",
        taxCard: row[4]?.toString().trim() || "",
        website: row[5]?.toString().trim() || "",
        facebookPage: row[6]?.toString().trim() || "",
        instagramPage: row[7]?.toString().trim() || "",
        maxShipmentWeight: row[8]?.toString().trim() || "",
        extraWeightFeePerKg: row[9]?.toString().trim() || "",
      });
    }

    fs.unlinkSync(filePath);
    return merchants;
  } catch (error) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw new Error(`Failed to parse merchant Excel file: ${error.message}`);
  }
}

/**
 * Generate Excel template for bulk upload of governorates and cities
 * @returns {Buffer} Excel file buffer
 */
function generateCountriesTemplate() {
  const ws_data = [
    [
      "اسم المحافظة (عربي)",
      "اسم المحافظة (English)",
      "اسم المدينة (عربي)",
      "اسم المدينة (English)",
    ],
    ["الرياض", "Riyadh", "الرياض", "Riyadh"],
    ["الرياض", "Riyadh", "حي النخيل", "Al-Nakheel"],
    ["جدة", "Jeddah", "جدة", "Jeddah"],
    ["جدة", "Jeddah", "حي الشرفية", "Al-Sharefia"],
  ];

  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  ws["!cols"] = [{ wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 25 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "المحافظات والمدن");
  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
}

/**
 * Parse uploaded Excel file for countries/governorates and cities
 * @param {string} filePath - Path to uploaded Excel file
 * @returns {Promise<Object>} Object with governorates array
 */
async function parseCountriesFromExcel(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
    });

    const governoratesMap = new Map();

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      const govNameAr = row[0]?.toString().trim();
      const govNameEn = row[1]?.toString().trim();
      const cityNameAr = row[2]?.toString().trim();
      const cityNameEn = row[3]?.toString().trim();

      if (!govNameAr || !cityNameAr) continue;

      if (!governoratesMap.has(govNameAr)) {
        governoratesMap.set(govNameAr, {
          nameAr: govNameAr,
          nameEn: govNameEn || null,
          cities: [],
        });
      }

      const gov = governoratesMap.get(govNameAr);
      if (cityNameAr) {
        gov.cities.push({
          nameAr: cityNameAr,
          nameEn: cityNameEn || null,
        });
      }
    }

    // Convert map to array
    const governorates = Array.from(governoratesMap.values());

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    return { governorates };
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw new Error(`Failed to parse countries Excel file: ${error.message}`);
  }
}

/**
 * Generate Excel template for bulk courier upload
 * @returns {Buffer} Excel file buffer
 */
function generateCourierTemplate() {
  const ws_data = [
    [
      "الاسم الكامل",
      "البريد الإلكتروني",
      "رقم الهاتف",
      "العنوان",
      "رقم الهوية الوطنية",
      "رقم رخصة القيادة",
    ],
    [
      "أحمد محمد",
      "ahmed@example.com",
      "+966501234567",
      "الرياض، حي النخيل",
      "1234567890",
      "9876543210",
    ],
    [
      "سارة علي",
      "sarah@example.com",
      "+966501234568",
      "جدة، حي الشرفية",
      "0987654321",
      "1122334455",
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  ws["!cols"] = [
    { wch: 20 },
    { wch: 25 },
    { wch: 18 },
    { wch: 25 },
    { wch: 18 },
    { wch: 18 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "الساعيون");
  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
}

/**
 * Parse uploaded Excel file for couriers
 * @param {string} filePath - Path to uploaded Excel file
 * @returns {Promise<Array>} Array of courier objects
 */
async function parseCouriersFromExcel(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
    });

    const couriers = [];

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      const fullName = row[0]?.toString().trim();
      const email = row[1]?.toString().trim();
      const phone = row[2]?.toString().trim();
      const address = row[3]?.toString().trim();
      const nationalId = row[4]?.toString().trim();
      const drivingLicense = row[5]?.toString().trim();

      if (!fullName || !phone) continue;

      couriers.push({
        fullName: fullName || "",
        email: email || "",
        phone: phone || "",
        address: address || "",
        nationalId: nationalId || "",
        drivingLicense: drivingLicense || "",
      });
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    return couriers;
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw new Error(`Failed to parse couriers Excel file: ${error.message}`);
  }
}

module.exports = {
  generateUserTemplate,
  parseUsersFromExcel,
  generateMerchantTemplate,
  parseMerchantsFromExcel,
  generateCountriesTemplate,
  parseCountriesFromExcel,
  generateCourierTemplate,
  parseCouriersFromExcel,
};
