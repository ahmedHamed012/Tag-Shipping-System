# نظام إدارة الشحنات - وحدة المستخدمين

## 📋 نظرة عامة

وحدة شاملة لإدارة المستخدمين في نظام الشحنات تتضمن:

- ✅ إضافة/تعديل/حذف المستخدمين
- ✅ عرض جميع المستخدمين بجدول مع البحث والترتيب حسب الأحدث
- ✅ تفعيل/تعطيل حالة المستخدم
- ✅ رفع مستخدمين من ملفات Excel
- ✅ تحميل قالب Excel
- ✅ نظام كامل للسجلات (Logs)

---

## 🚀 الإعداد والتثبيت

### 1. تثبيت الحزم

```bash
npm install
```

### 2. إعداد متغيرات البيئة

انسخ `.env.example` إلى `.env` وعدل القيم:

```bash
cp .env.example .env
```

ثم عدل قيمة `DATABASE_URL` لتناسب بيانات قاعدة بيانات SQL Server الخاصة بك:

```
DATABASE_URL="mssql://user:password@localhost:1433/shipping_system"
```

### 3. إنشاء قاعدة البيانات والجداول

```bash
npx prisma migrate dev --name init
```

### 4. تشغيل الخادم

```bash
node app.js
```

الخادم سيعمل على: `http://localhost:3000`

---

## 📁 هيكل المشروع

```
├── app.js                           # ملف التطبيق الرئيسي
├── package.json                     # الحزم والتبعيات
├── .env.example                     # متغيرات البيئة (مثال)
│
├── prisma/
│   ├── schema.prisma               # نموذج قاعدة البيانات
│   └── migrations/                 # سجلات الهجرات
│
├── controllers/
│   └── users.controller.js         # منطق المستخدمين
│
├── routes/
│   └── users.routes.js             # مسارات API
│
├── utils/
│   ├── excelUtils.js               # وظائف Excel
│   └── validators.js               # التحقق من الصحة
│
├── views/
│   ├── layouts/
│   │   └── layout.pug              # التخطيط الرئيسي
│   ├── users/
│   │   ├── index.pug               # قائمة المستخدمين
│   │   ├── _formModal.pug          # نموذج الإضافة/التعديل
│   │   └── _uploadExcelModal.pug   # نموذج رفع Excel
│   └── error.pug                   # صفحة الخطأ
│
├── public/
│   ├── css/                        # ملفات CSS المترجمة
│   ├── scss/                       # ملفات SCSS
│   ├── js/                         # ملفات JavaScript
│   ├── imgs/                       # الصور
│   └── uploads/                    # ملفات Excel المرفوعة
```

---

## 🎯 الميزات والوظائف

### 1. عرض جميع المستخدمين

- جدول يعرض جميع المستخدمين النشطين (غير المحذوفين)
- الترتيب حسب الأحدث أولاً
- البحث حسب الاسم أو البريد الإلكتروني أو الهاتف
- تقسيم صفحات قابل للتخصيص

**الرابط:** `GET /users`

### 2. إضافة مستخدم جديد

نموذج يتضمن الحقول:

- الاسم الكامل (مطلوب)
- البريد الإلكتروني (مطلوب، فريد)
- رقم الهاتف (مطلوب، فريد)
- رقم الهوية الوطنية (مطلوب، فريد)
- العنوان (اختياري)
- الدور: إدارة / خدمة العملاء / عمليات
- الكلمة السرية (مطلوبة)

**API:** `POST /users/api/create`

### 3. تعديل المستخدم

تعديل جميع بيانات المستخدم

- الكلمة السرية: اختيارية (اتركها فارغة للاحتفاظ بالحالية)

**API:** `POST /users/api/update/:id`

### 4. تفعيل/تعطيل المستخدم

تبديل حالة المستخدم (نشط/معطل) دون حذفه

**API:** `POST /users/api/toggle-status/:id`

### 5. حذف المستخدم (Soft Delete)

حذف آمن لا يحذف البيانات من قاعدة البيانات بل يضع الحقل `isDeleted = true`

**API:** `DELETE /users/api/delete/:id`

### 6. رفع Excel

رفع ملف Excel يحتوي على عدة مستخدمين للإضافة بالجملة

- التحقق من صحة كل سجل
- إظهار نتائج الرفع (النجاح والفشل)

