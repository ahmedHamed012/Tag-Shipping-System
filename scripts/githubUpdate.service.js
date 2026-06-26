// Self-update service driven by GitHub Releases.
// No git required on the deployed machine — it downloads the release
// source archive over HTTPS, just like a browser would.

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { spawn } = require("child_process");
const { Readable } = require("stream");
const semver = require("semver");
const extractZip = require("extract-zip");

const APP_ROOT = path.join(__dirname, "..");
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // required only for private repos

// Anything under these paths is never touched by an update (neither
// overwritten on apply, nor copied into/out of backups).
const EXCLUDED_PATHS = [
  ".env",
  "node_modules",
  ".git",
  "public/uploads",
  "backups",
  "temp",
];

function assertConfigured() {
  if (!GITHUB_OWNER || !GITHUB_REPO) {
    throw new Error("GITHUB_OWNER / GITHUB_REPO غير مضبوطة في ملف .env");
  }
}

function githubHeaders() {
  const headers = {
    "User-Agent": "shipping-system-updater",
    Accept: "application/vnd.github+json",
  };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return headers;
}

function isExcluded(relativePath) {
  const normalized = relativePath.split(path.sep).join("/");
  return EXCLUDED_PATHS.some(
    (excluded) =>
      normalized === excluded || normalized.startsWith(excluded + "/"),
  );
}

/**
 * Fetch the latest published GitHub Release for this repo.
 * NOTE: this requires an actual "Release" to be published (not just a tag).
 */
async function getLatestRelease() {
  assertConfigured();
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
  const res = await fetch(url, { headers: githubHeaders() });

  if (res.status === 404) {
    throw new Error("لم يتم العثور على أي إصدار منشور (Release) في المستودع");
  }
  if (!res.ok) {
    throw new Error(`تعذر الاتصال بـ GitHub API (HTTP ${res.status})`);
  }

  const data = await res.json();
  const tagName = data.tag_name;
  const version = semver.clean(tagName) || tagName.replace(/^v/, "");

  return {
    tagName,
    version,
    body: data.body || "",
    publishedAt: data.published_at,
  };
}

function isNewer(latestVersion, currentVersion) {
  try {
    return semver.gt(latestVersion, currentVersion);
  } catch {
    return latestVersion !== currentVersion;
  }
}

/**
 * Download the source archive for a given tag.
 * Handles GitHub's redirect to codeload.github.com manually, because
 * fetch strips the Authorization header on cross-origin redirects —
 * which would otherwise break downloads for private repos.
 */
async function downloadZip(tag, destFile) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/zipball/${tag}`;
  let res = await fetch(url, { headers: githubHeaders(), redirect: "manual" });

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    if (!location) throw new Error("لم يتم العثور على رابط التحميل الفعلي");
    res = await fetch(location, { headers: githubHeaders() });
  }

  if (!res.ok) {
    throw new Error(`فشل تحميل الإصدار ${tag} (HTTP ${res.status})`);
  }

  await fsp.mkdir(path.dirname(destFile), { recursive: true });
  const fileStream = fs.createWriteStream(destFile);
  await new Promise((resolve, reject) => {
    Readable.fromWeb(res.body).pipe(fileStream);
    fileStream.on("finish", resolve);
    fileStream.on("error", reject);
  });
}

/** Run a command, streaming each output line to onLine() as it happens. */
function runCommand(command, args, cwd, onLine) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: true });

    const forward = (data) => {
      data
        .toString()
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((line) => onLine && onLine(line));
    };

    child.stdout.on("data", forward);
    child.stderr.on("data", forward);

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `فشل تنفيذ: ${command} ${args.join(" ")} (exit code ${code})`,
          ),
        );
    });
  });
}

async function copyTree(src, dest, excludeRelativeTo) {
  await fsp.cp(src, dest, {
    recursive: true,
    force: true,
    filter: (from) => {
      const rel = path.relative(excludeRelativeTo, from);
      if (rel === "") return true;
      return !isExcluded(rel);
    },
  });
}

/**
 * Apply an update: download -> extract -> backup current app -> replace
 * files -> npm install -> prisma generate/migrate. Rolls back the backup
 * automatically if anything fails, and never restarts on failure.
 */
async function applyUpdate(tag, onProgress) {
  assertConfigured();
  const log = (msg) => onProgress && onProgress(msg);

  const workDir = path.join(APP_ROOT, "temp", `update-${Date.now()}`);
  const zipPath = path.join(workDir, "release.zip");
  const extractDir = path.join(workDir, "extracted");
  const backupDir = path.join(APP_ROOT, "backups", `backup-${Date.now()}`);

  await fsp.mkdir(workDir, { recursive: true });

  try {
    log(`تحميل الإصدار ${tag}...`);
    await downloadZip(tag, zipPath);

    log("استخراج الملفات...");
    await fsp.mkdir(extractDir, { recursive: true });
    await extractZip(zipPath, { dir: extractDir });

    const entries = await fsp.readdir(extractDir);
    if (entries.length !== 1) {
      throw new Error("شكل الأرشيف المستخرج غير متوقع");
    }
    const releaseRoot = path.join(extractDir, entries[0]);

    log("إنشاء نسخة احتياطية من الإصدار الحالي...");
    await fsp.mkdir(backupDir, { recursive: true });
    await copyTree(APP_ROOT, backupDir, APP_ROOT);

    log("نسخ ملفات الإصدار الجديد...");
    await copyTree(releaseRoot, APP_ROOT, releaseRoot);

    log("تثبيت الحزم (npm install)...");
    await runCommand("npm", ["install", "--omit=dev"], APP_ROOT, log);

    log("تحديث Prisma Client...");
    await runCommand("npx", ["prisma", "generate"], APP_ROOT, log);

    log("تطبيق تحديثات قاعدة البيانات (prisma migrate deploy)...");
    await runCommand("npx", ["prisma", "migrate", "deploy"], APP_ROOT, log);

    log("تنظيف الملفات المؤقتة...");
    await fsp.rm(workDir, { recursive: true, force: true });

    log("تم تطبيق التحديث بنجاح.");
  } catch (err) {
    log("حدث خطأ أثناء التحديث، يتم استعادة النسخة السابقة...");
    try {
      await copyTree(backupDir, APP_ROOT, backupDir);
      log("تمت استعادة الإصدار السابق بنجاح. لم تتم إعادة التشغيل.");
    } catch (rollbackErr) {
      log("⚠ فشلت الاستعادة الآلية: " + rollbackErr.message);
      log("يرجى استعادة الملفات يدويًا من: " + backupDir);
    }
    await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

module.exports = {
  getLatestRelease,
  isNewer,
  applyUpdate,
};
