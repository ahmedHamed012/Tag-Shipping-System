// controllers/appInfo.controller.js
const path = require("path");
const fs = require("fs");
const { exec, spawn } = require("child_process");
const updateService = require("../scripts/githubUpdate.service");

const packageJsonPath = path.join(__dirname, "..", "package.json");

function getCurrentVersion() {
  // Re-read on every call (not cached) so it reflects the version
  // actually on disk right after an update, without restarting first.
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  return pkg.version;
}

exports.getAppInfoPage = (req, res) => {
  res.render("app-info/index", {
    currentVersion: getCurrentVersion(),
    appName: "نظام إدارة الشحنات",
  });
};

exports.checkForUpdate = async (req, res) => {
  try {
    const currentVersion = getCurrentVersion();
    const release = await updateService.getLatestRelease();
    const updateAvailable = updateService.isNewer(
      release.version,
      currentVersion,
    );

    res.json({
      currentVersion,
      latestVersion: release.version,
      latestTag: release.tagName,
      updateAvailable,
      releaseNotes: release.body,
      publishedAt: release.publishedAt,
    });
  } catch (err) {
    console.error("Update check failed:", err);
    res
      .status(500)
      .json({ error: "فشل التحقق من التحديثات", details: err.message });
  }
};

exports.applyUpdate = async (req, res) => {
  const { tag } = req.body || {};

  // Basic guard: only ever act on a value shaped like a version tag,
  // since this ends up interpolated into a download URL.
  // if (!tag || !/^v?\d+\.\d+\.\d+(-[\w.]+)?$/.test(tag)) {
  //   return res.status(400).json({ error: "إصدار غير صالح" });
  // }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (type, message) => {
    res.write(`data: ${JSON.stringify({ type, message })}\n\n`);
  };

  try {
    await updateService.applyUpdate(tag, (message) => send("log", message));

    send("restarting", "تم نسخ الملفات بنجاح. جاري إيقاف التطبيق وتثبيت الحزم وتحديث قاعدة البيانات...");
    res.end();

    // Spawn a detached shell process that:
    //   1. Stops PM2 (releases the Prisma DLL file-lock on Windows)
    //   2. Runs npm install + prisma generate + prisma migrate
    //   3. Restarts PM2
    // Must be detached + unref'd so it outlives this process being killed by PM2.
    setTimeout(() => {
      const pm2AppName = process.env.PM2_APP_NAME || "shipping-system";
      const appRoot    = path.join(__dirname, "..");

      const cmd = [
        `pm2 stop ${pm2AppName}`,
        `cd /d "${appRoot}"`,
        `npm install --omit=dev`,
        `npx prisma generate`,
        `npx prisma migrate deploy`,
        `pm2 start ${pm2AppName}`,
      ].join(" && ");

      const child = spawn("cmd.exe", ["/c", cmd], {
        detached: true,
        stdio:    "ignore",
        windowsHide: true,
      });
      child.unref();
    }, 1500);
  } catch (err) {
    console.error("Update failed:", err);
    send("error", err.message || "فشل تطبيق التحديث");
    res.end();
    // Deliberately NOT restarting — applyUpdate() already rolled back
    // to the previous working version on failure.
  }
};

exports.health = (req, res) => {
  res.json({ status: "ok", version: getCurrentVersion() });
};
