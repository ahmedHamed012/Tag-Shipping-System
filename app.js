const express = require("express");
const path = require("path");
const sassMiddleware = require("sass-middleware");
const session = require("express-session");
require("dotenv").config();
const { attachAuthUser, requireAuth } = require("./middleware/auth.middleware");

const app = express();

// ─────── MIDDLEWARE ───────

// إعداد SCSS Middleware
app.use(
  sassMiddleware({
    src: path.join(__dirname, "public/scss"),
    dest: path.join(__dirname, "public/css"),
    debug: true,
    outputStyle: "compressed",
    prefix: "/css",
  }),
);

// Body Parser & URL Encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.set("view engine", "pug");
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    name: "sid",
    secret: process.env.SESSION_SECRET || "shipping-system-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

app.use(attachAuthUser);

// ─────── ROUTES ───────

const authRoutes = require("./routes/auth.routes");
app.use("/auth", authRoutes);

const appInfoRoutes = require("./routes/app-info.routes");
app.use("/app-info", appInfoRoutes);

// Home page
app.get("/", (req, res) => {
  if (req.session?.user) {
    return res.redirect("/dashboard");
  }
  return res.redirect("/auth/login");
});

app.get("/dashboard", requireAuth, (req, res) => res.render("layouts/layout"));
app.get("/logout", requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("sid");
    res.redirect("/auth/login");
  });
});

// Users module routes
const usersRoutes = require("./routes/users.routes");
app.use("/users", requireAuth, usersRoutes);

// Merchants module routes
const merchantsRoutes = require("./routes/merchants.routes");
app.use("/merchants", requireAuth, merchantsRoutes);

// Shipments module routes
const shipmentsRoutes = require("./routes/shipments.routes");
app.use("/shipments", requireAuth, shipmentsRoutes);

// Returned shipments page
const { getReturnedShipments } = require("./controllers/shipments.controller");
app.get("/returned-shipments", requireAuth, getReturnedShipments);

// Countries/Governorates module routes
const countriesRoutes = require("./routes/countries.routes");
app.use("/countries", requireAuth, countriesRoutes);

// Couriers module routes
const couriersRoutes = require("./routes/couriers.routes");
app.use("/couriers", requireAuth, couriersRoutes);

// ─────── ERROR HANDLING ───────

// 404 handler
app.use((req, res) => {
  res.status(404).render("error", { error: "الصفحة غير موجودة" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render("error", { error: err.message });
});

// ─────── START SERVER ───────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
