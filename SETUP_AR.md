# 🔧 دليل الإعداد الفني - نظام إدارة الشحنات

> دليل شامل لإعداد وتشغيل نظام إدارة الشحنات بنجاح

---

## 📋 المتطلبات الأساسية

قبل البدء، تأكد من توفر:

- **Node.js** v16 أو أحدث ([تحميل](https://nodejs.org/))
- **SQL Server** 2017 أو أحدث (أو Azure SQL)
- **npm** أو **yarn** (يأتي مع Node.js)
- محرر نصوص مثل VS Code

---

## 🚀 خطوات الإعداد

### 1️⃣ استنساخ/فتح المشروع

```bash
cd "e:\Shipping System"
```

### 2️⃣ تثبيت الحزم

```bash
npm install
```

هذا سيقوم بتثبيت جميع التبعيات:

- `express` - إطار العمل الويب
- `pug` - محرك القوالب
- `@prisma/client` - ORM لقاعدة البيانات
- `bcryptjs` - تشفير كلمات المرور
- `multer` - معالجة تحميل الملفات
- `xlsx` - قراءة/كتابة ملفات Excel
- وغيرها...

### 3️⃣ إعداد متغيرات البيئة

#### الخطوة أ: إنشاء ملف `.env`

انسخ المحتوى من `.env.example`:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# أو يدويًا: اعتمد على .env.example وغيّره
```

#### الخطوة ب: تكوين قاعدة البيانات

عدّل `.env` لإضافة اتصال SQL Server:

```env
# أمثلة اتصالات SQL Server

# محلي (Local)
DATABASE_URL="mssql://sa:YOUR_PASSWORD@localhost:1433/shipping_system"

# Azure SQL
DATABASE_URL="mssql://username:password@server.database.windows.net:1433/shipping_system?encrypt=true&trustServerCertificate=false&connection Timeout=30"

# مع Windows Authentication
DATABASE_URL="mssql://localhost/shipping_system?integratedSecurity=true&trustServerCertificate=true"
```

**اختبار الاتصال:**

```bash
npx prisma db push
```

### 4️⃣ إنشاء قاعدة البيانات والجداول

#### الخيار أ: استخدام Migrations (موصى به)

```bash
# إنشاء أول migration
npx prisma migrate dev --name init

# يسأل عن اسم الـ Migration، أدخل "init" أو أي اسم آخر
```

#### الخيار ب: مزامنة مباشرة

```bash
npx prisma db push
```

### 5️⃣ ملء البيانات الأولية (اختياري)

```bash
npm run seed
```

هذا سينشئ:

- مستخدم واحد Admin
- مستخدمين من أقسام مختلفة
- بيانات تجريبية

**بيانات الدخول الافتراضية:**

```
البريد: admin@shipping.com
الكلمة السرية: Admin@123
```

### 6️⃣ تشغيل الخادم

#### للإنتاج:

```bash
npm start
```

#### للتطوير (مع إعادة تحميل تلقائية):

```bash
npm run dev
```

ستظهر الرسالة:

```
Server running on port 3000
```

### 7️⃣ فتح التطبيق

افتح المتصفح وانتقل إلى:

```
http://localhost:3000
```

---

## 📊 التحقق من الإعداد

### التحقق من الاتصال بقاعدة البيانات

```bash
npx prisma studio
```

سيفتح واجهة رسومية لعرض بيانات قاعدة البيانات على:

```
http://localhost:5555
```

### اختبار API

استخدم Postman أو curl:

```bash
# الحصول على جميع المستخدمين
curl http://localhost:3000/users

# إنشاء مستخدم جديد
curl -X POST http://localhost:3000/users/api/create \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "محمد أحمد",
    "email": "user@example.com",
    "phone": "+966501234567",
    "nationalId": "1234567890",
    "role": "OPERATION",
    "password": "Password123"
  }'
```

---

## 🗄️ أساسيات قاعدة البيانات

### عرض جميع الجداول

```bash
npx prisma studio
```

### عرض التاريخ

```bash
# Windows (SSMS أو PowerShell)
SELECT * FROM [dbo].[User]
SELECT * FROM [dbo].[Log]
```

### حذف وإعادة تعيين البيانات

```bash
# حذف جميع البيانات
npx prisma migrate reset

# أو يدويًا في SQL Server
TRUNCATE TABLE [dbo].[Log]
TRUNCATE TABLE [dbo].[User]
```

---

## 🔍 استكشاف الأخطاء

### مشكلة: "خطأ الاتصال بقاعدة البيانات"

**الحل:**

```bash
# تحقق من صيغة DATABASE_URL
echo %DATABASE_URL%

# تأكد من تشغيل SQL Server
# ابدأ SQL Server مثل:
# - SQL Server Management Studio (SSMS)
# - أو من خدمات Windows
# - أو Docker إذا كان مثبتًا
```

### مشكلة: "وحدة مفقودة"

```bash
# إعادة تثبيت الحزم مع حذف package-lock.json
rm package-lock.json
npm install
```

### مشكلة: "خطأ في تحميل الملف"

```bash
# تأكد من وجود مجلد uploads
mkdir -p public/uploads

# تأكد من الأذونات على Windows
icacls "public/uploads" /grant:r "%USERNAME%:F"
```

### مشكلة: "Prisma Client لم يتم التوليد"

```bash
# أعد توليد Prisma Client
npx prisma generate
```

---

## 📦 نموذج البيانات (الجداول الأولية)

### جدول User

```sql
CREATE TABLE [dbo].[User] (
  id INT PRIMARY KEY IDENTITY(1,1),
  fullName NVARCHAR(255) NOT NULL,
  email NVARCHAR(255) UNIQUE NOT NULL,
  phone NVARCHAR(20) UNIQUE NOT NULL,
  address NVARCHAR(500),
  nationalId NVARCHAR(50) UNIQUE NOT NULL,
  password NVARCHAR(255) NOT NULL,
  role NVARCHAR(50) DEFAULT 'OPERATION',
  isActive BIT DEFAULT 1,
  isDeleted BIT DEFAULT 0,
  createdAt DATETIME DEFAULT GETDATE(),
  createdBy INT,
  updatedAt DATETIME,
  lastModifiedBy INT,
  ...
)
```

### جدول Log

```sql
CREATE TABLE [dbo].[Log] (
  id INT PRIMARY KEY IDENTITY(1,1),
  action NVARCHAR(100),
  entity NVARCHAR(100),
  entityId INT,
  details NVARCHAR(MAX),
  userId INT NOT NULL,
  ipAddress NVARCHAR(50),
  createdAt DATETIME DEFAULT GETDATE(),
  FOREIGN KEY (userId) REFERENCES [User](id)
)
```

---

## 🛠️ الأوامر المفيدة

```bash
# تثبيت الحزم
npm install

# تشغيل بيئة التطوير
npm run dev

# تشغيل الإنتاج
npm start

# تشغيل الـ seed
npm run seed

# فتح Prisma Studio
npx prisma studio

# عرض status الـ Migrations
npx prisma migrate status

# إعادة تعيين قاعدة البيانات
npx prisma migrate reset

# توليد Prisma Client
npx prisma generate

# فتح الـ schema في محرر بصري
npx prisma studio
```

---

## 🔐 الأمان

### نصائح أمان أساسية:

1. **كلمات المرور:**
   - تُُشفر باستخدام bcryptjs
   - لا تُُخزن بصيغة نصية عادية

2. **متغيرات البيئة:**
   - لا تحفظ `.env` في git
   - استخدم `.env.example` للمثال

3. **معلومات حساسة:**
   - غير كلمات المرور الافتراضية
   - استخدم كلمات مرور قوية

---

## 🚀 الخطوات التالية

بعد الإعداد الناجح:

1. ✅ تشغيل نظام المستخدمين الأساسي
2. 🔐 إضافة نظام المصادقة (Authentication)
3. 🎯 بناء وحدات أخرى (الشحنات، المندوبين، إلخ)
4. 🧪 إضافة الاختبارات
5. 📈 تحسين الأداء

---

## 📞 التواصل والدعم

للمساعدة والاستفسارات، يرجى التواصل مع فريق التطوير.

---

**آخر تحديث:** 2026-05-07  
**الإصدار:** 1.0.0