**API:** `POST /users/api/bulk-upload`

### 7. تحميل قالب Excel

تحميل ملف قالب Excel يحتوي على الأعمدة الصحيحة وصف توضيحي

**API:** `GET /users/api/download-template`

---

## 📊 نموذج البيانات

### User Model

```prisma
model User {
  id                Int      @id @default(autoincrement())
  fullName          String
  email             String   @unique
  phone             String   @unique
  address           String?
  nationalId        String   @unique
  idCardFront       String?
  idCardBack        String?
  profilePicture    String?
  password          String
  role              String   @default("Admin")
  isActive          Boolean  @default(true)
  isDeleted         Boolean  @default(false)

  createdAt         DateTime @default(now())
  createdBy         Int?
  creator           User?    @relation("UserCreatedBy", ...)
  updatedAt         DateTime @updatedAt
  lastModifiedBy    Int?
  lastModifier      User?    @relation("UserModifiedBy", ...)

  logs              Log[]    @relation("UserLogs")
  createdUsers      User[]   @relation("UserCreatedBy")
  modifiedUsers     User[]   @relation("UserModifiedBy")
}
```

### Log Model

```prisma
model Log {
  id        Int      @id @default(autoincrement())
  action    String   // CREATE_USER, UPDATE_USER, DELETE_USER, etc.
  entity    String   // الجدول المتأثر
  entityId  Int      // رقم السجل
  details   String?  // تفاصيل JSON

  userId    Int
  user      User     @relation("UserLogs", ...)

  ipAddress String?
  createdAt DateTime @default(now())
}
```

---

## 🔐 التحقق من الصحة

جميع المدخلات يتم التحقق منها على الخادم:

| الحقل             | القيد                    |
| ----------------- | ------------------------ |
| الاسم الكامل      | ≥ 3 أحرف                 |
| البريد الإلكتروني | صيغة بريد إلكتروني صحيحة |
| رقم الهاتف        | صيغة هاتف صحيحة          |
| رقم الهوية        | ≥ 10 أحرف                |
| الكلمة السرية     | ≥ 6 أحرف (الإضافة فقط)   |

---

## 📤 صيغة ملف Excel للرفع

الأعمدة المطلوبة بالترتيب:

| الاسم الكامل | البريد الإلكتروني | رقم الهاتف    | العنوان | رقم الهوية | الدور     | الكلمة السرية |
| ------------ | ----------------- | ------------- | ------- | ---------- | --------- | ------------- |
| محمد أحمد    | user@example.com  | +966501234567 | الرياض  | 1234567890 | OPERATION | Pass123       |

**الدور المتاح:**

- `ADMIN` - إدارة
- `CUSTOMER_SERVICE` - خدمة العملاء
- `OPERATION` - عمليات

---

## 🔄 سجلات الأنشطة (Logs)

جميع العمليات يتم تسجيلها في جدول `Log`:

- **CREATE_USER** - إضافة مستخدم جديد
- **UPDATE_USER** - تعديل المستخدم
- **UPDATE_USER_STATUS** - تغيير الحالة
- **DELETE_USER** - حذف المستخدم

---

## 🛠️ التطوير

### تشغيل مع Nodemon (لتطوير أسرع)

```bash
npm install --save-dev nodemon
npx nodemon app.js
```

### إضافة ملفات SCSS جديدة

ضع ملفات SCSS في `public/scss/` سيتم تحويلها تلقائياً إلى CSS

### تشخيص قاعدة البيانات

```bash
npx prisma studio
```

---

## ⚠️ الأخطاء الشائعة

### خطأ الاتصال بقاعدة البيانات

تأكد من:

- قيمة `DATABASE_URL` صحيحة
- SQL Server قيد التشغيل
- سماح الاتصالات من التطبيق

### خطأ تحميل الملفات

- تأكد من أن مجلد `public/uploads` موجود وقابل للكتابة
- حجم الملف لا يتجاوز 5MB
- صيغة الملف xlsx أو xls

### مشكلة في البحث

- تأكد من استخدام UTF-8 في قاعدة البيانات

---

## 📝 الترخيص

جميع الحقوق محفوظة لنظام الشحنات © 2026

---

## 📞 الدعم

للمساعدة أو الإبلاغ عن مشاكل، يرجى التواصل مع فريق التطوير.
# Tag-Shipping-System
