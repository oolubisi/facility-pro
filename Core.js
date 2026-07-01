// =========================================================
// CORE.JS — Security · UX Utilities · Formatting · API Layer
//           Data Cache & State
// Load order: 1st (must load before all other app files)
// Depends on: nothing
// =========================================================

// =========================================================
// FACILITY PRO MOBILE — REFACTORED EDITION
// Modules: Security · UX Utilities · Formatting · API Layer
//          Data Cache · Initialization · Navigation
//          Rendering · Modal System · PDF Engine · Reports
// =========================================================

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbywuJnim2WBgSIrM-uFvLxKyBtKvMevnbbs0QOHQBShlsHHtAHbUdJAxeaP524v_Boj/exec";

// ─────────────────────────────────────────────
// § SECURITY UTILITIES
// ─────────────────────────────────────────────
const escapeHtml = (unsafe) => {
  if (unsafe == null) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const sanitizeInput = (str) => {
  if (!str) return "";
  return String(str).trim().replace(/[<>]/g, "");
};

// ─────────────────────────────────────────────
// § UX UTILITIES
// ─────────────────────────────────────────────
function showToast(message, type = "info", duration = 3000) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const icons = {
    success: "fa-check-circle",
    error: "fa-exclamation-circle",
    warning: "fa-exclamation-triangle",
  };
  const toast = document.createElement("div");
  toast.className = `toast ${escapeHtml(type)}`;
  toast.innerHTML = `<i class="fas ${icons[type] || "fa-info-circle"}"></i> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = "toastOut 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function setGlobalLoading(show, text = "Loading...") {
  const loader = document.getElementById("global-loader");
  if (!loader) return;
  const txt = loader.querySelector(".loader-text");
  if (txt) txt.textContent = text;
  loader.style.display = show ? "flex" : "none";
}

function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ─────────────────────────────────────────────
// § FORMATTING HELPERS
// ─────────────────────────────────────────────
function formatMoney(amount) {
  const val = parseFloat(amount);
  if (isNaN(val)) return "0.00";
  return val.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function convertAmountToWords(amount) {
  const val = parseFloat(amount);
  if (isNaN(val) || val === 0) return "Zero Naira Only";
  const a = [
    "",
    "One ",
    "Two ",
    "Three ",
    "Four ",
    "Five ",
    "Six ",
    "Seven ",
    "Eight ",
    "Nine ",
    "Ten ",
    "Eleven ",
    "Twelve ",
    "Thirteen ",
    "Fourteen ",
    "Fifteen ",
    "Sixteen ",
    "Seventeen ",
    "Eighteen ",
    "Nineteen ",
  ];
  const b = [
    "",
    "",
    "Twenty ",
    "Thirty ",
    "Forty ",
    "Fifty ",
    "Sixty ",
    "Seventy ",
    "Eighty ",
    "Ninety ",
  ];
  const toWords = (num) => {
    if (num === 0) return "";
    if (num < 20) return a[num];
    if (num < 100) return b[Math.floor(num / 10)] + a[num % 10];
    if (num < 1000)
      return (
        a[Math.floor(num / 100)] +
        "Hundred " +
        (num % 100 > 0 ? "and " + toWords(num % 100) : "")
      );
    if (num < 1000000)
      return (
        toWords(Math.floor(num / 1000)) + "Thousand " + toWords(num % 1000)
      );
    if (num < 1000000000)
      return (
        toWords(Math.floor(num / 1000000)) + "Million " + toWords(num % 1000000)
      );
    return (
      toWords(Math.floor(num / 1000000000)) +
      "Billion " +
      toWords(num % 1000000000)
    );
  };
  const naira = Math.floor(val);
  const kobo = Math.round((val - naira) * 100);
  let result = toWords(naira).trim() + " Naira";
  if (kobo > 0) result += " and " + toWords(kobo).trim() + " Kobo";
  return result + " Only";
}

function fromSheetDate(dStr) {
  if (!dStr) return "";
  dStr = String(dStr).trim();
  if (dStr.match(/^\d{4}-\d{2}-\d{2}/)) return dStr.substring(0, 10);
  if (dStr.includes("/")) {
    const parts = dStr.split(" ")[0].split("/");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0"),
        month = parts[1].padStart(2, "0");
      let year = parts[2];
      if (year.length === 2) year = "20" + year;
      return `${year}-${month}-${day}`;
    }
  }
  const parsed = Date.parse(dStr);
  if (!isNaN(parsed)) {
    const dt = new Date(parsed);
    const pad = (n) => String(n).padStart(2, "0");
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  }
  return "";
}

function toSheetDate(dStr) {
  if (!dStr) return "";
  const [y, m, d] = dStr.split("-");
  if (!y || !m || !d) return "";
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function formatDateForDisplay(dStr) {
  if (!dStr) return "Not Tracked";
  dStr = String(dStr).trim();
  if (dStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) return dStr;
  if (dStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    const parts = dStr.substring(0, 10).split("-");
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  if (dStr.includes("/")) {
    const parts = dStr.split(" ")[0].split("/");
    if (parts.length === 3)
      return `${parts[0].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[2]}`;
  }
  const parsed = Date.parse(dStr);
  if (!isNaN(parsed)) {
    const dt = new Date(parsed);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
  }
  return dStr;
}

function parseToLocalDateObject(dateStr) {
  if (!dateStr) return null;
  const normalized = fromSheetDate(dateStr);
  if (!normalized) return null;
  const [y, m, d] = normalized.split("-");
  return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
}

function getUnitNumber(u) {
  if (!u) return "";
  const keys = [
    "apt",
    "Apt",
    "APT",
    "unit",
    "Unit",
    "UNIT",
    "apartment",
    "Apartment",
  ];
  for (const key of keys)
    if (u[key] !== undefined && u[key] !== null) return String(u[key]);
  for (const key in u)
    if (
      key.toLowerCase().trim() === "apt" ||
      key.toLowerCase().trim() === "unit"
    )
      return String(u[key]);
  return "";
}

function getDirectImageUrl(url) {
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) return "";
  if (url.includes("drive.google.com")) {
    const fileId =
      url.split("/d/")[1]?.split("/")[0] || url.split("id=")[1]?.split("&")[0];
    if (fileId)
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
  }
  return url;
}

function extractDriveFileId(url) {
  if (!url) return null;
  const match =
    url.match(/\/d\/(.+?)(\/|$)/) ||
    url.match(/id=(.+?)(&|$)/) ||
    url.match(/\/file\/d\/(.+?)\//);
  return match ? match[1] : null;
}

// ─────────────────────────────────────────────
// § API LAYER
// ─────────────────────────────────────────────
async function callApi(action, data = {}) {
  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ action, data }),
    });
    if (!response.ok) throw new Error("HTTP_ERROR_" + response.status);

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      console.error("Invalid JSON:", text.substring(0, 200));
      throw new Error("Server returned invalid data");
    }

    if (action.startsWith("get")) {
      localStorage.setItem(
        "facility_pro_backup_" + action,
        JSON.stringify(result),
      );
    }
    return result;
  } catch (err) {
    console.warn("Network Error / Offline:", err);

    if (err.message && err.message.startsWith("HTTP_ERROR_")) {
      showToast(
        "Server error: " + err.message.replace("HTTP_ERROR_", ""),
        "error",
      );
      return { status: "error", message: err.message };
    }

    if (action.startsWith("get")) {
      const backup = localStorage.getItem("facility_pro_backup_" + action);
      if (backup) {
        try {
          return JSON.parse(backup);
        } catch (e) {}
      }
      return [];
    }

    if (action === "uploadImage") {
      showToast(
        "Cannot upload photos while offline. Please reconnect.",
        "error",
      );
      return null;
    }

    const queue = JSON.parse(
      localStorage.getItem("facility_pro_sync_queue") || "[]",
    );
    queue.push({ action, data, timestamp: Date.now() });
    localStorage.setItem("facility_pro_sync_queue", JSON.stringify(queue));
    const syncStatus = document.getElementById("sync-status");
    if (syncStatus) syncStatus.style.display = "block";
    showToast("Saved locally. Will sync when online.", "warning");
    return { status: "queued" };
  }
}

async function processSyncQueue() {
  const queue = JSON.parse(
    localStorage.getItem("facility_pro_sync_queue") || "[]",
  );
  if (queue.length === 0) return;
  const syncStatus = document.getElementById("sync-status");
  if (syncStatus) syncStatus.style.display = "block";

  const remaining = [];
  for (const item of queue) {
    try {
      const result = await callApi(item.action, item.data);
      if (result?.status === "queued") remaining.push(item);
      else if (result?.status === "error") {
        console.error("Sync failed:", item, result);
        showToast("Sync failed for " + item.action, "error");
      }
    } catch (err) {
      remaining.push(item);
    }
  }

  localStorage.setItem("facility_pro_sync_queue", JSON.stringify(remaining));
  if (remaining.length === 0) {
    if (syncStatus) syncStatus.style.display = "none";
    showToast("All changes synced!", "success");
    bootstrapDataRegistriesPipeline();
  }
}

// ─────────────────────────────────────────────
// § DATA CACHE & STATE
// ─────────────────────────────────────────────
let cache = {
  apts: [],
  assets: [],
  tickets: [],
  staff: [],
  vendors: [],
  utilities: [],
  workorders: [],
  inventory: [],
  payments: [],
  expenseRequests: [],
  cashExpenses: [],
};

let currentModalFiles = [];
let currentAvatarPhoto = "";
let currentSelectedRecord = null;
let lastFocusedElement = null;

let appSettings = {
  estateName: "Facility Pro Estate",
  estateAddress: "123 Infrastructure Way, Lagos, Nigeria",
  fmName: "Facility Operations Management",
  fmAddress: "Primary Support Office Center",
  logoUrl: "",
  mainFolder: "FacilityPro_Attachments",
};
