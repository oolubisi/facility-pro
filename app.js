// =========================================================
// FACILITY PRO MOBILE - SECURE & ENHANCED EDITION
// [REVISED] Security, CORS, ID stability, Date logic, Offline sync
// =========================================================

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbywuJnim2WBgSIrM-uFvLxKyBtKvMevnbbs0QOHQBShlsHHtAHbUdJAxeaP524v_Boj/exec";

// --- SECURITY UTILITIES ---
const escapeHtml = (unsafe) => {
  if (unsafe == null || unsafe === undefined) return "";
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

// --- UX UTILITIES ---
function showToast(message, type = "info", duration = 3000) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${escapeHtml(type)}`;
  const icon =
    type === "success"
      ? "fa-check-circle"
      : type === "error"
        ? "fa-exclamation-circle"
        : type === "warning"
          ? "fa-exclamation-triangle"
          : "fa-info-circle";
  toast.innerHTML = `<i class="fas ${icon}"></i> <span>${escapeHtml(message)}</span>`;
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

// --- FORMATTING HELPERS ---
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
    const clean = dStr.split(" ")[0];
    const parts = clean.split("/");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      let year = parts[2];
      if (year.length === 2) year = "20" + year;
      return `${year}-${month}-${day}`;
    }
  }
  const parsed = Date.parse(dStr);
  if (!isNaN(parsed)) {
    const dt = new Date(parsed);
    const pad = (num) => String(num).padStart(2, "0");
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
    const clean = dStr.split(" ")[0];
    const parts = clean.split("/");
    if (parts.length === 3)
      return `${parts[0].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[2]}`;
  }
  const parsed = Date.parse(dStr);
  if (!isNaN(parsed)) {
    const dt = new Date(parsed);
    const pad = (num) => String(num).padStart(2, "0");
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
  for (const key of keys) {
    if (u[key] !== undefined && u[key] !== null) return String(u[key]);
  }
  for (const key in u) {
    if (
      key.toLowerCase().trim() === "apt" ||
      key.toLowerCase().trim() === "unit"
    )
      return String(u[key]);
  }
  return "";
}

// [SECURITY FIX] Reject non-http URLs to prevent javascript: injection
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

// --- API LAYER ---
// [CORS FIX] Removed Content-Type header to avoid preflight on GAS Web Apps
// [BUG FIX] Only queue network errors, not HTTP 4xx/5xx
async function callApi(action, data = {}) {
  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ action: action, data: data }),
    });

    // [BUG FIX] Reject HTTP errors immediately
    if (!response.ok) {
      throw new Error("HTTP_ERROR_" + response.status);
    }

    let result;
    const text = await response.text();
    try {
      result = JSON.parse(text);
    } catch (e) {
      console.error("Invalid JSON response:", text.substring(0, 200));
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

    // [BUG FIX] Do NOT queue HTTP errors (4xx/5xx) as offline items
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

// [FEATURE FIX] Process offline queue when connection returns
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
      if (result && result.status === "queued") {
        remaining.push(item);
      } else if (result && result.status === "error") {
        console.error("Sync item failed permanently:", item, result);
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

// --- DATA CACHE ---
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
};

// --- APP INITIALIZATION ---
window.onload = async () => {
  // [BUG FIX] Register Service Worker so PWA offline mode actually works
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  }

  // [BUG FIX] Attempt to sync any queued offline changes on load
  window.addEventListener("online", processSyncQueue);
  if (navigator.onLine) processSyncQueue();

  await loadApplicationSettingsData();
  await bootstrapDataRegistriesPipeline();
  setupKeyboardHandlers();
  setupPullToRefresh();
};

function generateNextId(prefix, list, idKey) {
  let maxId = 0;
  const safeList = Array.isArray(list) ? list : [];
  safeList.forEach((item) => {
    if (!item) return;
    const idVal =
      item[idKey] ||
      item[idKey.charAt(0).toUpperCase() + idKey.slice(1)] ||
      item[idKey.toUpperCase()];
    if (idVal && typeof idVal === "string" && idVal.startsWith(prefix)) {
      const parts = idVal.split("-");
      if (parts.length > 1) {
        const numPart = parseInt(parts[1], 10);
        if (!isNaN(numPart) && numPart > maxId) maxId = numPart;
      }
    }
  });
  return `${prefix}-${String(maxId + 1).padStart(4, "0")}`;
}

async function loadApplicationSettingsData() {
  const stored = localStorage.getItem("facility_pro_config_meta");
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object")
        appSettings = { ...appSettings, ...parsed };
    } catch (e) {
      console.error("Settings parse error:", e);
    }
  }
  applySettingsToUIHeaders();

  try {
    const cloudSettings = await callApi("getSettings", {});
    if (
      cloudSettings &&
      typeof cloudSettings === "object" &&
      (cloudSettings.estateName || cloudSettings.fmName)
    ) {
      appSettings = { ...appSettings, ...cloudSettings };
      localStorage.setItem(
        "facility_pro_config_meta",
        JSON.stringify(appSettings),
      );
      applySettingsToUIHeaders();
      syncSettingsInputsToUIFields();
    }
  } catch (e) {
    console.error("Cloud settings load failed:", e);
  }
}

function applySettingsToUIHeaders() {
  const logoEl = document.getElementById("app-header-logo");
  if (logoEl) {
    if (appSettings.logoUrl) {
      logoEl.src = appSettings.logoUrl;
      logoEl.style.display = "block";
    } else {
      logoEl.style.display = "none";
    }
  }
  const titleEl = document.getElementById("app-header-title");
  if (titleEl) titleEl.innerText = appSettings.estateName || "Facility Pro";
}

async function commitApplicationSettingsData() {
  appSettings.estateName = sanitizeInput(
    document.getElementById("cfg-estate-name").value,
  );
  appSettings.estateAddress = sanitizeInput(
    document.getElementById("cfg-estate-address").value,
  );
  appSettings.fmName = sanitizeInput(
    document.getElementById("cfg-fm-name").value,
  );
  appSettings.fmAddress = sanitizeInput(
    document.getElementById("cfg-fm-address").value,
  );
  appSettings.logoUrl = sanitizeInput(
    document.getElementById("cfg-logo-url").value,
  );

  localStorage.setItem("facility_pro_config_meta", JSON.stringify(appSettings));
  applySettingsToUIHeaders();

  try {
    await callApi("saveSettings", appSettings);
    showToast("Settings saved and synced successfully!", "success");
  } catch (err) {
    console.error("Cloud sync failed:", err);
    showToast("Saved locally. Cloud sync offline.", "warning");
  }
  showPage("dashboard");
}

function syncSettingsInputsToUIFields() {
  const fields = [
    "cfg-estate-name",
    "cfg-estate-address",
    "cfg-fm-name",
    "cfg-fm-address",
    "cfg-logo-url",
  ];
  const keys = [
    "estateName",
    "estateAddress",
    "fmName",
    "fmAddress",
    "logoUrl",
  ];
  fields.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.value = appSettings[keys[i]] || "";
  });
}

async function bootstrapDataRegistriesPipeline() {
  setGlobalLoading(true, "Loading data...");
  const actions = [
    "getApartments",
    "getAssets",
    "getMaintenance",
    "getStaff",
    "getVendors",
    "getUtilities",
    "getWorkOrders",
    "getInventory",
    "getPayments",
    "getExpenseRequests",
    "getCashExpenses",
  ];
  const map = [
    "apts",
    "assets",
    "tickets",
    "staff",
    "vendors",
    "utilities",
    "workorders",
    "inventory",
    "payments",
    "expenseRequests",
    "cashExpenses",
  ];

  try {
    const results = await Promise.all(
      actions.map(async (act) => {
        try {
          return await callApi(act, {});
        } catch (e) {
          return [];
        }
      }),
    );

    results.forEach((res, i) => {
      if (res && res.status !== "queued" && Array.isArray(res)) {
        cache[map[i]] = res;
      }
    });

    // [BUG FIX] Assign stable temp IDs to legacy utility records missing rowId
    if (cache.utilities) {
      cache.utilities.forEach((u, i) => {
        if (u && !u.rowId && !u.id) u._tempId = "UTIL-" + i;
      });
    }

    if (cache.apts && Array.isArray(cache.apts)) sortApartmentsCacheList();

    updateDashboardCounters();
    evalPreventiveMaintenanceAlerts();
    prepopulateStaticFilterSelectors();

    showToast("Data loaded successfully", "success", 2000);
  } catch (e) {
    console.error("Pipeline error:", e);
    showToast("Some data could not be loaded", "warning");
  } finally {
    setGlobalLoading(false);
  }
}

function sortApartmentsCacheList() {
  if (!cache.apts || !Array.isArray(cache.apts)) return;
  cache.apts.sort((a, b) => {
    const aNum = String(getUnitNumber(a)).replace(/[^0-9]/g, "");
    const bNum = String(getUnitNumber(b)).replace(/[^0-9]/g, "");
    return (parseInt(aNum, 10) || 0) - (parseInt(bNum, 10) || 0);
  });
}

function prepopulateStaticFilterSelectors() {
  const uFilter = document.getElementById("asset-unit-filter");
  if (uFilter && cache.apts && cache.apts.length > 0) {
    uFilter.innerHTML = '<option value="ALL">-- ALL ASSETS --</option>';
    cache.apts.forEach((a) => {
      const uNum = getUnitNumber(a);
      if (uNum !== undefined && uNum !== "") {
        const o = document.createElement("option");
        o.value = uNum;
        o.textContent = `Unit ${uNum}`;
        uFilter.appendChild(o);
      }
    });
  }
}

function populateUnitDropdown(selectElementId, currentlySelectedValue) {
  const selectElement = document.getElementById(selectElementId);
  if (!selectElement) return;
  selectElement.innerHTML =
    '<option value="">-- Choose Unit Reference --</option>';

  function renderOptions() {
    (cache.apts || []).forEach((u) => {
      const uNum = getUnitNumber(u);
      if (uNum !== undefined && uNum !== "") {
        // [BUG FIX] Filter by TYPE (not status) to match Apartments page logic
        const typeLabel = String(u.type || u.Type || "").toLowerCase();
        if (typeLabel === "services") return;
        const opt = document.createElement("option");
        opt.value = uNum;
        opt.textContent = "Unit " + uNum;
        if (
          currentlySelectedValue &&
          String(uNum) === String(currentlySelectedValue)
        )
          opt.selected = true;
        selectElement.appendChild(opt);
      }
    });
  }

  if (!cache.apts || cache.apts.length === 0) {
    callApi("getApartments", {}).then((res) => {
      if (res && Array.isArray(res)) {
        cache.apts = res;
        sortApartmentsCacheList();
        renderOptions();
      }
    });
  } else {
    renderOptions();
  }
}

function evalPreventiveMaintenanceAlerts() {
  if (!cache.assets || !Array.isArray(cache.assets)) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let overdueCount = 0;
  cache.assets.forEach((a) => {
    if (!a) return;
    const status = String(a.status || a.Status || "").toLowerCase();
    const archived = String(a.archived || a.Archived || "").toLowerCase();
    if (status !== "archived" && archived !== "yes") {
      const nextServiceDate = parseToLocalDateObject(
        a.nextService || a.NextService || "",
      );
      if (nextServiceDate && nextServiceDate <= today) overdueCount++;
    }
  });
  const banner = document.getElementById("pms-alert-banner");
  const text = document.getElementById("pms-alert-text");
  if (overdueCount > 0 && banner && text) {
    text.textContent = `${overdueCount} Heavy Asset${overdueCount > 1 ? "s Are" : " Is"} Overdue for Scheduled PM Check`;
    banner.style.display = "flex";
  } else if (banner) {
    banner.style.display = "none";
  }
}

function renderGeneratorEfficiencyLogs() {
  const card = document.getElementById("generator-efficiency-card");
  if (!card) return;
  const plantLogs = (cache.utilities || [])
    .filter(
      (u) =>
        u &&
        u.type === "Plant Check" &&
        String(getUnitNumber(u)).includes("GENERATOR"),
    )
    .sort((a, b) => parseFloat(b.reading || 0) - parseFloat(a.reading || 0));
  if (plantLogs.length < 2) {
    card.style.display = "none";
    return;
  }

  const current = plantLogs[0];
  const previous = plantLogs[1];
  const deltaHours =
    parseFloat(current.reading || 0) - parseFloat(previous.reading || 0);
  const litersAdded = parseFloat(current.amount || current.Amount || 0);
  if (deltaHours > 0 && litersAdded > 0) {
    const rate = (litersAdded / deltaHours).toFixed(2);
    card.innerHTML = `<h4><i class="fas fa-chart-line"></i> Generator Burn Analytics</h4>
                      <p style="font-size:14px; font-weight:600; margin-top:4px;">Last run logged <strong>${escapeHtml(deltaHours)} Hours</strong> with <strong>${escapeHtml(litersAdded)}L</strong> addition.</p>
                      <div style="font-size:22px; font-weight:900; color:var(--primary); margin-top:5px;">${escapeHtml(rate)} L / Hr <span style="font-size:12px; color:var(--muted);">Consumption Rate</span></div>`;
    card.style.display = "block";
  } else {
    card.style.display = "none";
  }
}

function renderTotalBalance() {
  const balEl = document.getElementById("s-ledger-balance");
  if (!balEl) return;

  let totalInflow = 0,
    totalOutflow = 0;

  if (cache.payments) {
    cache.payments.forEach((p) => {
      if (!p) return;
      const amt = parseFloat(p.amount || p.Amount || 0);
      const isCleared =
        String(p.isPaid).toUpperCase() === "TRUE" || p.isPaid === true;
      if (p.direction === "OUTFLOW") {
        if (isCleared) totalOutflow += amt;
      } else {
        if (isCleared) totalInflow += amt;
      }
    });
  }

  if (cache.cashExpenses) {
    cache.cashExpenses.forEach((c) => {
      if (!c) return;
      const amt = parseFloat(c.amount || c.Amount || 0);
      const isCleared =
        String(c.isPaid).toUpperCase() === "TRUE" || c.isPaid === true;
      if (isCleared) totalOutflow += amt;
    });
  }

  const netBalance = totalInflow - totalOutflow;
  balEl.textContent = `${netBalance >= 0 ? "+" : "-"}₦${formatMoney(Math.abs(netBalance))}`;
  balEl.style.color = netBalance >= 0 ? "var(--success)" : "var(--danger)";
}

function updateDashboardCounters() {
  // [BUG FIX] Consistent filtering by TYPE (not status/tenant) for service units
  const tenancyCount = cache.apts
    ? cache.apts.filter((a) => {
        if (!a) return false;
        const type = String(a.type || a.Type || "").toLowerCase();
        return type !== "services";
      }).length
    : 0;

  const assetCount = cache.assets
    ? cache.assets.filter((a) => {
        if (!a) return false;
        return (
          String(a.status || a.Status || "") !== "Archived" &&
          String(a.archived || a.Archived || "") !== "Yes"
        );
      }).length
    : 0;

  const invCount = cache.inventory
    ? cache.inventory.filter(
        (i) => i && String(i.archived || i.Archived || "") !== "Yes",
      ).length
    : 0;
  const maintCount = cache.tickets
    ? cache.tickets.filter(
        (t) => t && String(t.status || t.Status || "") !== "Resolved",
      ).length
    : 0;
  const woCount = cache.workorders
    ? cache.workorders.filter(
        (w) => w && String(w.status || w.Status || "") === "Pending Approval",
      ).length
    : 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fourteenDaysLimit = new Date();
  fourteenDaysLimit.setDate(today.getDate() + 14);
  fourteenDaysLimit.setHours(23, 59, 59, 999);
  let pmCombinedSum = 0;

  if (cache.assets) {
    cache.assets.forEach((a) => {
      if (!a) return;
      const status = String(a.status || a.Status || "").toLowerCase();
      const archived = String(a.archived || a.Archived || "").toLowerCase();
      if (status !== "archived" && archived !== "yes") {
        const nextServiceDate = parseToLocalDateObject(
          a.nextService || a.NextService || "",
        );
        if (nextServiceDate && nextServiceDate <= fourteenDaysLimit)
          pmCombinedSum++;
      }
    });
  }

  const ids = [
    "s-tenancy",
    "s-asset",
    "s-inv",
    "count-maint",
    "s-wo",
    "s-pm-due",
  ];
  const vals = [
    tenancyCount,
    assetCount,
    invCount,
    maintCount,
    woCount,
    pmCombinedSum,
  ];
  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.textContent = vals[i] || "0";
  });
}

// --- NAVIGATION ---
function showPage(p) {
  document
    .querySelectorAll(".page-view")
    .forEach((v) => v.classList.remove("active-view"));
  const printContainer = document.getElementById("report-print-container");
  if (printContainer) printContainer.innerHTML = "";

  const target = document.getElementById("view-" + p);
  if (target) {
    target.classList.add("active-view");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const moreChildren = [
    "serviceunits",
    "utilities",
    "expenserequests",
    "cashexpenses",
    "payments",
    "staff",
    "vendors",
    "archived",
    "reports",
    "settings",
  ];
  const homeBtn = document.querySelector(".active-view .home-btn");
  if (homeBtn) {
    homeBtn.onclick = () =>
      showPage(moreChildren.includes(p) ? "more" : "dashboard");
  }

  if (p === "dashboard") {
    updateDashboardCounters();
    evalPreventiveMaintenanceAlerts();
  } else if (p === "reports") {
    initReportsEngine();
  } else if (p === "settings") {
    syncSettingsInputsToUIFields();
  } else if (p === "utilities") {
    refreshData("utilities");
    setTimeout(renderGeneratorEfficiencyLogs, 500);
  } else if (p === "payments") {
    refreshData("payments");
  } else if (p !== "more") {
    refreshData(p);
  }
}

// --- KEYBOARD & ACCESSIBILITY ---
function setupKeyboardHandlers() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const overlay = document.getElementById("modalOverlay");
      if (overlay && overlay.style.display === "flex") {
        closeModal();
      }
    }
  });
}

// --- PULL TO REFRESH ---
function setupPullToRefresh() {
  let startY = 0;
  let isPulling = false;
  const indicator = document.getElementById("pull-indicator");

  document.addEventListener(
    "touchstart",
    (e) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    },
    { passive: true },
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (!isPulling || !indicator) return;
      const diff = e.touches[0].clientY - startY;
      if (diff > 60 && diff < 200 && window.scrollY === 0) {
        indicator.style.display = "flex";
        indicator.style.transform = `translateY(${Math.min(diff - 60, 0)}px)`;
      }
    },
    { passive: true },
  );

  document.addEventListener("touchend", () => {
    if (!isPulling || !indicator) return;
    isPulling = false;
    indicator.style.transform = "translateY(-60px)";
    setTimeout(() => {
      indicator.style.display = "none";
      if (window.scrollY === 0) {
        showToast("Refreshing data...", "info");
        bootstrapDataRegistriesPipeline();
      }
    }, 200);
  });
}

// --- SEARCH & FILTER ---
const filterList = debounce((pageType, query) => {
  const containerMap = {
    apartments: "apt-list",
    assets: "asset-list",
    maintenance: "maint-list",
    workorders: "wo-list",
    inventory: "inventory-list",
    payments: "payment-list",
    staff: "staff-list",
    vendors: "vendor-list",
  };
  const containerId = containerMap[pageType];
  if (!containerId) return;
  const container = document.getElementById(containerId);
  if (!container) return;

  const cards = container.querySelectorAll(".card");
  const q = query.toLowerCase().trim();
  let visibleCount = 0;

  cards.forEach((card) => {
    const text = card.textContent.toLowerCase();
    if (text.includes(q)) {
      card.style.display = "";
      visibleCount++;
    } else {
      card.style.display = "none";
    }
  });

  const emptyId = containerId.replace("-list", "-empty");
  const emptyEl = document.getElementById(emptyId);
  if (emptyEl)
    emptyEl.style.display = visibleCount === 0 && q === "" ? "block" : "none";
}, 250);

// --- RECORD OPENING ---
function openRecordRow(type, lookupId) {
  if (!lookupId) return;
  let match = null;
  const safeLookup = String(lookupId);

  if (type === "apartment")
    match = cache.apts.find(
      (i) => i && String(getUnitNumber(i)) === safeLookup,
    );
  if (type === "asset")
    match = cache.assets.find(
      (i) => i && String(i.tag || i.Tag || i.TAG) === safeLookup,
    );
  if (type === "maintenance")
    match = cache.tickets.find(
      (i) => i && String(i.ticketId || i.TicketId || i.TICKETID) === safeLookup,
    );
  if (type === "staff")
    match = cache.staff.find(
      (i) => i && String(i.rowId || i.RowId || i.ROWID) === safeLookup,
    );
  if (type === "vendor")
    match = cache.vendors.find(
      (i) => i && String(i.rowId || i.RowId || i.ROWID) === safeLookup,
    );
  if (type === "workorder")
    match = cache.workorders.find(
      (i) =>
        i &&
        String(i.workOrderId || i.WorkOrderId || i.WORKORDERID) === safeLookup,
    );
  if (type === "inventory")
    match = cache.inventory.find(
      (i) => i && String(i.itemId || i.ItemId || i.ITEMID) === safeLookup,
    );
  if (type === "payment")
    match = cache.payments.find(
      (i) => i && String(i.paymentId || i.PaymentId) === safeLookup,
    );
  if (type === "expenserequest")
    match = cache.expenseRequests.find(
      (i) => i && String(i.reqId) === safeLookup,
    );
  if (type === "cashexpense")
    match = cache.cashExpenses.find(
      (i) => i && String(i.cashId) === safeLookup,
    );
  // [BUG FIX] Use stable rowId/id/_tempId instead of array index for utilities
  if (type === "utility" || type === "generator") {
    match = cache.utilities.find(
      (i) => i && String(i.rowId || i.id || i._tempId) === safeLookup,
    );
  }

  if (match) openModal(type, match);
}

// --- EXPENSE ACTIONS ---
function processExpenseAction(actionType, reqId) {
  const req = cache.expenseRequests.find((r) => r && r.reqId === reqId);
  if (!req) return;

  if (actionType === "DELETE") {
    if (confirm("Permanently delete this request?")) {
      callApi("deleteExpenseRequest", { reqId: reqId }).then(() => {
        showToast("Request deleted", "success");
        refreshData("expenserequests");
      });
    }
  } else if (actionType === "CREATE_WO") {
    openModal("workorder", {
      apt: req.apt,
      description: req.job,
      amount: req.cost,
      asset: req.assetTag,
    });
  } else if (actionType === "CREATE_CASH") {
    openModal("cashexpense", {
      amount: req.cost,
      description: req.job,
      apt: req.apt,
    });
  }
}

// --- DATA REFRESH ---
function refreshData(p) {
  const idMap = {
    apartments: "apt-list",
    serviceunits: "service-list",
    assets: "asset-list",
    maintenance: "maint-list",
    maint: "maint-list",
    utilities: "util-list",
    staff: "staff-list",
    vendors: "vendor-list",
    workorders: "wo-list",
    inventory: "inventory-list",
    payments: "payment-list",
    archived: "archived-list",
    expenserequests: "expense-req-list",
    cashexpenses: "cash-expense-list",
  };
  const listEl = document.getElementById(idMap[p]);
  if (!listEl) return;

  const isMaint = p === "maintenance" || p === "maint";

  let apiCmd =
    p === "assets"
      ? "getAssets"
      : p === "vendors"
        ? "getVendors"
        : isMaint
          ? "getMaintenance"
          : p === "utilities"
            ? "getUtilities"
            : p === "staff"
              ? "getStaff"
              : p === "workorders"
                ? "getWorkOrders"
                : p === "inventory"
                  ? "getInventory"
                  : p === "payments"
                    ? "getPayments"
                    : p === "expenserequests"
                      ? "getExpenseRequests"
                      : p === "cashexpenses"
                        ? "getCashExpenses"
                        : "getApartments";

  // [BUG FIX] Archived page needs fresh caches; fetch all relevant sheets
  if (p === "archived") {
    setGlobalLoading(true, "Loading archive...");
    Promise.all([
      callApi("getAssets", {}),
      callApi("getStaff", {}),
      callApi("getVendors", {}),
      callApi("getInventory", {}),
    ])
      .then(([assets, staff, vendors, inventory]) => {
        if (Array.isArray(assets)) cache.assets = assets;
        if (Array.isArray(staff)) cache.staff = staff;
        if (Array.isArray(vendors)) cache.vendors = vendors;
        if (Array.isArray(inventory)) cache.inventory = inventory;
        renderArchiveBinDashboardView(listEl);
        const emptyEl = document.getElementById("archived-empty");
        if (emptyEl) {
          const hasAny =
            (cache.assets || []).some(
              (a) =>
                a &&
                (String(a.status || a.Status) === "Archived" ||
                  String(a.archived || a.Archived) === "Yes"),
            ) ||
            (cache.staff || []).some(
              (s) => s && String(s.archived || s.Archived) === "Yes",
            ) ||
            (cache.vendors || []).some(
              (v) => v && String(v.archived || v.Archived) === "Yes",
            ) ||
            (cache.inventory || []).some(
              (i) => i && String(i.archived || i.Archived) === "Yes",
            );
          emptyEl.style.display = hasAny ? "none" : "block";
        }
        setGlobalLoading(false);
      })
      .catch((err) => {
        console.error("Archive refresh error:", err);
        showToast("Failed to load archive", "error");
        setGlobalLoading(false);
      });
    return;
  }

  setGlobalLoading(true, `Loading ${p}...`);

  callApi(apiCmd, {})
    .then((data) => {
      let displayData = Array.isArray(data) ? data : [];

      if (p === "apartments" || p === "serviceunits") {
        cache.apts = displayData;
        sortApartmentsCacheList();
        if (p === "apartments") {
          displayData = cache.apts.filter(
            (item) =>
              item &&
              String(item.type || item.Type || "").toLowerCase() !== "services",
          );
        } else {
          displayData = cache.apts.filter(
            (item) =>
              item &&
              String(item.type || item.Type || "").toLowerCase() === "services",
          );
        }
      }
      if (p === "assets") {
        cache.assets = displayData;
        displayData = displayData.filter(
          (item) =>
            item &&
            String(item.status || item.Status || "") !== "Archived" &&
            String(item.archived || item.Archived || "") !== "Yes",
        );
      }
      if (isMaint) cache.tickets = displayData;
      if (p === "staff") {
        cache.staff = displayData;
        displayData = displayData.filter(
          (item) =>
            item && String(item.archived || item.Archived || "") !== "Yes",
        );
      }
      if (p === "vendors") {
        cache.vendors = displayData;
        displayData = displayData.filter(
          (item) =>
            item && String(item.archived || item.Archived || "") !== "Yes",
        );
      }
      if (p === "utilities") {
        cache.utilities = displayData;
        // [BUG FIX] Assign stable temp IDs for legacy records missing rowId
        cache.utilities.forEach((u, i) => {
          if (u && !u.rowId && !u.id) u._tempId = "UTIL-" + i;
        });
      }
      if (p === "workorders") cache.workorders = displayData;
      if (p === "payments") {
        cache.payments = displayData;
        if (!cache.cashExpenses || cache.cashExpenses.length === 0) {
          callApi("getCashExpenses", {}).then((cashData) => {
            cache.cashExpenses = Array.isArray(cashData) ? cashData : [];
            renderTotalBalance();
          });
        } else {
          renderTotalBalance();
        }
      }
      if (p === "expenserequests") cache.expenseRequests = displayData;
      if (p === "cashexpenses") {
        cache.cashExpenses = displayData;
        if (!cache.payments || cache.payments.length === 0) {
          callApi("getPayments", {}).then((payData) => {
            cache.payments = Array.isArray(payData) ? payData : [];
            renderTotalBalance();
          });
        } else {
          renderTotalBalance();
        }
      }
      if (p === "inventory") {
        cache.inventory = displayData;
        displayData = displayData.filter(
          (item) =>
            item && String(item.archived || item.Archived || "") !== "Yes",
        );
      }

      if (p === "assets") {
        const filter = document.getElementById("asset-unit-filter");
        if (filter && filter.value !== "ALL") {
          displayData = displayData.filter(
            (item) => String(getUnitNumber(item)) === filter.value,
          );
        }
      }
      if (isMaint) {
        const filter = document.getElementById("maint-status-filter");
        if (filter && filter.value !== "ALL") {
          displayData = displayData.filter(
            (item) => String(item.status || item.Status || "") === filter.value,
          );
        }
      }
      if (p === "workorders") {
        const filter = document.getElementById("wo-status-filter");
        if (filter && filter.value !== "ALL") {
          displayData = displayData.filter(
            (item) => String(item.status || item.Status || "") === filter.value,
          );
        }
      }

      renderList(p, listEl, displayData);

      // Show empty state if needed
      const emptyId = idMap[p].replace("-list", "-empty");
      const emptyEl = document.getElementById(emptyId);
      if (emptyEl)
        emptyEl.style.display = displayData.length === 0 ? "block" : "none";

      setGlobalLoading(false);
    })
    .catch((err) => {
      console.error(`Refresh error for ${p}:`, err);
      showToast(`Failed to load ${p}`, "error");
      setGlobalLoading(false);
    });
}

function renderList(p, listEl, displayData) {
  if (!displayData || displayData.length === 0) {
    listEl.innerHTML = "";
    return;
  }

  const isMaintPage = p === "maintenance" || p === "maint";

  listEl.innerHTML = displayData
    .map((item, idx) => {
      if (!item) return "";
      const unitId = escapeHtml(getUnitNumber(item));

      if (p === "expenserequests") {
        return `
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:start;" onclick="openRecordRow('expenserequest', '${escapeHtml(item.reqId)}')">
            <div><strong style="font-size:20px;">Unit ${unitId}</strong><br><small style="color:var(--muted); font-weight:700;">${escapeHtml(item.reqId)}</small></div>
            <div style="font-size:20px; font-weight:900; color:var(--primary)">₦${formatMoney(item.cost)}</div>
          </div>
          <div style="font-size:15px; margin:8px 0; font-weight:600; color:#000;">${escapeHtml(item.job || "")}</div>
          <div style="display:flex; gap:8px; margin-top:10px;">
            <button onclick="event.stopPropagation(); processExpenseAction('CREATE_WO', '${escapeHtml(item.reqId)}')" style="flex:1; background:#000; color:#fff; padding:10px; border-radius:8px; font-weight:900; border:none; cursor:pointer; min-height:44px;">New WO</button>
            <button onclick="event.stopPropagation(); processExpenseAction('CREATE_CASH', '${escapeHtml(item.reqId)}')" style="flex:1; background:var(--primary); color:#fff; padding:10px; border-radius:8px; font-weight:900; border:none; cursor:pointer; min-height:44px;">Cash Exp</button>
            <button onclick="event.stopPropagation(); processExpenseAction('DELETE', '${escapeHtml(item.reqId)}')" style="background:var(--danger); color:#fff; padding:10px 15px; border-radius:8px; border:none; cursor:pointer; min-height:44px;" aria-label="Delete"><i class="fas fa-trash"></i></button>
          </div>
          <button onclick="event.stopPropagation(); printSingleExpenseRequestDirect('${escapeHtml(item.reqId)}')" style="width:100%; margin-top:8px; background:var(--card-light); color:#000; border:2px solid var(--border); padding:10px; border-radius:8px; font-size:12px; font-weight:800; cursor:pointer; text-transform:uppercase; min-height:44px;">
            <i class="fas fa-print"></i> Print Request
          </button>
        </div>`;
      } else if (p === "cashexpenses") {
        return `
        <div class="card" onclick="openRecordRow('cashexpense', '${escapeHtml(item.cashId)}')">
          <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:4px;">
            <div><strong style="font-size:20px;">Unit ${unitId || "N/A"}</strong><br><small style="color:var(--muted); font-weight:700;">ID: ${escapeHtml(item.cashId)}</small></div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
              <div style="text-align:right;"><span style="font-size:20px; font-weight:900; color:var(--danger);">-₦${formatMoney(item.amount)}</span><br><small style="font-size:11px; font-weight:700; color:var(--muted);">${formatDateForDisplay(item.date)}</small></div>
              <button onclick="event.stopPropagation(); printSingleCashExpenseDirect('${escapeHtml(item.cashId)}')" style="background:var(--primary); color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer; text-transform:uppercase; min-height:32px;">
                <i class="fas fa-print"></i> Print
              </button>
            </div>
          </div>
          <div style="font-size:15px; font-weight:600; color:#000;">${escapeHtml(item.description || "")}</div>
        </div>`;
      } else if (isMaintPage) {
        const status = String(item.status || "").toLowerCase();
        return `
        <div class="card" onclick="openRecordRow('maintenance', '${escapeHtml(item.ticketId || item.TicketId)}')">
          <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:4px;">
            <div><strong style="font-size:20px;">Unit ${unitId}</strong><br><small style="color:var(--muted); font-weight:700;">${escapeHtml(item.ticketId || item.TicketId)}</small></div>
            <span style="padding:4px 10px; border:2px solid #000; border-radius:6px; font-size:12px; font-weight:900; background:${status === "resolved" ? "var(--success)" : "var(--danger)"}; color:#fff;">${escapeHtml(String(item.status || "OPEN").toUpperCase())}</span>
          </div>
          <div style="font-size:16px; font-weight:800; color:var(--primary);">${escapeHtml(item.category || item.Category || "")}</div>
          <div style="font-size:15px; color:#000; font-weight:600;">${escapeHtml(item.description || item.Description || "")}</div>
        </div>`;
      } else if (p === "workorders") {
        const woId = item.workOrderId || item.WorkOrderId;
        const submittedPreview =
          item.submittedValue || item.SubmittedValue
            ? `<span style="font-size:13px; font-weight:700; color:var(--muted); text-decoration:line-through; margin-left:8px;">₦${formatMoney(item.submittedValue || item.SubmittedValue)}</span>`
            : "";
        const statusColor =
          String(item.status || "") === "Approved"
            ? "var(--success)"
            : String(item.status || "") === "Declined"
              ? "var(--danger)"
              : "var(--warning)";

        return `
        <div class="card" onclick="openRecordRow('workorder', '${escapeHtml(woId)}')">
          <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:4px;">
            <div>
              <strong style="font-size:20px;">Unit ${unitId}</strong><br>
              <small style="color:var(--muted); font-weight:700;">${escapeHtml(woId)}</small>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
              <span style="padding:4px 10px; border:2px solid #000; border-radius:6px; font-size:12px; font-weight:900; background:${statusColor}; color:#fff; text-align:center;">
                ${escapeHtml(String(item.status || "PENDING").toUpperCase())}
              </span>
              <div style="display:flex; gap:5px;">
                <button onclick="event.stopPropagation(); printSingleWorkOrderDirect('${escapeHtml(woId)}', false)" style="background:var(--card-light); color:#000; border:2px solid var(--border); padding:6px 10px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer; text-transform:uppercase; min-height:32px;">
                  <i class="fas fa-file-alt"></i> Text
                </button>
                <button onclick="event.stopPropagation(); printSingleWorkOrderDirect('${escapeHtml(woId)}', true)" style="background:var(--primary); color:#fff; border:none; padding:6px 10px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer; text-transform:uppercase; min-height:32px;">
                  <i class="fas fa-paperclip"></i> Full
                </button>
              </div>
            </div>
          </div>
          <div style="display:flex; align-items:baseline; margin:4px 0;">
             <div style="font-size:18px; font-weight:900; color:var(--success)">₦${formatMoney(item.amount)}</div>
             ${submittedPreview}
          </div>
          ${item.assigned ? `<div style="font-size:14px; font-weight:700; color:var(--muted); margin-bottom:4px;"><i class="fas fa-user-check"></i> ${escapeHtml(item.assigned)} ${item.duration ? `• ${escapeHtml(item.duration)}` : ""}</div>` : ""}
          <div style="font-size:15px; font-weight:600; color:#000;">${escapeHtml(item.description || item.Description || "")}</div>
        </div>`;
      } else if (p === "payments") {
        const isOutflow = item.direction === "OUTFLOW";
        const color = isOutflow ? "var(--danger)" : "var(--success)";
        const sign = isOutflow ? "-" : "+";
        const reasonPreview = item.reason
          ? `<div style="font-size:13px; color:var(--muted); margin-top:2px;">${escapeHtml(item.reason)}</div>`
          : "";
        const linkPreview = item.reference
          ? `<span style="background:var(--card-light); padding:2px 6px; border:1px solid var(--border); border-radius:4px; font-size:10px; margin-left:6px;"><i class="fas fa-link"></i> ${escapeHtml(item.reference)}</span>`
          : "";
        const bankPreview = item.bank ? `${escapeHtml(item.bank)}: ` : "Acc: ";
        const accountStr =
          item.account || item.Account
            ? String(item.account || item.Account).padStart(10, "0")
            : "N/A";
        const hasAttachments = item.attachments || item.Attachments;
        const attachmentPreview = hasAttachments
          ? `<span style="background:#e8f4fd; color:#0D6EFD; padding:2px 6px; border:1px solid #b6d4fe; border-radius:4px; font-size:10px; margin-left:6px;"><i class="fas fa-paperclip"></i></span>`
          : "";

        return `
        <div class="card" onclick="openRecordRow('payment', '${escapeHtml(item.paymentId || item.PaymentId)}')">
          <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:4px;">
            <div>
              <strong style="font-size:18px;">${escapeHtml(item.party || "No Party Listed")}</strong><br>
              <small style="color:var(--muted); font-weight:700;">ID: ${escapeHtml(item.paymentId || item.PaymentId || "")} | ${bankPreview}${accountStr}</small>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
              <div style="text-align:right;">
                <span style="font-size:20px; font-weight:900; color:${color};">${sign}₦${formatMoney(item.amount)}</span><br>
                <small style="font-size:11px; font-weight:700; color:var(--muted);">${formatDateForDisplay(item.date)}</small>
              </div>
              <button onclick="event.stopPropagation(); printSinglePaymentDirect('${escapeHtml(item.paymentId || item.PaymentId)}')" style="background:var(--primary); color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer; text-transform:uppercase; min-height:32px;">
                <i class="fas fa-print"></i> Print
              </button>
            </div>
          </div>
          <div style="font-size:15px; font-weight:800; color:${color};">${escapeHtml(item.direction || "INFLOW")} &bull; ${escapeHtml(item.type || "General Record")} ${linkPreview} ${attachmentPreview}</div>
          ${reasonPreview}
        </div>`;
      } else if (p === "inventory") {
        return `
        <div class="card" onclick="openRecordRow('inventory', '${escapeHtml(item.itemId || item.ItemId)}')">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div><strong style="font-size:20px;">Unit ${unitId}</strong><br><small style="color:var(--muted); font-weight:700;">ID: ${escapeHtml(item.itemId || item.ItemId || "")} [${escapeHtml(item.category || item.Category || "General")}]</small></div>
            <div style="text-align:right;"><span style="font-size:22px; font-weight:900; color:var(--primary);">${escapeHtml(item.qty || item.Qty || 0)}</span><br><small style="font-weight:800; font-size:10px; color:var(--muted)">UNITS</small></div>
          </div>
        </div>`;
      } else if (p === "assets") {
        const nextDateStr = item.nextService || item.NextService || "";
        let isOverdue = false;
        const nextServiceDate = parseToLocalDateObject(nextDateStr);
        if (nextServiceDate) {
          isOverdue = nextServiceDate <= new Date().setHours(0, 0, 0, 0);
        }
        return `
        <div class="card" onclick="openRecordRow('asset', '${escapeHtml(item.tag || item.Tag)}')" style="${isOverdue ? "border-left: 6px solid var(--danger);" : ""}">
          <div style="display:flex; justify-content:space-between; align-items:start;">
            <div><strong style="font-size:20px;">Unit ${unitId}</strong><br><span style="font-weight:800; color:var(--primary);">${escapeHtml(item.type || item.Type || "")}</span></div>
            <span style="padding:4px 10px; border:2px solid #000; border-radius:6px; font-size:12px; font-weight:900; background:#000; color:#fff;">${escapeHtml(String(item.status || "OPERATIONAL").toUpperCase())}</span>
          </div>
          <div style="font-size:14px; font-weight:700; margin-top:4px;">Tag Parameter: ${escapeHtml(item.tag || item.Tag || "")}</div>
          <div style="font-size:13px; font-weight:700; margin-top:2px; color:${isOverdue ? "var(--danger)" : "var(--muted)"}">Next PM Check: ${formatDateForDisplay(nextDateStr)}</div>
        </div>`;
      } else if (p === "staff") {
        const imgSrc =
          getDirectImageUrl(item.passport || item.Passport) ||
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='40' height='40'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%23ccc'/%3E%3C/svg%3E";
        return `
        <div class="card" onclick="openRecordRow('staff', '${escapeHtml(item.rowId || item.RowId)}')">
          <div style="display:flex; gap:12px; align-items:center;">
            <img src="${imgSrc}" style="width:60px; height:60px; object-fit:cover; border-radius:50%; border:2px solid #000;" alt="${escapeHtml(item.name || item.Name || "")}">
            <div style="flex:1;"><strong style="font-size:18px;">${escapeHtml(item.name || item.Name || "")}</strong><br><span style="font-weight:700; color:var(--muted); font-size:13px;">ID: ${escapeHtml(item.rowId || item.RowId || "")}</span><br><span style="font-weight:700; color:var(--primary); font-size:14px;">${escapeHtml(item.role || item.Role || "")}</span></div>
          </div>
        </div>`;
      } else if (p === "vendors") {
        return `
        <div class="card" onclick="openRecordRow('vendor', '${escapeHtml(item.rowId || item.RowId || "")}')">
          <div style="display:flex; gap:12px; align-items:center;">
            <div style="flex:1;">
              <strong style="font-size:18px;">${escapeHtml(item.company || item.Company || "Unnamed Corporate Vendor")}</strong><br>
              <span style="font-weight:700; color:var(--muted); font-size:13px;">ID: ${escapeHtml(item.rowId || item.RowId || "")}</span><br>
              <span style="font-weight:700; color:var(--success); font-size:14px;">${escapeHtml(String(item.trade || item.Trade || "").toUpperCase())}</span>
            </div>
          </div>
        </div>`;
      } else if (p === "utilities") {
        const isPlant =
          item.type === "Plant Check" ||
          String(unitId).includes("GENERATOR") ||
          unitId === "DIESEL-TANK";
        const itemType = isPlant ? "generator" : "utility";
        // [BUG FIX] Use stable rowId/id/_tempId instead of array index
        const lookupId = escapeHtml(
          item.rowId || item.id || item._tempId || "",
        );
        return `
        <div class="card" onclick="openRecordRow('${itemType}', '${lookupId}')" style="border-left: 6px solid ${isPlant ? "#fd7e14" : "var(--primary)"}; cursor: pointer;">
          <div style="display:flex; justify-content:space-between; align-items:start;">
            <div><strong>${unitId}</strong><br><span style="font-size:12px; font-weight:800; color:var(--muted);">${escapeHtml(String(item.type || "").toUpperCase())}</span></div>
            <span style="padding:4px 10px; font-weight:900; background:#000; color:#fff; border-radius:6px; font-size:14px;">${escapeHtml(item.reading || item.Reading || 0)}</span>
          </div>
        </div>`;
      } else if (p === "apartments" || p === "serviceunits") {
        const status = String(item.status || item.Status || "").toLowerCase();
        const statusBg =
          status === "occupied"
            ? "var(--success)"
            : status === "common area"
              ? "var(--primary)"
              : "var(--danger)";
        return `
        <div class="card" onclick="openRecordRow('apartment', '${unitId}')">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div><strong style="font-size:22px;">Unit ${unitId}</strong><br><span style="font-weight:600; color:var(--muted);">${escapeHtml(item.tenant || item.Tenant || "Vacant Infrastructure")}</span></div>
            <span style="padding:4px 10px; border:2px solid #000; border-radius:6px; font-size:12px; font-weight:900; background:${statusBg}; color:#fff;">${escapeHtml(item.status || item.Status || "Vacant")}</span>
          </div>
        </div>`;
      } else {
        // Fallback for any unknown page type
        return `
        <div class="card">
          <div style="font-size:16px; font-weight:700;">Unit ${unitId}</div>
          <div style="font-size:13px; color:var(--muted);">${escapeHtml(JSON.stringify(item).substring(0, 100))}...</div>
        </div>`;
      }
    })
    .join("");
}
function renderArchiveBinDashboardView(targetContainerElement) {
  if (!targetContainerElement) return;
  let archiveBundleHTML = "";
  const selectedFilterSegment = document.getElementById(
    "archive-segment-filter",
  )
    ? document.getElementById("archive-segment-filter").value
    : "ALL";

  const archivedAssets = (cache.assets || []).filter(
    (a) =>
      a &&
      (String(a.status || a.Status || "") === "Archived" ||
        String(a.archived || a.Archived || "") === "Yes"),
  );
  const archivedStaff = (cache.staff || []).filter(
    (s) => s && String(s.archived || s.Archived || "") === "Yes",
  );
  const archivedVendors = (cache.vendors || []).filter(
    (v) => v && String(v.archived || v.Archived || "") === "Yes",
  );
  const archivedInventory = (cache.inventory || []).filter(
    (i) => i && String(i.archived || i.Archived || "") === "Yes",
  );

  if (selectedFilterSegment === "ALL" || selectedFilterSegment === "assets") {
    archivedAssets.forEach((a) => {
      archiveBundleHTML += `<div class="card" style="border-left:5px solid var(--danger)"><strong>[ASSET ARCHIVE] ${escapeHtml(a.type || "Asset")}</strong><br><small>Tag Ref ID: ${escapeHtml(a.tag || a.Tag)} | Location: Unit ${escapeHtml(getUnitNumber(a))}</small></div>`;
    });
  }
  if (
    selectedFilterSegment === "ALL" ||
    selectedFilterSegment === "inventory"
  ) {
    archivedInventory.forEach((i) => {
      archiveBundleHTML += `<div class="card" style="border-left:5px solid #ffc107"><strong>[INVENTORY ARCHIVE] ${escapeHtml(i.name || i.Name || "")}</strong><br><small>Category: ${escapeHtml(i.category || i.Category)} | Qty: ${escapeHtml(i.qty || i.Qty)} | ID: ${escapeHtml(i.itemId || i.ItemId)}</small></div>`;
    });
  }
  if (selectedFilterSegment === "ALL" || selectedFilterSegment === "staff") {
    archivedStaff.forEach((s) => {
      archiveBundleHTML += `<div class="card" style="border-left:5px solid var(--primary)"><strong>[STAFF ARCHIVE] ${escapeHtml(s.name || s.Name || "")}</strong><br><small>Role: ${escapeHtml(s.role || s.Role)} | Staff ID: ${escapeHtml(s.rowId || s.RowId)}</small></div>`;
    });
  }
  if (selectedFilterSegment === "ALL" || selectedFilterSegment === "vendors") {
    archivedVendors.forEach((v) => {
      archiveBundleHTML += `<div class="card" style="border-left:5px solid var(--success)"><strong>[VENDOR ARCHIVE] ${escapeHtml(v.company || v.Company || "")}</strong><br><small>Trade Field: ${escapeHtml(v.trade || v.Trade)} | Vendor ID: ${escapeHtml(v.rowId || v.RowId)}</small></div>`;
    });
  }

  if (!archiveBundleHTML) {
    targetContainerElement.innerHTML = `<p style="text-align:center; padding:30px; font-weight:700; color:var(--muted)">No archived items match this selection profile.</p>`;
    return;
  }
  targetContainerElement.innerHTML = archiveBundleHTML;
}

// --- MODAL SYSTEM ---
// [BUG FIX] Escape image URL in src attribute to prevent attribute breakout
function populateModalInlineImageGalleryPreviews(renderBoxId) {
  const box = document.getElementById(renderBoxId);
  if (!box) return;
  if (currentModalFiles.length === 0) {
    box.innerHTML = "";
    box.style.display = "none";
    return;
  }
  box.style.display = "flex";
  box.innerHTML = currentModalFiles
    .map((url, idx) => {
      const safeUrl = escapeHtml(url);
      const isPdf =
        url.toLowerCase().includes(".pdf") ||
        url.toLowerCase().includes("pdf_");
      let content = isPdf
        ? `<div style="width:100%; height:100%; border:2px solid var(--text); border-radius:6px; background:#fff; display:flex; align-items:center; justify-content:center;"><i class="fas fa-file-pdf" style="font-size:24px; color:var(--danger);"></i></div>`
        : `<img src="${escapeHtml(getDirectImageUrl(url))}" style="width:100%; height:100%; object-fit:cover; border:2px solid var(--text); border-radius:6px; margin:0;" alt="Attachment ${idx + 1}">`;

      return `
      <div style="position: relative; width: 60px; height: 60px; flex-shrink: 0;">
        ${content}
        <div onclick="removeAttachmentByIndex(${idx}, '${renderBoxId}')" style="position: absolute; top: -6px; right: -6px; background: var(--danger); color: white; border: 2px solid white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.3); z-index: 10;" role="button" aria-label="Remove attachment">&times;</div>
      </div>
    `;
    })
    .join("");
}

function removeAttachmentByIndex(index, renderBoxId) {
  currentModalFiles.splice(index, 1);
  populateModalInlineImageGalleryPreviews(renderBoxId);
}

// [BUG FIX] Clear whichever avatar frame is currently present (staff or vendor)
function clearAvatarPhotoFrame() {
  currentAvatarPhoto = "";
  const frame =
    document.getElementById("passport_frame_view") ||
    document.getElementById("vendor_frame_view");
  if (frame) {
    frame.src =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='50' height='50'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%236c757d'/%3E%3C/svg%3E";
  }
  const btn = document.getElementById("p_avatar_remove_btn");
  if (btn) btn.style.display = "none";
}

function processIncomingMultiAttachments(filesList, previewTargetId) {
  if (!filesList || filesList.length === 0) return;
  Array.from(filesList).forEach((file) => {
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (isPdf) {
      if (file.size > 500 * 1024) {
        showToast(
          `PDF "${file.name}" exceeds 500KB limit. Skipped.`,
          "warning",
        );
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        const generatedName =
          "pdf_" + Date.now() + "_" + file.name.replace(/[^a-zA-Z0-9.]/g, "_");
        callApi("uploadImage", {
          base64: evt.target.result,
          name: generatedName,
        }).then((res) => {
          if (res && res.url) {
            currentModalFiles.push(res.url);
            populateModalInlineImageGalleryPreviews(previewTargetId);
          }
        });
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        let base64StringData = evt.target.result;
        if (file.size > 200 * 1024) {
          base64StringData = await compressImageToTargetLimit(
            evt.target.result,
            185000,
          );
        }
        const generatedName =
          "img_" + Date.now() + "_" + file.name.replace(/[^a-zA-Z0-9.]/g, "_");
        callApi("uploadImage", {
          base64: base64StringData,
          name: generatedName,
        }).then((res) => {
          if (res && res.url) {
            currentModalFiles.push(res.url);
            populateModalInlineImageGalleryPreviews(previewTargetId);
          }
        });
      };
      reader.readAsDataURL(file);
    }
  });
}

function openModal(type, editData = null) {
  lastFocusedElement = document.activeElement;
  const body = document.getElementById("modalBody");
  const submit = document.getElementById("modalSubmit");
  const title = document.getElementById("modalTitle");
  const overlay = document.getElementById("modalOverlay");
  const isEdit = !!editData;

  if (!body || !submit || !title || !overlay) return;

  overlay.style.display = "flex";
  void overlay.offsetWidth;
  overlay.classList.add("active");

  body.innerHTML = "";
  submit.disabled = false;
  submit.style.display = "block";
  submit.innerText = isEdit ? "Update" : "Save";
  submit.classList.remove("loading");

  const largeInput =
    'style="font-size: 19px; padding: 12px; margin-bottom: 6px;"';
  const labelStyle =
    'style="font-size: 15px; color: var(--text); font-weight:800; display: block; margin-top: 8px; margin-bottom: 2px;"';

  currentModalFiles = [];
  currentAvatarPhoto = "";
  currentSelectedRecord = editData;

  // --- EXPENSE REQUEST ---
  if (type === "expenserequest") {
    const uniqueId = isEdit
      ? editData.reqId || editData.ReqId
      : generateNextId("EXR", cache.expenseRequests || [], "reqId");
    title.innerText = isEdit
      ? "Update Expense Request"
      : "Draft Expense Request";
    if (isEdit && (editData.attachments || editData.Attachments)) {
      currentModalFiles = String(editData.attachments || editData.Attachments)
        .split(",")
        .filter(Boolean);
    }

    body.innerHTML = `
      <label ${labelStyle}>Request ID</label><input type="text" value="${escapeHtml(uniqueId)}" disabled ${largeInput} style="background:#e9ecef; font-weight:900;">
      <label ${labelStyle}>Date Created</label><input id="er_date" type="date" value="${isEdit ? fromSheetDate(editData.date) : new Date().toISOString().split("T")[0]}" ${largeInput}>
      <label ${labelStyle}>Target Unit</label><select id="er_apt" ${largeInput}></select>
      <label ${labelStyle}>Asset Tag (Optional)</label><input id="er_asset" value="${isEdit ? escapeHtml(editData.assetTag || "") : ""}" placeholder="e.g. AST-12345" ${largeInput}>
      <label ${labelStyle}>Job Profile / Scope</label><textarea id="er_job" rows="3" placeholder="Multiline description..." ${largeInput}>${isEdit ? escapeHtml(editData.job || "") : ""}</textarea>
      <label ${labelStyle}>Estimated Cost (₦)</label><input id="er_cost" type="number" required placeholder="Amount (₦)" value="${isEdit ? escapeHtml(editData.cost || "") : ""}" ${largeInput}>

      <label ${labelStyle}>Supporting Attachments</label>
      <div id="erPreviews" class="modal-preview-grid" style="display:none;"></div>
      <label class="icon-upload-label"><i class="fas fa-paperclip"></i><input type="file" id="erCameraInput" accept="image/*,application/pdf" multiple style="display:none"></label>
    `;

    populateUnitDropdown("er_apt", isEdit ? getUnitNumber(editData) : "");
    if (isEdit && currentModalFiles.length > 0)
      populateModalInlineImageGalleryPreviews("erPreviews");
    document.getElementById("erCameraInput").onchange = (e) => {
      processIncomingMultiAttachments(e.target.files, "erPreviews");
    };

    submit.onclick = () => {
      const costVal = document.getElementById("er_cost").value;
      if (!costVal) {
        showToast("Estimated Cost is required.", "error");
        return;
      }
      submit.disabled = true;
      submit.classList.add("loading");
      callApi(isEdit ? "updateExpenseRequest" : "saveExpenseRequest", {
        reqId: uniqueId,
        date: toSheetDate(document.getElementById("er_date").value),
        apt: document.getElementById("er_apt").value,
        assetTag: sanitizeInput(document.getElementById("er_asset").value),
        job: sanitizeInput(document.getElementById("er_job").value),
        cost: costVal,
        attachments: currentModalFiles.join(","),
      })
        .then(() => {
          closeModal();
          refreshData("expenserequests");
          showToast(isEdit ? "Request updated" : "Request saved", "success");
        })
        .catch(() => {
          submit.disabled = false;
          submit.classList.remove("loading");
        });
    };
  }
  // --- CASH EXPENSE ---
  else if (type === "cashexpense") {
    const uniqueId = isEdit
      ? editData.cashId || editData.CashId
      : generateNextId("CSH", cache.cashExpenses || [], "cashId");
    title.innerText = isEdit ? "Edit Cash Expense" : "Log Cash Expense";
    if (isEdit && (editData.attachments || editData.Attachments)) {
      currentModalFiles = String(editData.attachments || editData.Attachments)
        .split(",")
        .filter(Boolean);
    }

    body.innerHTML = `
      <label ${labelStyle}>Cash ID</label><input type="text" value="${escapeHtml(uniqueId)}" disabled ${largeInput} style="background:#e9ecef; font-weight:900;">
      <label ${labelStyle}>Date</label><input id="ce_date" type="date" value="${isEdit ? fromSheetDate(editData.date) : new Date().toISOString().split("T")[0]}" ${largeInput}>
      <label ${labelStyle}>Target Unit</label><select id="ce_apt" ${largeInput}></select>
      <label ${labelStyle}>Amount (₦)</label><input id="ce_amount" type="number" required placeholder="Amount (₦)" value="${isEdit ? escapeHtml(editData.amount || "") : ""}" ${largeInput}>
      <label ${labelStyle}>Description / Notes</label><textarea id="ce_desc" rows="3" ${largeInput}>${isEdit ? escapeHtml(editData.description || "") : ""}</textarea>

      <label ${labelStyle}>Supporting Attachments</label>
      <div id="cePreviews" class="modal-preview-grid" style="display:none;"></div>
      <label class="icon-upload-label"><i class="fas fa-paperclip"></i><input type="file" id="ceCameraInput" accept="image/*,application/pdf" multiple style="display:none"></label>
    `;

    populateUnitDropdown("ce_apt", isEdit ? getUnitNumber(editData) : "");
    if (isEdit && currentModalFiles.length > 0)
      populateModalInlineImageGalleryPreviews("cePreviews");
    document.getElementById("ceCameraInput").onchange = (e) => {
      processIncomingMultiAttachments(e.target.files, "cePreviews");
    };

    submit.onclick = () => {
      const amtVal = document.getElementById("ce_amount").value;
      if (!amtVal) {
        showToast("Amount is required.", "error");
        return;
      }
      submit.disabled = true;
      submit.classList.add("loading");
      callApi(isEdit ? "updateCashExpense" : "saveCashExpense", {
        cashId: uniqueId,
        date: toSheetDate(document.getElementById("ce_date").value),
        apt: document.getElementById("ce_apt").value,
        amount: amtVal,
        description: sanitizeInput(document.getElementById("ce_desc").value),
        attachments: currentModalFiles.join(","),
      })
        .then(() => {
          closeModal();
          refreshData("cashexpenses");
          showToast(isEdit ? "Expense updated" : "Expense saved", "success");
        })
        .catch(() => {
          submit.disabled = false;
          submit.classList.remove("loading");
        });
    };
  }
  // --- APARTMENT ---
  else if (type === "apartment") {
    const currentUnit = getUnitNumber(editData);
    title.innerText = "Unit Profile: " + escapeHtml(currentUnit);
    if (isEdit && (editData.photos || editData.Photos)) {
      currentModalFiles = String(editData.photos || editData.Photos)
        .split(",")
        .filter(Boolean);
    }
    body.innerHTML = `
      <label ${labelStyle}>Tenant Name</label><input id="f_tenant" value="${escapeHtml(editData.tenant || editData.Tenant || "")}" ${largeInput}>
      <label ${labelStyle}>Apartment Type</label><input id="f_type" value="${escapeHtml(editData.type || editData.Type || "Standard")}" disabled ${largeInput}>
      <label ${labelStyle}>Status State</label>
      <select id="f_status" ${largeInput}>
        <option value="Occupied" ${String(editData.status || editData.Status) === "Occupied" ? "selected" : ""}>Occupied</option>
        <option value="Vacant" ${String(editData.status || editData.Status) === "Vacant" ? "selected" : ""}>Vacant</option>
        <option value="Common Area" ${String(editData.status || editData.Status) === "Common Area" ? "selected" : ""}>Common Area</option>
      </select>
      <label ${labelStyle}>Phone 1</label><input id="f_p1" type="tel" maxlength="11" inputmode="numeric" oninput="this.value=this.value.replace(/[^0-9]/g,'')" value="${escapeHtml(editData.phone1 || editData.Phone1 || "")}" ${largeInput}>
      <label ${labelStyle}>Phone 2</label><input id="f_p2" type="tel" maxlength="11" inputmode="numeric" oninput="this.value=this.value.replace(/[^0-9]/g,'')" value="${escapeHtml(editData.phone2 || editData.Phone2 || "")}" ${largeInput}>
      <label ${labelStyle}>Lease End</label><input id="f_lease" type="date" value="${fromSheetDate(editData.leaseEnd || editData.LeaseEnd)}" ${largeInput}>
      <label ${labelStyle}>Last Inspected</label><input id="f_inspected" type="date" value="${fromSheetDate(editData.inspected || editData.Inspected)}" ${largeInput}>
      <label ${labelStyle}>Notes</label><textarea id="f_notes" rows="2" ${largeInput}>${escapeHtml(editData.notes || editData.Notes || "")}</textarea>

      <label ${labelStyle}>Form Attachments</label>
      <div id="aptPreviews" class="modal-preview-grid" style="display:none;"></div>
      <label class="icon-upload-label"><i class="fas fa-paperclip"></i><input type="file" id="cameraInput" accept="image/*,application/pdf" style="display:none"></label>`;

    if (isEdit && currentModalFiles.length > 0)
      populateModalInlineImageGalleryPreviews("aptPreviews");
    document.getElementById("cameraInput").onchange = (e) => {
      processIncomingMultiAttachments(e.target.files, "aptPreviews");
    };

    submit.onclick = () => {
      submit.disabled = true;
      submit.classList.add("loading");
      callApi("updateApartment", {
        apt: currentUnit,
        tenant: sanitizeInput(document.getElementById("f_tenant").value),
        status: document.getElementById("f_status").value,
        phone1: String(document.getElementById("f_p1").value),
        phone2: String(document.getElementById("f_p2").value),
        leaseEnd: toSheetDate(document.getElementById("f_lease").value),
        inspected: toSheetDate(document.getElementById("f_inspected").value),
        notes: sanitizeInput(document.getElementById("f_notes").value),
        photos: currentModalFiles.join(","),
        type: editData.type || editData.Type || "",
        oldApt: currentUnit,
      })
        .then(() => {
          closeModal();
          refreshData("apartments");
          showToast("Apartment updated", "success");
        })
        .catch(() => {
          submit.disabled = false;
          submit.classList.remove("loading");
        });
    };
  }
  // --- ASSET ---
  else if (type === "asset") {
    // [BUG FIX] Use sequential ID instead of random to prevent collisions
    const uniqueTag = isEdit
      ? editData.tag || editData.Tag
      : generateNextId("AST", cache.assets || [], "tag");
    title.innerText = isEdit ? "Update Asset" : "Register Facility Asset";
    if (isEdit && (editData.photos || editData.Photos)) {
      currentModalFiles = String(editData.photos || editData.Photos)
        .split(",")
        .filter(Boolean);
    }

    let defaultInterval = "30";
    if (isEdit) {
      const lsNormalized = fromSheetDate(
        editData.lastServiced || editData.LastServiced || "",
      );
      const nsNormalized = fromSheetDate(
        editData.nextService || editData.NextService || "",
      );
      if (lsNormalized && nsNormalized) {
        const lsDate = new Date(lsNormalized);
        const nsDate = new Date(nsNormalized);
        const dTime = Math.abs(nsDate - lsDate);
        const dDays = Math.ceil(dTime / (1000 * 60 * 60 * 24));
        const optionsArr = [30, 60, 90, 120, 150, 180];
        const closest = optionsArr.reduce((prev, curr) =>
          Math.abs(curr - dDays) < Math.abs(prev - dDays) ? curr : prev,
        );
        defaultInterval = String(closest);
      }
    }

    body.innerHTML = `
      <label ${labelStyle}>Asset Tag (System ID)</label>
      <input type="text" value="${escapeHtml(uniqueTag)}" disabled ${largeInput} style="background: #e9ecef; font-weight: 900; color: #495057;">

      <label ${labelStyle}>Unit Connection Location</label><select id="a_apt" ${largeInput}></select>
      <label ${labelStyle}>Category Class Type</label><input id="a_type" value="${isEdit ? escapeHtml(editData.type || editData.Type) : ""}" ${largeInput}>
      <label ${labelStyle}>Asset Functional Status</label>
      <select id="a_status" ${largeInput}>
        <option value="Operational" ${isEdit && String(editData.status || editData.Status) === "Operational" ? "selected" : ""}>Operational</option>
        <option value="Faulty" ${isEdit && String(editData.status || editData.Status) === "Faulty" ? "selected" : ""}>Faulty</option>
        <option value="Under Repair" ${isEdit && String(editData.status || editData.Status) === "Under Repair" ? "selected" : ""}>Under Repair</option>
        <option value="Archived" ${isEdit && String(editData.status || editData.Status) === "Archived" ? "selected" : ""}>Archived</option>
      </select>
      <label ${labelStyle}>Specs Configuration Profile</label><input id="a_specs" value="${isEdit ? escapeHtml(editData.specs || editData.Specs) : ""}" ${largeInput}>
      <label ${labelStyle}>Internal Placement Area</label><input id="a_loc" value="${isEdit ? escapeHtml(editData.loc || editData.Loc) : ""}" ${largeInput}>
      <label ${labelStyle}>Last Serviced Date</label><input id="a_serviced" type="date" value="${isEdit ? fromSheetDate(editData.lastServiced || editData.LastServiced) : ""}" ${largeInput}>
      <label ${labelStyle}>Last Inspected Date</label><input id="a_inspected" type="date" value="${isEdit ? fromSheetDate(editData.lastInspected || editData.LastInspected) : ""}" ${largeInput}>

      <label ${labelStyle}>Next Scheduled PM Due in</label>
      <select id="a_nextServiceInterval" ${largeInput}>
        <option value="30" ${defaultInterval === "30" ? "selected" : ""}>30 days</option>
        <option value="60" ${defaultInterval === "60" ? "selected" : ""}>60 days</option>
        <option value="90" ${defaultInterval === "90" ? "selected" : ""}>90 days</option>
        <option value="120" ${defaultInterval === "120" ? "selected" : ""}>120 days</option>
        <option value="150" ${defaultInterval === "150" ? "selected" : ""}>150 days</option>
        <option value="180" ${defaultInterval === "180" ? "selected" : ""}>180 days</option>
      </select>

      <label ${labelStyle}>Notes</label><textarea id="a_notes" rows="2" ${largeInput}>${isEdit ? escapeHtml(editData.notes || editData.Notes) : ""}</textarea>

      <label ${labelStyle}>Form Attachments</label>
      <div id="assetPreviews" class="modal-preview-grid" style="display:none;"></div>
      <label class="icon-upload-label"><i class="fas fa-paperclip"></i><input type="file" id="assetCameraInput" accept="image/*,application/pdf" style="display:none"></label>`;

    populateUnitDropdown("a_apt", isEdit ? getUnitNumber(editData) : "");
    if (isEdit && currentModalFiles.length > 0)
      populateModalInlineImageGalleryPreviews("assetPreviews");
    document.getElementById("assetCameraInput").onchange = (e) => {
      processIncomingMultiAttachments(e.target.files, "assetPreviews");
    };

    submit.onclick = () => {
      submit.disabled = true;
      submit.classList.add("loading");
      const lastServicedVal = document.getElementById("a_serviced").value;
      let calculatedNextServiceStr = "";

      if (lastServicedVal) {
        const [y, m, d] = lastServicedVal.split("-");
        const lastServicedDate = new Date(y, m - 1, d);
        const daysToAdd =
          parseInt(
            document.getElementById("a_nextServiceInterval").value,
            10,
          ) || 30;
        lastServicedDate.setDate(lastServicedDate.getDate() + daysToAdd);
        const pad = (num) => String(num).padStart(2, "0");
        calculatedNextServiceStr = `${pad(lastServicedDate.getDate())}/${pad(lastServicedDate.getMonth() + 1)}/${lastServicedDate.getFullYear()}`;
      }

      callApi(isEdit ? "updateAsset" : "saveAsset", {
        apt: document.getElementById("a_apt").value,
        tag: uniqueTag,
        type: sanitizeInput(document.getElementById("a_type").value),
        status: document.getElementById("a_status").value,
        specs: sanitizeInput(document.getElementById("a_specs").value),
        loc: sanitizeInput(document.getElementById("a_loc").value),
        lastServiced: toSheetDate(lastServicedVal),
        lastInspected: toSheetDate(
          document.getElementById("a_inspected").value,
        ),
        nextService: calculatedNextServiceStr,
        notes: sanitizeInput(document.getElementById("a_notes").value),
        photos: currentModalFiles.join(","),
        archived:
          document.getElementById("a_status").value === "Archived"
            ? "Yes"
            : "No",
      })
        .then(() => {
          closeModal();
          refreshData("assets");
          showToast(isEdit ? "Asset updated" : "Asset registered", "success");
        })
        .catch(() => {
          submit.disabled = false;
          submit.classList.remove("loading");
        });
    };
  }
  // --- MAINTENANCE ---
  else if (type === "maintenance") {
    const uniqueTicket = isEdit
      ? editData.ticketId || editData.TicketId
      : generateNextId("TKT", cache.tickets, "ticketId");
    title.innerText = isEdit ? "Update Ticket" : "Log Maintenance Issue";
    if (isEdit && (editData.photos || editData.Photos)) {
      currentModalFiles = String(editData.photos || editData.Photos)
        .split(",")
        .filter(Boolean);
    }
    body.innerHTML = `
      <label ${labelStyle}>Ticket ID</label><input type="text" value="${escapeHtml(uniqueTicket)}" disabled ${largeInput} style="background:#e9ecef; font-weight:900;">
      <label ${labelStyle}>Property Target Unit Coordinate</label><select id="m_apt" ${largeInput}></select>
      <label ${labelStyle}>Issue Category</label><input id="m_category" value="${isEdit ? escapeHtml(editData.category || editData.Category) : ""}" ${largeInput}>
      <label ${labelStyle}>Priority Level</label>
      <select id="m_priority" ${largeInput}>
        <option value="Low" ${isEdit && String(editData.priority || editData.Priority) === "Low" ? "selected" : ""}>Low</option>
        <option value="Medium" ${isEdit && String(editData.priority || editData.Priority) === "Medium" ? "selected" : ""}>Medium</option>
        <option value="High" ${isEdit && String(editData.priority || editData.Priority) === "High" ? "selected" : ""}>High</option>
      </select>
      <label ${labelStyle}>Ticket Lifecycle Status</label>
      <select id="m_status" ${largeInput}>
        <option value="Open" ${isEdit && String(editData.status || editData.Status) === "Open" ? "selected" : ""}>Open</option>
        <option value="In Progress" ${isEdit && String(editData.status || editData.Status) === "In Progress" ? "selected" : ""}>In Progress</option>
        <option value="Resolved" ${isEdit && String(editData.status || editData.Status) === "Resolved" ? "selected" : ""}>Resolved</option>
      </select>
      <label ${labelStyle}>Assigned Responder Entity</label><select id="m_tech" ${largeInput}></select>
      <label ${labelStyle}>Problem Narrative Description</label><textarea id="m_desc" rows="3" ${largeInput}>${isEdit ? escapeHtml(editData.description || editData.Description) : ""}</textarea>

      <label ${labelStyle}>Form Attachments</label>
      <div id="maintPreviews" class="modal-preview-grid" style="display:none;"></div>
      <label class="icon-upload-label"><i class="fas fa-paperclip"></i><input type="file" id="maintCameraInput" accept="image/*,application/pdf" style="display:none"></label>`;

    populateUnitDropdown("m_apt", isEdit ? getUnitNumber(editData) : "");
    const tSel = document.getElementById("m_tech");
    tSel.innerHTML = '<option value="">-- Unassigned Responder --</option>';
    (cache.staff || []).forEach((s) => {
      if (!s) return;
      const o = document.createElement("option");
      o.value = `${s.name || s.Name} (${s.role || s.Role})`;
      o.textContent = `${s.name || s.Name} [Staff]`;
      if (isEdit && (editData.tech || editData.Tech) === o.value)
        o.selected = true;
      tSel.appendChild(o);
    });
    (cache.vendors || []).forEach((v) => {
      if (!v) return;
      const o = document.createElement("option");
      o.value = `${v.company || v.Company} (${v.trade || v.Trade})`;
      o.textContent = `${v.company || v.Company} [Vendor]`;
      if (isEdit && (editData.tech || editData.Tech) === o.value)
        o.selected = true;
      tSel.appendChild(o);
    });

    if (isEdit && currentModalFiles.length > 0)
      populateModalInlineImageGalleryPreviews("maintPreviews");
    document.getElementById("maintCameraInput").onchange = (e) => {
      processIncomingMultiAttachments(e.target.files, "maintPreviews");
    };

    submit.onclick = () => {
      submit.disabled = true;
      submit.classList.add("loading");
      callApi(isEdit ? "updateMaintenance" : "saveMaintenance", {
        ticketId: uniqueTicket,
        apt: document.getElementById("m_apt").value,
        category: sanitizeInput(document.getElementById("m_category").value),
        priority: document.getElementById("m_priority").value,
        status: document.getElementById("m_status").value,
        tech: tSel.value,
        description: sanitizeInput(document.getElementById("m_desc").value),
        photos: currentModalFiles.join(","),
      })
        .then(() => {
          closeModal();
          refreshData("maintenance");
          showToast(isEdit ? "Ticket updated" : "Ticket logged", "success");
        })
        .catch(() => {
          submit.disabled = false;
          submit.classList.remove("loading");
        });
    };
  }
  // --- WORK ORDER ---
  else if (type === "workorder") {
    const uniqueWO = isEdit
      ? editData.workOrderId || editData.WorkOrderId
      : generateNextId("WO", cache.workorders, "workOrderId");
    title.innerText = isEdit
      ? "Work Order Portfolio"
      : "Log Work Order Expense";
    // [BUG FIX] Case-insensitive approved check
    const isApproved =
      isEdit &&
      String(editData.status || editData.Status || "").toUpperCase() ===
        "APPROVED";
    if (isEdit && (editData.attachments || editData.Attachments)) {
      currentModalFiles = String(editData.attachments || editData.Attachments)
        .split(",")
        .filter(Boolean);
    }

    const communicationButtons = isEdit
      ? `
      <div style="margin-top:15px; margin-bottom:15px; border-top:2px solid var(--border); padding-top:15px; border-bottom:2px solid var(--border); padding-bottom:15px; display:flex; gap:10px;">
        <button type="button" onclick="printSingleWorkOrderDirect('${escapeHtml(uniqueWO)}', true)" style="flex:1; background:#0D6EFD; color:#fff; border:none; padding:12px; border-radius:8px; font-weight:800; cursor:pointer; font-size:12px; text-transform:uppercase; box-shadow:0 2px 4px rgba(0,0,0,0.1); min-height:44px;">
          <i class="fas fa-paperclip"></i> Full PDF
        </button>
        <button type="button" onclick="printSingleWorkOrderDirect('${escapeHtml(uniqueWO)}', false)" style="flex:1; background:#6c757d; color:#fff; border:none; padding:12px; border-radius:8px; font-weight:800; cursor:pointer; font-size:12px; text-transform:uppercase; box-shadow:0 2px 4px rgba(0,0,0,0.1); min-height:44px;">
          <i class="fas fa-file-alt"></i> Text Only
        </button>
      </div>
    `
      : "";

    body.innerHTML = `
      <label ${labelStyle}>Work Order ID</label><input type="text" value="${escapeHtml(uniqueWO)}" disabled ${largeInput} style="background:#e9ecef; font-weight:900;">
      ${communicationButtons}
      <label ${labelStyle}>Date Logged</label><input id="w_date" type="date" value="${isEdit && (editData.date || editData.Date) ? fromSheetDate(editData.date || editData.Date) : new Date().toISOString().split("T")[0]}" ${largeInput} ${isApproved ? "disabled" : ""}>
      <label ${labelStyle}>Unit Node</label><select id="w_apt" ${largeInput} ${isApproved ? "disabled" : ""}></select>
      <label ${labelStyle}>Target Asset (Optional)</label><select id="w_asset" ${largeInput} ${isApproved ? "disabled" : ""}><option value="">-- No Specific Asset --</option></select>
      <label ${labelStyle}>Assigned</label><select id="w_assigned" ${largeInput} ${isApproved ? "disabled" : ""}></select>
      <label ${labelStyle}>Duration</label><input id="w_duration" type="text" value="${isEdit ? escapeHtml(editData.duration || editData.Duration || "") : ""}" placeholder="e.g. 3 Days, 1 Week" ${largeInput} ${isApproved ? "disabled" : ""}>

      <label ${labelStyle}>Submitted Value (₦)</label><input id="w_submitted_val" type="number" placeholder="Initial proposed cost" value="${isEdit ? escapeHtml(editData.submittedValue || editData.SubmittedValue || "") : ""}" ${largeInput} ${isApproved ? "disabled" : ""}>
      <label ${labelStyle}>Negotiated Value (₦)</label><input id="w_amount" type="number" required placeholder="Final agreed cost" value="${isEdit ? escapeHtml(editData.amount || editData.Amount || "") : ""}" ${largeInput} ${isApproved ? "disabled" : ""}>

      <label ${labelStyle}>Authorization Status</label>
      <select id="w_status" ${largeInput} ${isApproved ? "disabled" : ""}>
        <option value="Pending Approval" ${isEdit && String(editData.status || editData.Status) === "Pending Approval" ? "selected" : ""}>Pending Approval</option>
        <option value="Approved" ${isEdit && String(editData.status || editData.Status) === "Approved" ? "selected" : ""}>Approved</option>
        <option value="Declined" ${isEdit && String(editData.status || editData.Status) === "Declined" ? "selected" : ""}>Declined</option>
      </select>
      <label ${labelStyle}>Scope / Narrative</label><textarea id="w_desc" rows="3" ${largeInput} ${isApproved ? "disabled" : ""}>${isEdit ? escapeHtml(editData.description || editData.Description || "") : ""}</textarea>
      <label ${labelStyle}>Operational Remarks</label><textarea id="w_notes" rows="2" ${largeInput} ${isApproved ? "disabled" : ""}>${isEdit ? escapeHtml(editData.notes || editData.Notes || "") : ""}</textarea>

      <label ${labelStyle}>Supporting Attachments</label>
      <div id="woPreviews" class="modal-preview-grid" style="display:none;"></div>
      <label class="icon-upload-label" ${isApproved ? 'style="opacity:0.5; pointer-events:none;"' : ""}><i class="fas fa-paperclip"></i><input type="file" id="woCameraInput" accept="image/*,application/pdf" multiple style="display:none" ${isApproved ? "disabled" : ""}></label>
    `;

    populateUnitDropdown("w_apt", isEdit ? getUnitNumber(editData) : "");

    const assetSel = document.getElementById("w_asset");
    const populateAssets = (unitNum) => {
      assetSel.innerHTML =
        '<option value="">-- No Specific Asset (Unit Level) --</option>';
      if (!unitNum) return;
      const related = cache.assets.filter(
        (a) =>
          a &&
          String(getUnitNumber(a)) === String(unitNum) &&
          String(a.status || a.Status) !== "Archived",
      );
      related.forEach((a) => {
        const o = document.createElement("option");
        o.value = a.tag || a.Tag;
        o.textContent = `${a.type || "Asset"} (${a.tag || a.Tag})`;
        if (
          isEdit &&
          String(editData.asset || editData.Asset) === String(o.value)
        )
          o.selected = true;
        assetSel.appendChild(o);
      });
    };
    setTimeout(
      () => populateAssets(isEdit ? getUnitNumber(editData) : ""),
      100,
    );
    document
      .getElementById("w_apt")
      .addEventListener("change", (e) => populateAssets(e.target.value));

    const asSel = document.getElementById("w_assigned");
    asSel.innerHTML = '<option value="">-- Choose Participant --</option>';
    (cache.staff || []).forEach((s) => {
      if (!s) return;
      const o = document.createElement("option");
      o.value = `${s.name || s.Name} (${s.role || s.Role})`;
      o.textContent = `${s.name || s.Name} [Staff]`;
      if (isEdit && (editData.assigned || editData.Assigned) === o.value)
        o.selected = true;
      asSel.appendChild(o);
    });
    (cache.vendors || []).forEach((v) => {
      if (!v) return;
      const o = document.createElement("option");
      o.value = `${v.company || v.Company} (${v.trade || v.Trade})`;
      o.textContent = `${v.company || v.Company} [Vendor]`;
      if (isEdit && (editData.assigned || editData.Assigned) === o.value)
        o.selected = true;
      asSel.appendChild(o);
    });

    if (isEdit && currentModalFiles.length > 0)
      populateModalInlineImageGalleryPreviews("woPreviews");
    document.getElementById("woCameraInput").onchange = (e) => {
      processIncomingMultiAttachments(e.target.files, "woPreviews");
    };

    if (isApproved) {
      submit.style.display = "none";
    } else {
      submit.onclick = () => {
        const amtVal = document.getElementById("w_amount").value;
        if (!amtVal) {
          showToast("Negotiated Value is required.", "error");
          return;
        }
        submit.disabled = true;
        submit.classList.add("loading");
        callApi(isEdit ? "updateWorkOrder" : "saveWorkOrder", {
          workOrderId: uniqueWO,
          date: toSheetDate(document.getElementById("w_date").value),
          apt: document.getElementById("w_apt").value,
          asset: document.getElementById("w_asset").value,
          assigned: asSel.value,
          duration: sanitizeInput(document.getElementById("w_duration").value),
          submittedValue: document.getElementById("w_submitted_val").value,
          amount: amtVal,
          status: document.getElementById("w_status").value,
          description: sanitizeInput(document.getElementById("w_desc").value),
          notes: sanitizeInput(document.getElementById("w_notes").value),
          attachments: currentModalFiles.join(","),
        })
          .then(() => {
            closeModal();
            refreshData("workorders");
            showToast(
              isEdit ? "Work order updated" : "Work order saved",
              "success",
            );
          })
          .catch(() => {
            submit.disabled = false;
            submit.classList.remove("loading");
          });
      };
    }
  }
  // --- PAYMENT ---
  else if (type === "payment") {
    const uniqueId = isEdit
      ? editData.paymentId
      : generateNextId("PAY", cache.payments, "paymentId");
    title.innerText = isEdit ? "Edit Ledger Record" : "Log Financial Ledger";
    // [BUG FIX] Case-insensitive paid check with fallback to IsPaid
    const isAlreadyPaid =
      isEdit &&
      (String(editData.isPaid || editData.IsPaid || "").toUpperCase() ===
        "TRUE" ||
        editData.isPaid === true ||
        editData.IsPaid === true);
    const disabledState = isAlreadyPaid ? "disabled" : "";

    if (isEdit && (editData.attachments || editData.Attachments)) {
      currentModalFiles = String(editData.attachments || editData.Attachments)
        .split(",")
        .filter(Boolean);
    }

    let partyOpts = "";
    (cache.apts || []).forEach((a) => {
      if (a && a.tenant && a.tenant.toLowerCase() !== "services")
        partyOpts += `<option value="${escapeHtml(a.tenant)}">`;
    });
    (cache.staff || []).forEach((s) => {
      if (s && s.name) partyOpts += `<option value="${escapeHtml(s.name)}">`;
    });
    (cache.vendors || []).forEach((v) => {
      if (v && v.company)
        partyOpts += `<option value="${escapeHtml(v.company)}">`;
    });

    let inflowRefOpts = '<option value="">-- No Linked Unit --</option>';
    (cache.apts || []).forEach((a) => {
      if (!a) return;
      const uNum = getUnitNumber(a);
      if (uNum && String(a.type).toLowerCase() !== "services") {
        const valStr = `Unit ${uNum}`;
        inflowRefOpts += `<option value="${escapeHtml(valStr)}" ${isEdit && editData.reference === valStr ? "selected" : ""}>${escapeHtml(valStr)} - ${escapeHtml(a.tenant || "Vacant")}</option>`;
      }
    });

    let outflowRefOpts = '<option value="">-- No Linked Record --</option>';
    const approvedWOs = (cache.workorders || []).filter(
      (w) =>
        w && String(w.status || w.Status || "").toUpperCase() === "APPROVED",
    );
    const expReqs = cache.expenseRequests || [];

    if (approvedWOs.length > 0) {
      outflowRefOpts += '<optgroup label="Approved Work Orders">';
      approvedWOs.forEach((w) => {
        const wid = w.workOrderId || w.WorkOrderId;
        outflowRefOpts += `<option value="${escapeHtml(wid)}" ${isEdit && editData.reference === wid ? "selected" : ""}>${escapeHtml(wid)} - ₦${formatMoney(w.amount)}</option>`;
      });
      outflowRefOpts += "</optgroup>";
    }
    if (expReqs.length > 0) {
      outflowRefOpts += '<optgroup label="Expense Requests">';
      expReqs.forEach((r) => {
        if (!r) return;
        outflowRefOpts += `<option value="${escapeHtml(r.reqId)}" ${isEdit && editData.reference === r.reqId ? "selected" : ""}>${escapeHtml(r.reqId)} - ₦${formatMoney(r.cost)}</option>`;
      });
      outflowRefOpts += "</optgroup>";
    }
    if (approvedWOs.length === 0 && expReqs.length === 0) {
      outflowRefOpts +=
        "<option disabled>⚠️ No Approved Records Available</option>";
    }

    body.innerHTML = `
      <label ${labelStyle}>Payment ID</label><input type="text" value="${escapeHtml(uniqueId)}" disabled ${largeInput} style="background:#e9ecef; font-weight:900;">
      <label ${labelStyle}>Transaction Direction</label>
      <select id="p_direction" ${largeInput} ${disabledState}>
        <option value="INFLOW" ${isEdit && (editData.direction === "INFLOW" || editData.Direction === "INFLOW") ? "selected" : ""}>INFLOW (+ Receivables)</option>
        <option value="OUTFLOW" ${isEdit && (editData.direction === "OUTFLOW" || editData.Direction === "OUTFLOW") ? "selected" : ""}>OUTFLOW (- Payables)</option>
      </select>

      <label ${labelStyle}>Party / Payer / Payee Name</label>
      <input list="party_list" id="p_party" value="${isEdit ? escapeHtml(editData.party || editData.Party || "") : ""}" placeholder="Type or select from list..." ${largeInput} ${disabledState}>
      <datalist id="party_list">${partyOpts}</datalist>

      <label ${labelStyle}>Bank Name</label>
      <input list="bank_list" id="p_bank" type="text" value="${isEdit ? escapeHtml(editData.bank || editData.Bank || "") : ""}" placeholder="e.g. GTBank, Zenith, Access" ${largeInput} ${disabledState}>
      <datalist id="bank_list">
        <option value="Access Bank"><option value="First Bank"><option value="GTBank"><option value="Kuda Bank"><option value="Moniepoint"><option value="Opay"><option value="UBA"><option value="Zenith Bank">
      </datalist>

      <label ${labelStyle}>Account Number (10 Digits)</label>
      <input id="p_account" type="text" inputmode="numeric" maxlength="10" oninput="this.value=this.value.replace(/[^0-9]/g,'')" value="${isEdit ? escapeHtml(editData.account || editData.Account || "") : ""}" placeholder="e.g. 0123456789" ${largeInput} ${disabledState}>

      <label ${labelStyle}>Linked Record</label>
      <select id="p_reference" ${largeInput} ${disabledState}></select>

      <label ${labelStyle}>Classification Note</label><input id="p_type" value="${isEdit ? escapeHtml(editData.type || editData.Type || "") : ""}" placeholder="e.g. Rent, Vendor Payment" ${largeInput} ${disabledState}>
      <label ${labelStyle}>Reason / Justification</label><textarea id="p_reason" rows="2" placeholder="Describe the transaction..." ${largeInput} ${disabledState}>${isEdit ? escapeHtml(editData.reason || editData.Reason || "") : ""}</textarea>

      <div style="background:#f8f9fa; padding:15px; border-radius:8px; border:1px solid #dee2e6; margin:15px 0;">
        <h4 style="margin-top:0; margin-bottom:10px; font-size:13px; color:#6c757d; text-transform:uppercase; letter-spacing:0.5px;">Contract Financials</h4>

        <label ${labelStyle}>Total Job Value (₦)</label>
        <input id="p_total_job" type="number" value="${isEdit ? escapeHtml(editData.totalJobValue || editData.TotalJobValue || "") : ""}" placeholder="e.g. 500000" ${largeInput} ${disabledState}>

        <label ${labelStyle}>Paid to Date (₦)</label>
        <input id="p_paid_todate" type="number" value="${isEdit ? escapeHtml(editData.paidToDate || editData.PaidToDate || "") : ""}" placeholder="Amount already paid" ${largeInput} ${disabledState}>

        <label ${labelStyle}>Amount to Pay (₦)</label>
        <input id="p_amount" type="number" required value="${isEdit ? escapeHtml(editData.amount || editData.Amount || "") : ""}" placeholder="Current payment amount" ${largeInput} style="border-color:var(--primary); border-width:3px;" ${disabledState}>

        <label ${labelStyle}>Balance Due (₦)</label>
        <input id="p_balance_due" type="number" value="${isEdit ? escapeHtml(editData.balanceDue || editData.BalanceDue || "") : ""}" placeholder="Remaining balance" ${largeInput} ${disabledState}>
      </div>

      <label ${labelStyle}>Date</label><input id="p_date" type="date" value="${isEdit ? fromSheetDate(editData.date || editData.Date) : new Date().toISOString().split("T")[0]}" ${largeInput} ${disabledState}>

      <div style="margin-top: 15px; padding: 12px; border: 2px solid ${isAlreadyPaid ? "#198754" : "#DEE2E6"}; border-radius: 12px; background: ${isAlreadyPaid ? "#E8F5E9" : "#F8F9FA"};">
        <label style="display: flex; align-items: center; gap: 10px; margin: 0; cursor: pointer;">
          <input type="checkbox" id="p_is_paid" style="width: 24px; height: 24px; margin: 0;" ${isAlreadyPaid ? "checked disabled" : ""}>
          <span style="color: ${isAlreadyPaid ? "#198754" : "#212529"}; font-weight: 900; font-size: 16px;">
             ${isAlreadyPaid ? '<i class="fas fa-lock"></i> STATUS: PAID & LOCKED' : "MARK AS PAID / CLEARED"}
          </span>
        </label>
        ${isAlreadyPaid ? '<p style="margin: 4px 0 0 0; font-size: 12px; color: #198754;">This ledger record has been settled and cannot be modified.</p>' : ""}
      </div>

      <label ${labelStyle} style="margin-top:15px;">Supporting Attachments</label>
      <div id="paymentPreviews" class="modal-preview-grid" style="${currentModalFiles.length > 0 ? "" : "display:none;"}"></div>

      ${isAlreadyPaid ? "" : `<label class="icon-upload-label"><i class="fas fa-paperclip"></i><input type="file" id="p_multi_uploader" accept="image/*,application/pdf" multiple style="display:none"></label>`}
    `;

    if (isAlreadyPaid) {
      submit.style.display = "none";
    } else {
      submit.style.display = "block";
    }

    const pDir = document.getElementById("p_direction");
    const pRef = document.getElementById("p_reference");

    const updateRefDropdown = () => {
      pRef.innerHTML = pDir.value === "INFLOW" ? inflowRefOpts : outflowRefOpts;
    };
    pDir.addEventListener("change", updateRefDropdown);
    updateRefDropdown();

    document.getElementById("p_party").addEventListener("change", (e) => {
      const selectedParty = e.target.value.trim();
      if (!selectedParty) return;
      const vendorMatch = cache.vendors.find(
        (v) => v && (v.company || v.Company) === selectedParty,
      );
      if (vendorMatch && (vendorMatch.account || vendorMatch.Account)) {
        document.getElementById("p_bank").value =
          vendorMatch.bank || vendorMatch.Bank || "";
        document.getElementById("p_account").value =
          vendorMatch.account || vendorMatch.Account || "";
        return;
      }
      const staffMatch = cache.staff.find(
        (s) => s && (s.name || s.Name) === selectedParty,
      );
      if (staffMatch && (staffMatch.account || staffMatch.Account)) {
        document.getElementById("p_bank").value =
          staffMatch.bank || staffMatch.Bank || "";
        document.getElementById("p_account").value =
          staffMatch.account || staffMatch.Account || "";
        return;
      }
    });

    const calcBalance = () => {
      const tjv = parseFloat(document.getElementById("p_total_job").value) || 0;
      const ptd =
        parseFloat(document.getElementById("p_paid_todate").value) || 0;
      const amt = parseFloat(document.getElementById("p_amount").value) || 0;
      if (tjv > 0)
        document.getElementById("p_balance_due").value = tjv - ptd - amt;
    };
    ["p_total_job", "p_paid_todate", "p_amount"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", calcBalance);
    });

    if (isEdit && currentModalFiles.length > 0)
      populateModalInlineImageGalleryPreviews("paymentPreviews");

    const uploader = document.getElementById("p_multi_uploader");
    if (uploader) {
      uploader.onchange = (e) => {
        processIncomingMultiAttachments(e.target.files, "paymentPreviews");
      };
    }

    submit.onclick = () => {
      const amtVal = document.getElementById("p_amount").value;
      if (!amtVal) {
        showToast("Amount to Pay is required.", "error");
        return;
      }

      let accVal = document.getElementById("p_account").value;
      if (accVal) accVal = String(accVal).padStart(10, "0");
      if (accVal && accVal.length !== 10) {
        showToast("Account Number must be exactly 10 digits.", "error");
        return;
      }

      submit.disabled = true;
      submit.classList.add("loading");

      callApi(isEdit ? "updatePayment" : "savePayment", {
        paymentId: uniqueId,
        direction: document.getElementById("p_direction").value,
        party: sanitizeInput(document.getElementById("p_party").value),
        bank: sanitizeInput(document.getElementById("p_bank").value),
        account: accVal,
        reference: document.getElementById("p_reference").value,
        type: sanitizeInput(document.getElementById("p_type").value),
        reason: sanitizeInput(document.getElementById("p_reason").value),
        totalJobValue: document.getElementById("p_total_job").value,
        paidToDate: document.getElementById("p_paid_todate").value,
        amount: amtVal,
        balanceDue: document.getElementById("p_balance_due").value,
        date: toSheetDate(document.getElementById("p_date").value),
        isPaid: document.getElementById("p_is_paid").checked,
        attachments: currentModalFiles.join(","),
      })
        .then(() => {
          closeModal();
          refreshData("payments");
          showToast(isEdit ? "Payment updated" : "Payment saved", "success");
        })
        .catch(() => {
          submit.disabled = false;
          submit.classList.remove("loading");
        });
    };
  }
  // --- INVENTORY ---
  else if (type === "inventory") {
    const uniqueItem = isEdit
      ? editData.itemId || editData.ItemId
      : generateNextId("INV", cache.inventory, "itemId");
    title.innerText = isEdit
      ? "Edit Stock Ledger Item"
      : "Register New Inventory Item";
    body.innerHTML = `
      <label ${labelStyle}>Item Identity Code</label><input id="i_id" value="${escapeHtml(uniqueItem)}" disabled ${largeInput}>
      <label ${labelStyle}>Material Item / Resource Name</label><input id="i_name" value="${isEdit ? escapeHtml(editData.name || editData.Name) : ""}" placeholder="e.g. Led Bulb 18W" ${largeInput}>
      <label ${labelStyle}>Resource Stock Quantity</label><input id="i_qty" type="number" value="${isEdit ? escapeHtml(editData.qty || editData.Qty) : "0"}" ${largeInput}>
      <label ${labelStyle}>Material Category Classification</label><input id="i_category" value="${isEdit ? escapeHtml(editData.category || editData.Category) : ""}" placeholder="e.g. Electrical" ${largeInput}>
      <label ${labelStyle}>Restock Minimum Alert Threshold</label><input id="i_min" type="number" value="${isEdit ? escapeHtml(editData.minAlert || editData.MinAlert) : "5"}" ${largeInput}>
      <label ${labelStyle}>Warehouse Location Placement Notes</label><textarea id="i_notes" rows="2" ${largeInput}>${isEdit ? escapeHtml(editData.notes || editData.Notes) : ""}</textarea>

      <label ${labelStyle}>Archive Profile State</label>
      <select id="i_archived" ${largeInput}>
        <option value="No" ${isEdit && String(editData.archived || editData.Archived) === "Yes" ? "" : "selected"}>Active Asset Track</option>
        <option value="Yes" ${isEdit && String(editData.archived || editData.Archived) === "Yes" ? "selected" : ""}>Archived / Pinned Out</option>
      </select>`;

    submit.onclick = () => {
      submit.disabled = true;
      submit.classList.add("loading");
      callApi(isEdit ? "updateInventory" : "saveInventory", {
        itemId: uniqueItem,
        name: sanitizeInput(document.getElementById("i_name").value),
        qty: document.getElementById("i_qty").value,
        category: sanitizeInput(document.getElementById("i_category").value),
        minAlert: document.getElementById("i_min").value,
        notes: sanitizeInput(document.getElementById("i_notes").value),
        archived: document.getElementById("i_archived").value,
      })
        .then(() => {
          closeModal();
          refreshData("inventory");
          showToast(isEdit ? "Item updated" : "Item registered", "success");
        })
        .catch(() => {
          submit.disabled = false;
          submit.classList.remove("loading");
        });
    };
  }
  // --- UTILITY ---
  else if (type === "utility") {
    title.innerText = isEdit ? "Update Utility Data" : "Record Utility Data";
    body.innerHTML = `
      <label ${labelStyle}>Select Asset Unit</label><select id="u_apt" ${largeInput}></select>
      <label ${labelStyle}>Utility Profile Class</label>
      <select id="u_type" ${largeInput}>
        <option value="Electricity" ${isEdit && String(editData.type) === "Electricity" ? "selected" : ""}>Electricity Meter</option>
        <option value="Water" ${isEdit && String(editData.type) === "Water" ? "selected" : ""}>Water Gauge</option>
      </select>
      <label ${labelStyle}>Meter Box Serial No</label><input id="u_meter" value="${isEdit ? escapeHtml(editData.meterNo || "") : ""}" disabled ${largeInput}>
      <label ${labelStyle}>Consumption Meter Reading</label><input id="u_reading" type="number" value="${isEdit ? escapeHtml(editData.reading || "") : ""}" ${largeInput}>
      <label ${labelStyle}>Token Purchase Cost (₦)</label><input id="u_amount" type="number" value="${isEdit ? escapeHtml(editData.amount || editData.Amount || "") : ""}" ${largeInput}>
      <label ${labelStyle}>Log Notes</label><textarea id="u_notes" rows="2" ${largeInput}>${isEdit ? escapeHtml(editData.notes || "") : ""}</textarea>`;

    populateUnitDropdown("u_apt", isEdit ? getUnitNumber(editData) : "");
    submit.onclick = () => {
      submit.disabled = true;
      submit.classList.add("loading");
      callApi(isEdit ? "updateUtility" : "saveUtility", {
        rowId: isEdit ? editData.rowId || editData.id || "" : "",
        apt: document.getElementById("u_apt").value,
        type: document.getElementById("u_type").value,
        meterNo: sanitizeInput(document.getElementById("u_meter").value),
        reading: document.getElementById("u_reading").value,
        amount: document.getElementById("u_amount").value,
        notes: sanitizeInput(document.getElementById("u_notes").value),
        photos: isEdit ? editData.photos || "" : "",
      })
        .then(() => {
          closeModal();
          refreshData("utilities");
          showToast(isEdit ? "Utility updated" : "Utility logged", "success");
        })
        .catch(() => {
          submit.disabled = false;
          submit.classList.remove("loading");
        });
    };
  }
  // --- GENERATOR ---
  else if (type === "generator") {
    title.innerText = isEdit ? "Update Plant Status" : "Log Plant Status";
    body.innerHTML = `
      <label ${labelStyle}>Select Heavy Plant Machine</label>
      <select id="g_equipment" ${largeInput}>
        <option value="GENERATOR-1" ${isEdit && String(editData.apt || editData.Apt) === "GENERATOR-1" ? "selected" : ""}>Generator 1 (Main)</option>
        <option value="GENERATOR-2" ${isEdit && String(editData.apt || editData.Apt) === "GENERATOR-2" ? "selected" : ""}>Generator 2 (Backup)</option>
        <option value="DIESEL-TANK" ${isEdit && String(editData.apt || editData.Apt) === "DIESEL-TANK" ? "selected" : ""}>Bulk Diesel Fuel Reservoir</option>
      </select>
      <label ${labelStyle}>S/N</label><input id="g_sn" value="${isEdit ? escapeHtml(editData.sn || editData.SN || "") : ""}" disabled ${largeInput}>
      <label ${labelStyle}>Engine Run Hours Meter</label><input id="g_reading" type="number" step="0.1" value="${isEdit ? escapeHtml(editData.reading || "") : ""}" ${largeInput}>
      <label ${labelStyle}>Tank Current Storage Capacity Level</label>
      <select id="g_tank" ${largeInput}>
        <option value="Tank Level: Full (100%)" ${isEdit && String(editData.meterNo) === "Tank Level: Full (100%)" ? "selected" : ""}>Full (100%)</option>
        <option value="Tank Level: Half Full (50%)" ${isEdit && String(editData.meterNo) === "Tank Level: Half Full (50%)" ? "selected" : ""}>Half Full (50%)</option>
        <option value="Tank Level: Critical (10%)" ${isEdit && String(editData.meterNo) === "Tank Level: Critical (10%)" ? "selected" : ""}>Critical Threshold (10%)</option>
      </select>
      <label ${labelStyle}>Diesel Liters Added</label><input id="g_added" type="number" value="${isEdit ? escapeHtml(editData.amount || editData.Amount || "") : ""}" ${largeInput}>
      <label ${labelStyle}>Field Observations Remark</label><textarea id="g_notes" rows="2" ${largeInput}>${isEdit ? escapeHtml(editData.notes || "") : ""}</textarea>`;

    setTimeout(() => {
      const updatePlantSN = () => {
        const eq = document.getElementById("g_equipment").value;
        const snInput = document.getElementById("g_sn");
        if (!snInput) return;
        if (isEdit && editData.sn) {
          snInput.value = editData.sn;
          return;
        }
        if (eq === "GENERATOR-1") snInput.value = "SN-G1-MAIN-101";
        else if (eq === "GENERATOR-2") snInput.value = "SN-G2-STBY-202";
        else if (eq === "DIESEL-TANK") snInput.value = "SN-DT-BULK-303";
      };
      document
        .getElementById("g_equipment")
        .addEventListener("change", updatePlantSN);
      updatePlantSN();
    }, 0);

    submit.onclick = () => {
      submit.disabled = true;
      submit.classList.add("loading");
      callApi(isEdit ? "updateUtility" : "saveUtility", {
        rowId: isEdit ? editData.rowId || editData.id || "" : "",
        apt: document.getElementById("g_equipment").value,
        type: "Plant Check",
        meterNo: document.getElementById("g_tank").value,
        reading: document.getElementById("g_reading").value,
        amount: document.getElementById("g_added").value || 0,
        notes: sanitizeInput(document.getElementById("g_notes").value),
        photos: isEdit ? editData.photos || "" : "",
        sn: document.getElementById("g_sn").value,
      })
        .then(() => {
          closeModal();
          refreshData("utilities");
          showToast(
            isEdit ? "Plant log updated" : "Plant log saved",
            "success",
          );
        })
        .catch(() => {
          submit.disabled = false;
          submit.classList.remove("loading");
        });
    };
  }
  // --- STAFF ---
  else if (type === "staff") {
    const uniqueId = isEdit
      ? editData.rowId || editData.RowId
      : generateNextId("STF", cache.staff, "rowId");
    title.innerText = "Staff Profile Management";
    currentAvatarPhoto = isEdit ? editData.passport || editData.Passport : "";
    if (isEdit && (editData.attachments || editData.Attachments)) {
      currentModalFiles = String(editData.attachments || editData.Attachments)
        .split(",")
        .filter(Boolean);
    }

    body.innerHTML = `
      <div class="passport-frame-container" style="position:relative;">
        <img id="passport_frame_view" src="${currentAvatarPhoto ? getDirectImageUrl(currentAvatarPhoto) : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='60' height='60'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%236c757d'/%3E%3C/svg%3E"}" style="width:100%; height:100%; object-fit:cover;" alt="Staff photo">
        <label style="position:absolute; bottom:2px; right:2px; background:var(--primary); color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #fff; cursor:pointer;">
          <i class="fas fa-camera" style="font-size:12px;"></i>
          <input type="file" id="st_pass_uploader" accept="image/*" capture="environment" style="display:none">
        </label>
        <div id="p_avatar_remove_btn" onclick="clearAvatarPhotoFrame()" style="position:absolute; top:2px; right:2px; background:var(--danger); color:white; border:2px solid white; border-radius:50%; width:22px; height:22px; display:${currentAvatarPhoto ? "flex" : "none"}; align-items:center; justify-content:center; font-size:12px; font-weight:900; cursor:pointer; z-index:15;" role="button" aria-label="Remove photo">&times;</div>
      </div>

      <label ${labelStyle}>Staff ID</label><input id="st_id" value="${escapeHtml(uniqueId)}" ${largeInput} ${isEdit ? "disabled" : ""}>
      <label ${labelStyle}>Employee Full Name</label><input id="st_name" value="${isEdit ? escapeHtml(editData.name || editData.Name) : ""}" ${largeInput}>
      <label ${labelStyle}>Contact Address</label><input id="st_address" value="${isEdit ? escapeHtml(editData.address || editData.Address || "") : ""}" ${largeInput}>
      <label ${labelStyle}>Core Specialization / Role</label><input id="st_role" value="${isEdit ? escapeHtml(editData.role || editData.Role) : ""}" ${largeInput}>
      <label ${labelStyle}>Phone 1</label><input id="st_p1" type="tel" maxlength="11" inputmode="numeric" oninput="this.value=this.value.replace(/[^0-9]/g,'')" value="${isEdit ? escapeHtml(editData.phone1 || editData.Phone1 || "") : ""}" ${largeInput}>
      <label ${labelStyle}>Phone 2</label><input id="st_p2" type="tel" maxlength="11" inputmode="numeric" oninput="this.value=this.value.replace(/[^0-9]/g,'')" value="${isEdit ? escapeHtml(editData.phone2 || editData.Phone2 || "") : ""}" ${largeInput}>
      <label ${labelStyle}>Staff Email Address</label><input id="st_email" type="email" value="${isEdit ? escapeHtml(editData.email || editData.Email || "") : ""}" ${largeInput}>
      <label ${labelStyle}>Bank Name</label>
      <input list="bank_list" id="st_bank" value="${isEdit ? escapeHtml(editData.bank || editData.Bank || "") : ""}" placeholder="e.g. GTBank" ${largeInput}>
      <label ${labelStyle}>Account Number</label>
      <input id="st_account" type="text" inputmode="numeric" maxlength="10" oninput="this.value=this.value.replace(/[^0-9]/g,'')" value="${isEdit ? escapeHtml(editData.account || editData.Account || "") : ""}" placeholder="10 Digit Account Number" ${largeInput}>

      <label ${labelStyle}>Profile Archive Lifecycle Deployment State</label>
      <select id="st_archived" ${largeInput}>
        <option value="No" ${isEdit && String(editData.archived || editData.Archived) === "No" ? "selected" : ""}>Active Member</option>
        <option value="Yes" ${isEdit && String(editData.archived || editData.Archived) === "Yes" ? "selected" : ""}>Archived / Deactivated Account</option>
      </select>

      <label ${labelStyle}>Form Attachments</label>
      <div id="stAttachmentsPreviews" class="modal-preview-grid" style="display:none;"></div>
      <label class="icon-upload-label"><i class="fas fa-paperclip"></i><input type="file" id="st_multi_uploader" accept="image/*,application/pdf" multiple style="display:none"></label>`;

    if (isEdit && currentModalFiles.length > 0)
      populateModalInlineImageGalleryPreviews("stAttachmentsPreviews");

    document.getElementById("st_pass_uploader").onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = async (evt) => {
        let comp = evt.target.result;
        if (file.size > 200 * 1024) {
          comp = await compressImageToTargetLimit(evt.target.result, 185000);
        }
        callApi("uploadImage", {
          base64: comp,
          name: "pass_" + uniqueId + ".jpg",
        }).then((res) => {
          if (res && res.url) {
            currentAvatarPhoto = res.url;
            document.getElementById("passport_frame_view").src =
              getDirectImageUrl(res.url);
            document.getElementById("p_avatar_remove_btn").style.display =
              "flex";
          }
        });
      };
      r.readAsDataURL(file);
    };
    document.getElementById("st_multi_uploader").onchange = (e) => {
      processIncomingMultiAttachments(e.target.files, "stAttachmentsPreviews");
    };

    submit.onclick = () => {
      const p1 = document.getElementById("st_p1").value;
      const p2 = document.getElementById("st_p2").value;
      if (!p1 || p1.length !== 11) {
        showToast("Phone 1 must be exactly 11 digits.", "error");
        return;
      }
      if (p2 && p2.length !== 11) {
        showToast("Phone 2 must be exactly 11 digits if provided.", "error");
        return;
      }
      submit.disabled = true;
      submit.classList.add("loading");

      callApi(isEdit ? "updateStaff" : "saveStaff", {
        rowId: document.getElementById("st_id").value,
        name: sanitizeInput(document.getElementById("st_name").value),
        address: sanitizeInput(document.getElementById("st_address").value),
        role: sanitizeInput(document.getElementById("st_role").value),
        phone1: String(p1),
        phone2: String(p2),
        email: sanitizeInput(document.getElementById("st_email").value),
        bank: sanitizeInput(document.getElementById("st_bank").value),
        account: String(document.getElementById("st_account").value).padStart(
          10,
          "0",
        ),
        passport: currentAvatarPhoto,
        attachments: currentModalFiles.join(","),
        archived: document.getElementById("st_archived").value,
      })
        .then(() => {
          closeModal();
          refreshData("staff");
          showToast(isEdit ? "Staff updated" : "Staff registered", "success");
        })
        .catch(() => {
          submit.disabled = false;
          submit.classList.remove("loading");
        });
    };
  }
  // --- VENDOR ---
  else if (type === "vendor") {
    const uniqueId = isEdit
      ? editData.rowId || editData.RowId
      : generateNextId("VND", cache.vendors, "rowId");
    title.innerText = "Vendor SLA Registry Profile";
    currentAvatarPhoto = isEdit ? editData.passport || editData.Passport : "";
    if (isEdit && (editData.attachments || editData.Attachments)) {
      currentModalFiles = String(editData.attachments || editData.Attachments)
        .split(",")
        .filter(Boolean);
    }

    let vPhone1 = isEdit
      ? String(editData.phone1 || editData.Phone1 || "").replace(/[^0-9]/g, "")
      : "";
    if (vPhone1.length === 10 && !vPhone1.startsWith("0"))
      vPhone1 = "0" + vPhone1;
    let vPhone2 = isEdit
      ? String(editData.phone2 || editData.Phone2 || "").replace(/[^0-9]/g, "")
      : "";
    if (vPhone2.length === 10 && !vPhone2.startsWith("0"))
      vPhone2 = "0" + vPhone2;

    body.innerHTML = `
      <div class="passport-frame-container" style="position:relative;">
        <img id="vendor_frame_view" src="${currentAvatarPhoto ? getDirectImageUrl(currentAvatarPhoto) : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='60' height='60'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%236c757d'/%3E%3C/svg%3E"}" style="width:100%; height:100%; object-fit:cover;" alt="Vendor photo">
        <label style="position:absolute; bottom:2px; right:2px; background:var(--primary); color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #fff; cursor:pointer;">
          <i class="fas fa-camera" style="font-size:12px;"></i>
          <input type="file" id="v_pass_uploader" accept="image/*" capture="environment" style="display:none">
        </label>
        <div id="p_avatar_remove_btn" onclick="clearAvatarPhotoFrame()" style="position:absolute; top:2px; right:2px; background:var(--danger); color:white; border:2px solid white; border-radius:50%; width:22px; height:22px; display:${currentAvatarPhoto ? "flex" : "none"}; align-items:center; justify-content:center; font-size:12px; font-weight:900; cursor:pointer; z-index:15;" role="button" aria-label="Remove photo">&times;</div>
      </div>

      <label ${labelStyle}>Vendor ID</label><input id="v_id" value="${escapeHtml(uniqueId)}" ${largeInput} ${isEdit ? "disabled" : ""}>
      <label ${labelStyle}>Corporate Entity Name</label><input id="v_company" value="${isEdit ? escapeHtml(editData.company || editData.Company) : ""}" ${largeInput}>
      <label ${labelStyle}>Business Address</label><input id="v_address" value="${isEdit ? escapeHtml(editData.address || editData.Address || "") : ""}" ${largeInput}>
      <label ${labelStyle}>Trade Domain Specialization</label><input id="v_trade" value="${isEdit ? escapeHtml(editData.trade || editData.Trade) : ""}" ${largeInput}>
      <label ${labelStyle}>Primary Account Contact Name</label><input id="v_contact" value="${isEdit ? escapeHtml(editData.contactName || editData.ContactName) : ""}" ${largeInput}>
      <label ${labelStyle}>Phone 1</label><input id="v_phone1" type="tel" maxlength="11" inputmode="numeric" oninput="this.value=this.value.replace(/[^0-9]/g,'')" value="${escapeHtml(vPhone1)}" ${largeInput}>
      <label ${labelStyle}>Phone 2</label><input id="v_phone2" type="tel" maxlength="11" inputmode="numeric" oninput="this.value=this.value.replace(/[^0-9]/g,'')" value="${escapeHtml(vPhone2)}" ${largeInput}>
      <label ${labelStyle}>Corporate Support Email</label><input id="v_email" type="email" value="${isEdit ? escapeHtml(editData.email || editData.Email || "") : ""}" ${largeInput}>
      <label ${labelStyle}>Bank Name</label>
      <input list="bank_list" id="v_bank" value="${isEdit ? escapeHtml(editData.bank || editData.Bank || "") : ""}" placeholder="e.g. Zenith Bank" ${largeInput}>
      <label ${labelStyle}>Account Number</label>
      <input id="v_account" type="text" inputmode="numeric" maxlength="10" oninput="this.value=this.value.replace(/[^0-9]/g,'')" value="${isEdit ? escapeHtml(editData.account || editData.Account || "") : ""}" placeholder="10 Digit Account Number" ${largeInput}>
      <label ${labelStyle}>SLA Contract Expiration Timeline</label><input id="v_end" type="date" value="${isEdit ? fromSheetDate(editData.contractEnd || editData.ContractEnd) : ""}" ${largeInput}>

      <label ${labelStyle}>Archive Profile Account</label>
      <select id="v_archived" ${largeInput}>
        <option value="No" ${isEdit && String(editData.archived || editData.Archived) === "No" ? "selected" : ""}>Active Portfolio</option>
        <option value="Yes" ${isEdit && String(editData.archived || editData.Archived) === "Yes" ? "selected" : ""}>Archived</option>
      </select>

      <label ${labelStyle}>Form Attachments</label>
      <div id="vAttachmentsPreviews" class="modal-preview-grid" style="display:none;"></div>
      <label class="icon-upload-label"><i class="fas fa-paperclip"></i><input type="file" id="v_multi_uploader" accept="image/*,application/pdf" multiple style="display:none"></label>`;

    if (isEdit && currentModalFiles.length > 0)
      populateModalInlineImageGalleryPreviews("vAttachmentsPreviews");

    document.getElementById("v_pass_uploader").onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = async (evt) => {
        let comp = evt.target.result;
        if (file.size > 200 * 1024) {
          comp = await compressImageToTargetLimit(evt.target.result, 185000);
        }
        callApi("uploadImage", {
          base64: comp,
          name: "vpass_" + uniqueId + ".jpg",
        }).then((res) => {
          if (res && res.url) {
            currentAvatarPhoto = res.url;
            document.getElementById("vendor_frame_view").src =
              getDirectImageUrl(res.url);
            document.getElementById("p_avatar_remove_btn").style.display =
              "flex";
          }
        });
      };
      r.readAsDataURL(file);
    };
    document.getElementById("v_multi_uploader").onchange = (e) => {
      processIncomingMultiAttachments(e.target.files, "vAttachmentsPreviews");
    };

    submit.onclick = () => {
      const p1 = document.getElementById("v_phone1").value;
      const p2 = document.getElementById("v_phone2").value;
      if (!p1 || p1.length !== 11) {
        showToast("Phone 1 must be exactly 11 digits.", "error");
        return;
      }
      if (p2 && p2.length !== 11) {
        showToast("Phone 2 must be exactly 11 digits if provided.", "error");
        return;
      }
      submit.disabled = true;
      submit.classList.add("loading");

      callApi(isEdit ? "updateVendor" : "saveVendor", {
        rowId: document.getElementById("v_id").value,
        company: sanitizeInput(document.getElementById("v_company").value),
        address: sanitizeInput(document.getElementById("v_address").value),
        trade: sanitizeInput(document.getElementById("v_trade").value),
        contactName: sanitizeInput(document.getElementById("v_contact").value),
        phone1: String(p1),
        phone2: String(p2),
        email: sanitizeInput(document.getElementById("v_email").value),
        bank: sanitizeInput(document.getElementById("v_bank").value),
        account: String(document.getElementById("v_account").value).padStart(
          10,
          "0",
        ),
        contractEnd: toSheetDate(document.getElementById("v_end").value),
        passport: currentAvatarPhoto,
        attachments: currentModalFiles.join(","),
        archived: document.getElementById("v_archived").value,
      })
        .then(() => {
          closeModal();
          refreshData("vendors");
          showToast(isEdit ? "Vendor updated" : "Vendor registered", "success");
        })
        .catch(() => {
          submit.disabled = false;
          submit.classList.remove("loading");
        });
    };
  }

  // Focus first input
  setTimeout(() => {
    const firstInput = body.querySelector(
      "input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
    );
    if (firstInput) firstInput.focus();
  }, 100);
}

function closeModal() {
  const overlay = document.getElementById("modalOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    setTimeout(() => {
      overlay.style.display = "none";
      document.getElementById("modalBody").innerHTML = "";
    }, 200);
  }
  if (lastFocusedElement) lastFocusedElement.focus();
  bootstrapDataRegistriesPipeline();
}

// --- IMAGE COMPRESSION ---
function compressImageToTargetLimit(base64Str, targetMaxBytes) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width;
      let h = img.height;
      if (w > h) {
        if (w > 1000) {
          h *= 1000 / w;
          w = 1000;
        }
      } else {
        if (h > 1000) {
          w *= 1000 / h;
          h = 1000;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      let q = 0.8;
      let res = canvas.toDataURL("image/jpeg", q);
      while (res.length > targetMaxBytes && q > 0.15) {
        q -= 0.1;
        res = canvas.toDataURL("image/jpeg", q);
      }
      resolve(res);
    };
    img.onerror = () => resolve(base64Str);
  });
}

// --- PDF ENGINE ---
function normalizeReportSource(source) {
  if (typeof source === "string") {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = source;
    return wrapper;
  }
  return source;
}

async function compileAndDownloadUnifiedPDF(
  sourceElement,
  attachmentUrls = [],
  filename = "Facility_Report",
) {
  const normalizedSource = normalizeReportSource(sourceElement);
  if (!normalizedSource || typeof normalizedSource.cloneNode !== "function") {
    showToast("Report content is not ready yet.", "error");
    return;
  }

  const loadingScreen = document.createElement("div");
  loadingScreen.id = "pdf-loading-screen";
  loadingScreen.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.92); z-index: 999999;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: white; font-family: sans-serif;
  `;
  loadingScreen.innerHTML = `
    <i class="fas fa-server fa-spin" style="font-size: 50px; margin-bottom: 20px; color: #0D6EFD;"></i>
    <h2 style="margin: 0; letter-spacing: 1px;">Generating PDF...</h2>
    <p style="margin-top: 8px; color: #aaa; font-size: 14px;">Preparing a shareable document.</p>
  `;
  document.body.appendChild(loadingScreen);

  try {
    const clone = normalizedSource.cloneNode(true);

    const originalInputs = normalizedSource.querySelectorAll(
      "input, select, textarea",
    );
    const clonedInputs = clone.querySelectorAll("input, select, textarea");

    originalInputs.forEach((original, index) => {
      const cloneNode = clonedInputs[index];
      if (!cloneNode) return;
      const span = document.createElement("span");

      if (original.type === "checkbox" || original.type === "radio") {
        span.innerHTML = original.checked ? "<b>Yes</b>" : "No";
        span.style.fontSize = "14px";
      } else {
        span.textContent = original.value || original.textContent || "";
      }

      span.style.display = "inline-block";
      span.style.fontWeight = "bold";
      span.style.color = "#000";

      if (cloneNode.parentNode) {
        cloneNode.parentNode.replaceChild(span, cloneNode);
      }
    });

    const htmlContent = clone.innerHTML;

    const cleanHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; background: #fff; padding: 20px; font-size: 11px; }
            * { box-sizing: border-box; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 1px solid #444 !important; }
            th, td { text-align: left; padding: 8px; border: 1px solid #ccc !important; vertical-align: top; }
            th { background-color: #f8f9fa; }
            .grid, .flex-row { display: table; width: 100%; }
            .col { display: table-cell; padding: 4px; vertical-align: middle; }
            img { max-width: 100%; }
            td, th, span, label, strong { overflow-wrap: anywhere; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `;

    const response = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ action: "generatePDF", html: cleanHTML }),
    });

    let result;
    const text = await response.text();
    try {
      result = JSON.parse(text);
    } catch (e) {
      throw new Error("Invalid PDF response");
    }

    if (result.status !== "success")
      throw new Error(result.message || "PDF generation failed");
    if (!result.base64) throw new Error("No PDF data received");

    loadingScreen.querySelector("h2").innerText = "Processing Attachments...";
    const { PDFDocument, degrees, rgb } = PDFLib;

    const pdfBytes = Uint8Array.from(atob(result.base64), (c) =>
      c.charCodeAt(0),
    );
    const masterPdf = await PDFDocument.load(pdfBytes);

    if (attachmentUrls && attachmentUrls.length > 0) {
      for (let url of attachmentUrls) {
        if (!url) continue;
        let fileId = extractDriveFileId(url);
        if (!fileId) continue;

        try {
          const fileData = await callApi("getFileBase64", { id: fileId });
          if (fileData && fileData.status === "success" && fileData.base64) {
            const cleanBase64 = fileData.base64.replace(/\s/g, "");
            const bytes = Uint8Array.from(atob(cleanBase64), (c) =>
              c.charCodeAt(0),
            );
            // [BUG FIX] Use startsWith for mime type matching
            if (
              fileData.mimeType &&
              fileData.mimeType.startsWith("application/pdf")
            ) {
              const extPdf = await PDFDocument.load(bytes);
              const pages = await masterPdf.copyPages(
                extPdf,
                extPdf.getPageIndices(),
              );
              pages.forEach((p) => masterPdf.addPage(p));
            } else if (
              fileData.mimeType &&
              fileData.mimeType.startsWith("image/")
            ) {
              let img;
              if (fileData.mimeType === "image/png")
                img = await masterPdf.embedPng(bytes);
              else img = await masterPdf.embedJpg(bytes);
              const page = masterPdf.addPage();
              const ratio = Math.min(
                (page.getWidth() - 80) / img.width,
                (page.getHeight() - 80) / img.height,
                1,
              );
              page.drawImage(img, {
                x: (page.getWidth() - img.width * ratio) / 2,
                y: (page.getHeight() - img.height * ratio) / 2,
                width: img.width * ratio,
                height: img.height * ratio,
              });
            }
          }
        } catch (e) {
          console.error("Attachment error:", e);
        }
      }
    }

    const pages = masterPdf.getPages();
    pages.forEach((page, index) => {
      const { width, height } = page.getSize();
      page.drawText(`Page ${index + 1} of ${pages.length}`, {
        x: width - 110,
        y: 20,
        size: 10,
        color: rgb(0.4, 0.4, 0.4),
      });
      page.drawText("Facility Pro", {
        x: width / 4,
        y: height / 2,
        size: 48,
        rotate: degrees(-45),
        opacity: 0.08,
        color: rgb(0.5, 0.5, 0.5),
      });
    });

    loadingScreen.querySelector("h2").innerText = "Finishing up...";
    const finalPdfBytes = await masterPdf.save();
    const file = new File([finalPdfBytes], filename + ".pdf", {
      type: "application/pdf",
    });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: filename,
        text: "Facility Pro report attached.",
        files: [file],
      });
      loadingScreen.innerHTML =
        '<i class="fas fa-check-circle" style="font-size: 50px; margin-bottom: 20px; color: #198754;"></i><h2 style="margin: 0;">Shared Successfully!</h2>';
      showToast("PDF shared successfully", "success");
    } else {
      loadingScreen.innerHTML =
        '<i class="fas fa-download" style="font-size: 50px; margin-bottom: 20px; color: #198754;"></i><h2 style="margin: 0;">Downloading...</h2>';
      const blob = new Blob([finalPdfBytes], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename + ".pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(link.href), 3000);
      showToast("PDF downloaded", "success");
    }
  } catch (err) {
    console.error("PDF Generation Failed:", err);
    showToast("PDF generation failed. Check connection.", "error");
  } finally {
    setTimeout(() => {
      const screen = document.getElementById("pdf-loading-screen");
      if (screen) screen.remove();
    }, 2500);
  }
}

// --- PRINT FUNCTIONS ---
function printSingleWorkOrderDirect(woId, includeAttachments = true) {
  const orderItem = cache.workorders.find(
    (w) => w && String(w.workOrderId || w.WorkOrderId) === woId,
  );
  if (!orderItem) {
    showToast("Work order not found", "error");
    return;
  }
  const unitId = getUnitNumber(orderItem);

  let assetInfo = "N/A";
  if (orderItem.asset || orderItem.Asset) {
    const ast = cache.assets.find(
      (a) =>
        a &&
        String(a.tag || a.Tag) === String(orderItem.asset || orderItem.Asset),
    );
    assetInfo = ast
      ? `${ast.tag || "N/A"}; ${ast.type || "N/A"}; ${ast.specs || "N/A"}; ${ast.loc || ast.Loc || "N/A"}`
      : orderItem.asset || orderItem.Asset;
  }

  const woStatus = String(
    orderItem.status || orderItem.Status || "PENDING",
  ).toUpperCase();
  const statusBadge =
    woStatus === "APPROVED"
      ? `<span style="background-color: #198754; color: #ffffff; padding: 4px 10px; border-radius: 4px;">${escapeHtml(woStatus)}</span>`
      : escapeHtml(woStatus);

  let invoiceLayoutHtml = `
    <div style="width: 800px; padding: 20px 40px; font-family:'Inter', sans-serif; color:#000; background:#fff; box-sizing: border-box;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #000; padding-bottom:10px; margin-bottom:20px;">
        <div>
          <h2 style="font-size:32px; margin:0; text-transform:uppercase;">${escapeHtml(appSettings.estateName || "Work Order Dossier")}</h2>
          <small style="display:block; font-weight:700; color:#444; margin-top:2px;">Managed by: ${escapeHtml(appSettings.fmName || "Facility Pro Engine")}</small>
        </div>
        <div style="text-align:right; font-size:12px; font-weight:800;">PRINT DATE:<br>${new Date().toLocaleDateString()}</div>
      </div>

      <h3 style="text-transform: uppercase; margin-bottom: 15px;">Work Order Authorization Form</h3>
      <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:14px;">
        <tr><th style="width:30%; padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Work Order Ref</th><td style="padding:10px; border:1px solid #000;"><strong>${escapeHtml(orderItem.workOrderId || orderItem.WorkOrderId)}</strong></td></tr>
        <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Date Logged</th><td style="padding:10px; border:1px solid #000;">${formatDateForDisplay(orderItem.date || orderItem.Date)}</td></tr>
        <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Target Node</th><td style="padding:10px; border:1px solid #000;">Unit ${escapeHtml(unitId)} | Asset: ${escapeHtml(assetInfo)}</td></tr>
        <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Assigned</th><td style="padding:10px; border:1px solid #000;">${escapeHtml(orderItem.assigned || orderItem.Assigned || "Unassigned")}</td></tr>
        <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Project Duration</th><td style="padding:10px; border:1px solid #000;">${escapeHtml(orderItem.duration || orderItem.Duration || "Not Specified")}</td></tr>
        <tr><th style="padding:10px; border:1px solid #000; background:#f9f9f9; text-align:left;">Submitted Value</th><td style="padding:10px; border:1px solid #000; background:#f9f9f9; font-size:15px; color:#555;"><strong>₦${formatMoney(orderItem.submittedValue || orderItem.SubmittedValue)}</strong></td></tr>
        <tr><th style="padding:10px; border:1px solid #000; background:#e8f4fd; text-align:left;">Negotiated Value</th><td style="padding:10px; border:1px solid #000; background:#e8f4fd; font-size:18px;"><strong>₦${formatMoney(orderItem.amount || orderItem.Amount)}</strong></td></tr>
        <tr><th style="padding:10px; border:1px solid #000; background:#f9f9f9; text-align:left;">Amount in Words</th><td style="padding:10px; border:1px solid #000; font-style:italic;"><strong>${convertAmountToWords(orderItem.amount || orderItem.Amount)}</strong></td></tr>
        <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Lifecycle Auth Status</th><td style="padding:10px; border:1px solid #000;"><strong>${statusBadge}</strong></td></tr>
        <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left; vertical-align:top;">Scope / Narrative</th><td style="padding:10px; border:1px solid #000;">${escapeHtml(orderItem.description || orderItem.Description || "No description provided.")}</td></tr>
        <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left; vertical-align:top;">Operational Remarks</th><td style="padding:10px; border:1px solid #000;">${escapeHtml(orderItem.notes || orderItem.Notes || "No operational feedback logged.")}</td></tr>
      </table>
    </div>`;

  let attachmentsArr = [];
  if (includeAttachments && (orderItem.attachments || orderItem.Attachments)) {
    attachmentsArr = String(orderItem.attachments || orderItem.Attachments)
      .split(",")
      .filter(Boolean);
  }
  compileAndDownloadUnifiedPDF(
    invoiceLayoutHtml,
    attachmentsArr,
    `WorkOrder_${woId}`,
  );
}

function printSingleExpenseRequestDirect(reqId) {
  const orderItem = cache.expenseRequests.find(
    (w) => w && String(w.reqId || w.ReqId) === reqId,
  );
  if (!orderItem) {
    showToast("Request not found", "error");
    return;
  }
  const unitId = getUnitNumber(orderItem);

  let invoiceLayoutHtml = `
    <div style="width: 800px; padding: 20px 40px; font-family:'Inter', sans-serif; color:#000; background:#fff; box-sizing: border-box;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #000; padding-bottom:10px; margin-bottom:20px;">
        <div>
          <h2 style="font-size:32px; margin:0; text-transform:uppercase;">${escapeHtml(appSettings.estateName || "Facility Pro")}</h2>
          <small style="display:block; font-weight:700; color:#444; margin-top:2px;">Expense Request Form</small>
        </div>
        <div style="text-align:right; font-size:12px; font-weight:800;">PRINT DATE:<br>${new Date().toLocaleDateString()}</div>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:14px;">
        <tr><th style="width:30%; padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Request Ref</th><td style="padding:10px; border:1px solid #000;"><strong>${escapeHtml(orderItem.reqId || orderItem.ReqId)}</strong></td></tr>
        <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Apt : Asset</th><td style="padding:10px; border:1px solid #000;">Unit ${escapeHtml(unitId)} : ${escapeHtml(orderItem.assetTag || "N/A")}</td></tr>
        <tr><th style="padding:10px; border:1px solid #000; background:#e8f4fd; text-align:left;">Estimated Cost</th><td style="padding:10px; border:1px solid #000; background:#e8f4fd; font-size:18px;"><strong>₦${formatMoney(orderItem.cost || orderItem.Cost)}</strong></td></tr>
        <tr><th style="padding:10px; border:1px solid #000; background:#f9f9f9; text-align:left;">Amount in Words</th><td style="padding:10px; border:1px solid #000; font-style:italic;"><strong>${convertAmountToWords(orderItem.cost || orderItem.Cost)}</strong></td></tr>
        <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left; vertical-align:top;">Job Scope</th><td style="padding:10px; border:1px solid #000;">${escapeHtml(orderItem.job || orderItem.Job || "No description provided.")}</td></tr>
      </table>
    </div>`;

  let attachmentsArr = [];
  if (orderItem.attachments || orderItem.Attachments) {
    attachmentsArr = String(orderItem.attachments || orderItem.Attachments)
      .split(",")
      .filter(Boolean);
  }
  compileAndDownloadUnifiedPDF(
    invoiceLayoutHtml,
    attachmentsArr,
    `ExpenseReq_${reqId}`,
  );
}

function printSingleCashExpenseDirect(cashId) {
  const orderItem = cache.cashExpenses.find(
    (w) => w && String(w.cashId || w.CashId) === cashId,
  );
  if (!orderItem) {
    showToast("Expense not found", "error");
    return;
  }
  const unitId = getUnitNumber(orderItem);

  let invoiceLayoutHtml = `
    <div style="width: 800px; padding: 20px 40px; font-family:'Inter', sans-serif; color:#000; background:#fff; box-sizing: border-box;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #000; padding-bottom:10px; margin-bottom:20px;">
        <div>
          <h2 style="font-size:32px; margin:0; text-transform:uppercase;">${escapeHtml(appSettings.estateName || "Facility Pro")}</h2>
          <small style="display:block; font-weight:700; color:#444; margin-top:2px;">Cash Expense Voucher</small>
        </div>
        <div style="text-align:right; font-size:12px; font-weight:800;">PRINT DATE:<br>${new Date().toLocaleDateString()}</div>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:14px;">
        <tr><th style="width:30%; padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Voucher ID</th><td style="padding:10px; border:1px solid #000;"><strong>${escapeHtml(orderItem.cashId || orderItem.CashId)}</strong></td></tr>
        <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Associated Unit</th><td style="padding:10px; border:1px solid #000;">Unit ${escapeHtml(unitId)}</td></tr>
        <tr><th style="padding:10px; border:1px solid #000; background:#e8f4fd; text-align:left;">Amount Dispensed</th><td style="padding:10px; border:1px solid #000; background:#e8f4fd; font-size:22px;"><strong>₦${formatMoney(orderItem.amount || orderItem.Amount)}</strong></td></tr>
        <tr><th style="padding:10px; border:1px solid #000; background:#f9f9f9; text-align:left;">Amount in Words</th><td style="padding:10px; border:1px solid #000; font-style:italic;"><strong>${convertAmountToWords(orderItem.amount || orderItem.Amount)}</strong></td></tr>
        <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left; vertical-align:top;">Justification</th><td style="padding:10px; border:1px solid #000;">${escapeHtml(orderItem.description || orderItem.Description || "No description provided.")}</td></tr>
      </table>
    </div>`;

  let attachmentsArr = [];
  if (orderItem.attachments || orderItem.Attachments) {
    attachmentsArr = String(orderItem.attachments || orderItem.Attachments)
      .split(",")
      .filter(Boolean);
  }
  compileAndDownloadUnifiedPDF(
    invoiceLayoutHtml,
    attachmentsArr,
    `CashVoucher_${cashId}`,
  );
}

function printSinglePaymentDirect(paymentId) {
  const orderItem = cache.payments.find(
    (p) => p && String(p.paymentId || p.PaymentId) === paymentId,
  );
  if (!orderItem) {
    showToast("Payment not found", "error");
    return;
  }

  const isOutflow = orderItem.direction === "OUTFLOW";
  const documentTitle = isOutflow
    ? "Payment Voucher / Request"
    : "Official Receipt";
  const partyLabel = isOutflow ? "Payee / Vendor" : "Received From";

  const rawAttachments = orderItem.attachments || orderItem.Attachments;
  let combinedAttachmentsArray = rawAttachments
    ? String(rawAttachments)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  let finalLayoutHtml = `
    <div style="width: 800px; padding: 20px 40px; font-family:'Inter', sans-serif; color:#000; background:#fff; box-sizing: border-box;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #000; padding-bottom:10px; margin-bottom:20px;">
        <div>
          <h2 style="font-size:32px; margin:0; text-transform:uppercase;">${escapeHtml(appSettings.estateName || "Facility Pro")}</h2>
          <small style="display:block; font-weight:700; color:#444; margin-top:2px;">${escapeHtml(documentTitle)}</small>
        </div>
        <div style="text-align:right; font-size:12px; font-weight:800;">PRINT DATE:<br>${new Date().toLocaleDateString()}</div>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:10px; font-size:14px;">
        <tr><th style="width:30%; padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Transaction Ref</th><td style="padding:10px; border:1px solid #000;"><strong>${escapeHtml(orderItem.paymentId || orderItem.PaymentId)}</strong></td></tr>
        <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Date Logged</th><td style="padding:10px; border:1px solid #000;">${formatDateForDisplay(orderItem.date || orderItem.Date)}</td></tr>
        ${orderItem.reference || orderItem.Reference ? `<tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Linked Record</th><td style="padding:10px; border:1px solid #000;"><strong>${escapeHtml(orderItem.reference || orderItem.Reference)}</strong></td></tr>` : ""}
        <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Reason / Justification</th><td style="padding:10px; border:1px solid #000;">${escapeHtml(orderItem.reason || orderItem.Reason || "No specific reason provided.")}</td></tr>

        ${orderItem.totalJobValue || orderItem.TotalJobValue ? `<tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Total Job Value</th><td style="padding:10px; border:1px solid #000; font-size:16px;"><strong>₦${formatMoney(orderItem.totalJobValue || orderItem.TotalJobValue)}</strong></td></tr>` : ""}
        ${orderItem.paidToDate || orderItem.PaidToDate ? `<tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Paid to Date</th><td style="padding:10px; border:1px solid #000;">₦${formatMoney(orderItem.paidToDate || orderItem.PaidToDate)}</td></tr>` : ""}

        <tr><th style="padding:10px; border:1px solid #000; background:#e8f4fd; text-align:left;">Amount to Pay</th><td style="padding:10px; border:1px solid #000; background:#e8f4fd; font-size:18px;"><strong>₦${formatMoney(orderItem.amount || orderItem.Amount)}</strong></td></tr>
        <tr><th style="padding:10px; border:1px solid #000; background:#f9f9f9; text-align:left;">Amount in Words</th><td style="padding:10px; border:1px solid #000; font-style:italic;"><strong>${convertAmountToWords(orderItem.amount || orderItem.Amount)}</strong></td></tr>

        ${orderItem.balanceDue || orderItem.BalanceDue ? `<tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Balance Due</th><td style="padding:10px; border:1px solid #000; font-size:16px; color:#dc3545;"><strong>₦${formatMoney(orderItem.balanceDue || orderItem.BalanceDue)}</strong></td></tr>` : ""}
      </table>

      <div style="border: 2px dashed #000; padding: 20px; margin-top: 25px; background-color: #fafafa; border-radius: 8px; page-break-inside: avoid;">
        <h4 style="margin-top:0; margin-bottom: 15px; text-transform: uppercase; font-size: 14px; color: #444; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Transaction Disbursement Details</h4>
        <div style="display: flex; justify-content: space-between; font-size: 16px; align-items: flex-end;">
          <div style="width: 35%;">
            <small style="color: #666; font-weight: 700; font-size: 12px; display: block; text-transform: uppercase;">${escapeHtml(partyLabel)}</small>
            <strong>${escapeHtml(orderItem.party || orderItem.Party || "N/A")}</strong>
          </div>
          <div style="width: 30%;">
            <small style="color: #666; font-weight: 700; font-size: 12px; display: block; text-transform: uppercase;">Bank Account</small>
            <strong>${orderItem.account || orderItem.Account ? String(orderItem.account || orderItem.Account).padStart(10, "0") : "N/A"}</strong><br>
            <span style="font-size: 14px; color: #555;">${escapeHtml(orderItem.bank || orderItem.Bank || "")}</span>
          </div>
          <div style="width: 35%; text-align: right;">
            <small style="color: #666; font-weight: 700; font-size: 12px; display: block; text-transform: uppercase; margin-bottom: 4px;">Amount to Pay</small>
            <span style="font-size: 30px; font-weight: 900; color: #000; display: block; line-height: 1;">₦${formatMoney(orderItem.amount || orderItem.Amount)}</span>
          </div>
        </div>
      </div>
    </div>`;

  const ref = orderItem.reference || orderItem.Reference;

  if (ref && ref.startsWith("WO-")) {
    const wo = cache.workorders.find(
      (w) => w && String(w.workOrderId || w.WorkOrderId) === ref,
    );
    if (wo) {
      let assetInfo = "N/A";
      if (wo.asset || wo.Asset) {
        const ast = cache.assets.find(
          (a) => a && String(a.tag || a.Tag) === String(wo.asset || wo.Asset),
        );
        assetInfo = ast
          ? `${ast.tag || "N/A"}; ${ast.type || "N/A"}; ${ast.specs || "N/A"}; ${ast.loc || ast.Loc || "N/A"}`
          : wo.asset || wo.Asset;
      }

      finalLayoutHtml += `
        <div style="page-break-before: always; height: 0; clear: both;"></div>
        <div style="width: 800px; padding: 20px 40px; font-family:'Inter', sans-serif; color:#000; background:#fff; box-sizing: border-box;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #000; padding-bottom:10px; margin-bottom:20px;">
            <div>
              <h2 style="font-size:32px; margin:0; text-transform:uppercase;">${escapeHtml(appSettings.estateName || "Work Order Dossier")}</h2>
              <small style="display:block; font-weight:700; color:#444; margin-top:2px;">[SUPPORTING DOCUMENT] Managed by: ${escapeHtml(appSettings.fmName || "Facility Pro")}</small>
            </div>
            <div style="text-align:right; font-size:12px; font-weight:800;">PRINT DATE:<br>${new Date().toLocaleDateString()}</div>
          </div>
          <h3 style="text-transform: uppercase; margin-bottom: 15px;">Work Order Authorization Form</h3>
          <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:14px;">
            <tr><th style="width:30%; padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Work Order Ref</th><td style="padding:10px; border:1px solid #000;"><strong>${escapeHtml(wo.workOrderId || wo.WorkOrderId)}</strong></td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Date Logged</th><td style="padding:10px; border:1px solid #000;">${formatDateForDisplay(wo.date || wo.Date)}</td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Target Node</th><td style="padding:10px; border:1px solid #000;">Unit ${escapeHtml(getUnitNumber(wo))} | Asset: ${escapeHtml(assetInfo)}</td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Assigned</th><td style="padding:10px; border:1px solid #000;">${escapeHtml(wo.assigned || wo.Assigned || "Unassigned")}</td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Project Duration</th><td style="padding:10px; border:1px solid #000;">${escapeHtml(wo.duration || wo.Duration || "Not Specified")}</td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f9f9f9; text-align:left;">Submitted Value</th><td style="padding:10px; border:1px solid #000; background:#f9f9f9; font-size:15px; color:#555;"><strong>₦${formatMoney(wo.submittedValue || wo.SubmittedValue)}</strong></td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#e8f4fd; text-align:left;">Negotiated Value</th><td style="padding:10px; border:1px solid #000; background:#e8f4fd; font-size:18px;"><strong>₦${formatMoney(wo.amount || wo.Amount)}</strong></td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Lifecycle Auth Status</th><td style="padding:10px; border:1px solid #000;"><strong>${escapeHtml(String(wo.status || wo.Status || "PENDING").toUpperCase())}</strong></td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left; vertical-align:top;">Scope / Narrative</th><td style="padding:10px; border:1px solid #000;">${escapeHtml(wo.description || wo.Description || "No description provided.")}</td></tr>
          </table>
        </div>`;
      if (wo.attachments || wo.Attachments)
        combinedAttachmentsArray.push(
          ...String(wo.attachments || wo.Attachments)
            .split(",")
            .filter(Boolean),
        );
    }
  } else if (ref && ref.startsWith("EXR-")) {
    const exr = cache.expenseRequests.find(
      (r) => r && String(r.reqId || r.ReqId) === ref,
    );
    if (exr) {
      finalLayoutHtml += `
        <div style="page-break-before: always; height: 0; clear: both;"></div>
        <div style="width: 800px; padding: 20px 40px; font-family:'Inter', sans-serif; color:#000; background:#fff; box-sizing: border-box;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #000; padding-bottom:10px; margin-bottom:20px;">
            <div>
              <h2 style="font-size:32px; margin:0; text-transform:uppercase;">${escapeHtml(appSettings.estateName || "Facility Pro")}</h2>
              <small style="display:block; font-weight:700; color:#444; margin-top:2px;">[SUPPORTING DOCUMENT] Expense Request Form</small>
            </div>
            <div style="text-align:right; font-size:12px; font-weight:800;">PRINT DATE:<br>${new Date().toLocaleDateString()}</div>
          </div>
          <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:14px;">
            <tr><th style="width:30%; padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Request Ref</th><td style="padding:10px; border:1px solid #000;"><strong>${escapeHtml(exr.reqId || exr.ReqId)}</strong></td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Apt : Asset</th><td style="padding:10px; border:1px solid #000;">Unit ${escapeHtml(getUnitNumber(exr))} : ${escapeHtml(exr.assetTag || "N/A")}</td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#e8f4fd; text-align:left;">Estimated Cost</th><td style="padding:10px; border:1px solid #000; background:#e8f4fd; font-size:18px;"><strong>₦${formatMoney(exr.cost || exr.Cost)}</strong></td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left; vertical-align:top;">Job Scope</th><td style="padding:10px; border:1px solid #000;">${escapeHtml(exr.job || exr.Job || "No description provided.")}</td></tr>
          </table>
        </div>`;
      if (exr.attachments || exr.Attachments)
        combinedAttachmentsArray.push(
          ...String(exr.attachments || exr.Attachments)
            .split(",")
            .filter(Boolean),
        );
    }
  }

  combinedAttachmentsArray = Array.from(new Set(combinedAttachmentsArray));
  compileAndDownloadUnifiedPDF(
    finalLayoutHtml,
    combinedAttachmentsArray,
    `Ledger_Dossier_${orderItem.paymentId || orderItem.PaymentId}`,
  );
}

// --- REPORTS ENGINE ---
function initReportsEngine() {
  setGlobalLoading(true, "Loading reports...");
  const pipeline = [
    callApi("getApartments", {}).then(
      (r) => (cache.apts = Array.isArray(r) ? r : []),
    ),
    callApi("getAssets", {}).then(
      (r) => (cache.assets = Array.isArray(r) ? r : []),
    ),
    callApi("getMaintenance", {}).then(
      (r) => (cache.tickets = Array.isArray(r) ? r : []),
    ),
    callApi("getWorkOrders", {}).then(
      (r) => (cache.workorders = Array.isArray(r) ? r : []),
    ),
    callApi("getUtilities", {}).then(
      (r) => (cache.utilities = Array.isArray(r) ? r : []),
    ),
    callApi("getPayments", {}).then(
      (r) => (cache.payments = Array.isArray(r) ? r : []),
    ),
    callApi("getExpenseRequests", {}).then(
      (r) => (cache.expenseRequests = Array.isArray(r) ? r : []),
    ),
    callApi("getCashExpenses", {}).then(
      (r) => (cache.cashExpenses = Array.isArray(r) ? r : []),
    ),
  ];
  Promise.all(pipeline)
    .then(() => {
      if (cache.apts) sortApartmentsCacheList();
      document.getElementById("rep-profile-selector").value = "";
      document.getElementById("rep-layout-selector").innerHTML =
        "<option value=''>-- Choose Configurations --</option>";
      document.getElementById("rep-dynamic-parameters-frame").innerHTML = "";
      document.getElementById("report-onscreen-preview-card").style.display =
        "none";
      setGlobalLoading(false);
    })
    .catch(() => setGlobalLoading(false));
}

function handleReportProfileSwitch() {
  const profile = document.getElementById("rep-profile-selector").value;
  const layoutSel = document.getElementById("rep-layout-selector");
  const paramsFrame = document.getElementById("rep-dynamic-parameters-frame");

  layoutSel.innerHTML = "";
  paramsFrame.innerHTML = "";
  document.getElementById("report-onscreen-preview-card").style.display =
    "none";

  if (profile === "apartments") {
    layoutSel.innerHTML = `
      <option value="">-- Select Report --</option>
      <option value="occupancy_report">Apartment Occupancy Report</option>
      <option value="apt_custom_print">Apartments Manifest</option>
      <option value="detailed_profile">Detailed Apartment Profile</option>
    `;
  } else if (profile === "equipment") {
    layoutSel.innerHTML = `
      <option value="">-- Select Report --</option>
      <option value="generator_log">Generator & Diesel Consumption Log</option>
      <option value="pm_schedule">Preventive Maintenance (PM) Schedule</option>
      <option value="asset_register">Master Asset Register</option>
      <option value="ticket_report">Maintenance & Complaint Tickets</option>
    `;
  } else if (profile === "financials") {
    layoutSel.innerHTML = `
      <option value="">-- Select Report --</option>
      <option value="ledger_summary">Comprehensive Financial Ledger</option>
      <option value="fin_wo">Approved Work Orders Ledger</option>
    `;
  } else if (profile === "executive") {
    layoutSel.innerHTML = `
      <option value="">-- Select Report --</option>
      <option value="daily_operations">Daily Operations Report</option>
      <option value="monthly_fm">Monthly FM Report</option>
      <option value="kpi_dashboard">Executive KPI Dashboard</option>
    `;
  }
}

function handleReportLayoutSwitch() {
  const layout = document.getElementById("rep-layout-selector").value;
  const paramsFrame = document.getElementById("rep-dynamic-parameters-frame");
  paramsFrame.innerHTML = "";

  if (layout === "detailed_profile") {
    paramsFrame.innerHTML = `<label>SELECT APARTMENT UNIT</label><select id="rep-param-unit" class="form-control"></select>`;
    populateUnitDropdown("rep-param-unit");
  } else if (
    ["ledger_summary", "generator_log", "ticket_report", "fin_wo"].includes(
      layout,
    )
  ) {
    paramsFrame.innerHTML = `
        <div style="display:flex; gap:10px;">
          <div style="flex:1;"><label>START DATE</label><input type="date" id="rep_start_date" class="form-control"></div>
          <div style="flex:1;"><label>END DATE</label><input type="date" id="rep_end_date" class="form-control"></div>
        </div>
      `;
  } else if (layout === "daily_operations") {
    const today = new Date().toISOString().split("T")[0];
    paramsFrame.innerHTML = `<label>REPORT DATE</label><input type="date" id="rep-param-date" value="${today}" class="form-control">`;
  } else if (layout === "monthly_fm" || layout === "kpi_dashboard") {
    const thisMonth = new Date().toISOString().slice(0, 7);
    paramsFrame.innerHTML = `<label>SELECT MONTH</label><input type="month" id="rep-param-month" value="${thisMonth}" class="form-control">`;
  }
}

function compileReportPreview() {
  const layout = document.getElementById("rep-layout-selector").value;
  const viewport = document.getElementById("report-preview-viewport");
  if (!layout) return;

  if (layout === "apt_custom_print") {
    generateApartmentManifestReport();
    return;
  }
  if (layout === "detailed_profile") {
    const unit = document.getElementById("rep-param-unit").value;
    if (!unit) {
      showToast("Please select a unit.", "warning");
      return;
    }
    generateApartmentDossierReport(unit);
    return;
  }

  let out = `<div style="font-family: 'Helvetica', 'Inter', sans-serif; color: #000; background: #fff; box-sizing: border-box; width: 100%; max-width: 900px; margin: 0 auto; padding: 0; line-height: 1.4;">`;

  out += `
    <div style="text-align: center; margin-bottom: 20px;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">${escapeHtml(appSettings.estateName || "EVERGREEN ESTATE")}</h1>
      <p style="margin: 4px 0; font-size: 11px;">${escapeHtml(appSettings.estateAddress || "Plot 62, Amos Adamu Close, Parkview Estate, Ikoyi, Lagos")}</p>
      <p style="margin: 0; font-size: 11px; font-weight: bold;">Managed by: ${escapeHtml(appSettings.fmName || "PI PROJECTS")}</p>
    </div>
  `;

  const generateTitleBar = (titleText) => `
    <div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end;">
      <h2 style="margin: 0; font-size: 18px; font-weight: 900; text-transform: uppercase;">${escapeHtml(titleText)}</h2>
      <div style="text-align: right; font-size: 12px;">
        <p style="margin: 0; color: #555;">RUN DATE:</p>
        <p style="margin: 2px 0 0 0; font-weight: bold;">${new Date().toLocaleDateString("en-GB")}</p>
      </div>
    </div>
  `;

  if (layout === "occupancy_report") {
    const apts = cache.apts || [];
    out += generateTitleBar("APARTMENT OCCUPANCY REPORT");
    let rows = apts
      .map((a) => {
        if (!a) return "";
        const isOcc = String(a.status || "").toLowerCase() === "occupied";
        return `<tr style="page-break-inside: avoid;">
        <td style="padding:6px; border:1px solid #000;">${escapeHtml(a.unit || a.Unit || a.apt || "N/A")}</td>
        <td style="padding:6px; border:1px solid #000;">${escapeHtml(a.type || a.Type || "N/A")}</td>
        <td style="padding:6px; border:1px solid #000; font-weight:bold; color:${isOcc ? "#198754" : "#DC3545"};">${escapeHtml((a.status || "VACANT").toUpperCase())}</td>
        <td style="padding:6px; border:1px solid #000;">${escapeHtml(a.tenant || a.Tenant || "N/A")}</td>
        <td style="padding:6px; border:1px solid #000;">${escapeHtml(a.leaseEnd || "N/A")}</td>
      </tr>`;
      })
      .join("");

    out += `
      <table style="width:100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
        <thead style="display: table-header-group;">
          <tr style="background-color: #f4f4f4; text-transform: uppercase; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Unit</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Type</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Status</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Tenant Name</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Lease Expiry</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="5" style="padding:10px; text-align:center;">No data available.</td></tr>`}</tbody>
      </table>`;
  } else if (layout === "generator_log") {
    const startRaw = document.getElementById("rep_start_date").value;
    const endRaw = document.getElementById("rep_end_date").value;
    if (!startRaw || !endRaw) {
      showToast("Please select a date range.", "warning");
      return;
    }

    const startDate = new Date(startRaw);
    const endDate = new Date(endRaw);
    const gens = (cache.utilities || []).filter(
      (u) =>
        u &&
        (String(u.type || "").includes("Plant") ||
          String(u.type || "").includes("Generator")),
    );
    const filteredGens = gens.filter((g) => {
      const gDate = g.date ? new Date(g.date) : new Date(0);
      return gDate >= startDate && gDate <= endDate;
    });

    out += generateTitleBar("GENERATOR & DIESEL LOG");
    out += `<p style="font-weight:700; font-size:12px; margin-top:-5px; margin-bottom:15px;">Period: ${startDate.toLocaleDateString("en-GB")} to ${endDate.toLocaleDateString("en-GB")}</p>`;

    let totHrs = 0;
    let totLiters = 0;
    let rows = filteredGens
      .map((g) => {
        totHrs += parseFloat(g.runtime || 0);
        totLiters += parseFloat(g.dieselAdded || 0);
        return `<tr style="page-break-inside: avoid;">
        <td style="padding:6px; border:1px solid #000;">${escapeHtml(g.date || "N/A")}</td>
        <td style="padding:6px; border:1px solid #000;">${escapeHtml(g.startHour || "-")}</td>
        <td style="padding:6px; border:1px solid #000;">${escapeHtml(g.stopHour || "-")}</td>
        <td style="padding:6px; border:1px solid #000; text-align:center;">${escapeHtml(g.runtime || 0)}</td>
        <td style="padding:6px; border:1px solid #000; text-align:center;">${escapeHtml(g.dieselAdded || 0)}</td>
      </tr>`;
      })
      .join("");

    out += `
      <table style="width:100%; border-collapse: collapse; font-size: 12px; margin-bottom: 10px;">
        <thead style="display: table-header-group;">
          <tr style="background-color: #f4f4f4; text-transform: uppercase; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Date</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Start Hr</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Stop Hr</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:center;">Runtime (Hrs)</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:center;">Diesel Added (L)</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="5" style="padding:10px; text-align:center;">No logs for this period.</td></tr>`}
          <tr style="font-weight:900; font-size:13px; background-color: #eee; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <td colspan="3" style="padding:8px 6px; border:1px solid #000; text-align:right;">TOTALS:</td>
            <td style="padding:8px 6px; border:1px solid #000; text-align:center;">${escapeHtml(totHrs)} Hrs</td>
            <td style="padding:8px 6px; border:1px solid #000; text-align:center;">${escapeHtml(totLiters)} L</td>
          </tr>
        </tbody>
      </table>`;
  } else if (layout === "pm_schedule") {
    const assets = (cache.assets || []).filter(
      (a) => a && String(a.status || "") !== "Archived",
    );
    out += generateTitleBar("PREVENTIVE MAINTENANCE SCHEDULE");
    let rows = assets
      .map((a) => {
        let pmStatus = "Active";
        let color = "#000";
        if (a.nextService) {
          const diff =
            (new Date(a.nextService) - new Date()) / (1000 * 60 * 60 * 24);
          if (diff < 0) {
            pmStatus = "Overdue";
            color = "#DC3545";
          } else if (diff <= 14) {
            pmStatus = "Due Soon";
            color = "#FFC107";
          } else {
            pmStatus = "Active";
            color = "#198754";
          }
        }
        return `<tr style="page-break-inside: avoid;">
        <td style="padding:6px; border:1px solid #000; font-weight:bold;">${escapeHtml(a.tag || "N/A")}</td>
        <td style="padding:6px; border:1px solid #000;">${escapeHtml(a.type || "N/A")}</td>
        <td style="padding:6px; border:1px solid #000;">${escapeHtml(a.location || a.loc || "N/A")}</td>
        <td style="padding:6px; border:1px solid #000;">${escapeHtml(a.lastService || "-")}</td>
        <td style="padding:6px; border:1px solid #000;">${escapeHtml(a.nextService || "-")}</td>
        <td style="padding:6px; border:1px solid #000; font-weight:bold; color:${color};">${escapeHtml(pmStatus.toUpperCase())}</td>
      </tr>`;
      })
      .join("");

    out += `
      <table style="width:100%; border-collapse: collapse; font-size: 12px;">
        <thead style="display: table-header-group;">
          <tr style="background-color: #f4f4f4; text-transform: uppercase; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Tag</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Asset Type</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Location</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Last Service</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Next Due</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Status</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="6" style="padding:10px; text-align:center;">No assets found.</td></tr>`}</tbody>
      </table>`;
  } else if (layout === "asset_register") {
    const assets = (cache.assets || []).filter(
      (a) => a && String(a.status || "") !== "Archived",
    );
    out += generateTitleBar("MASTER ASSET REGISTER");
    let rows = assets
      .map((a) => {
        return `<tr style="page-break-inside: avoid;">
        <td style="padding:6px; border:1px solid #000; font-weight:bold;">${escapeHtml(a.tag || "N/A")}</td>
        <td style="padding:6px; border:1px solid #000;">${escapeHtml(a.type || "N/A")}<br><small style="color:#555;">${escapeHtml(a.specs || "")}</small></td>
        <td style="padding:6px; border:1px solid #000;">${escapeHtml(a.location || a.loc || "N/A")}</td>
        <td style="padding:6px; border:1px solid #000;">${escapeHtml(a.serialNumber || a.serial || "N/A")}</td>
        <td style="padding:6px; border:1px solid #000;">${escapeHtml(a.purchaseDate || "N/A")}</td>
        <td style="padding:6px; border:1px solid #000; text-align:center; font-weight:bold;">${escapeHtml((a.status || "OPERATIONAL").toUpperCase())}</td>
      </tr>`;
      })
      .join("");

    out += `
      <table style="width:100%; border-collapse: collapse; font-size: 12px;">
         <thead style="display: table-header-group;">
          <tr style="background-color: #f4f4f4; text-transform: uppercase; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Asset ID</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Type & Specs</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Location</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Serial No</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Purchase Date</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:center;">Condition</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="6" style="padding:10px; text-align:center;">No assets found.</td></tr>`}</tbody>
      </table>`;
  } else if (layout === "ticket_report") {
    const startRaw = document.getElementById("rep_start_date").value;
    const endRaw = document.getElementById("rep_end_date").value;
    if (!startRaw || !endRaw) {
      showToast("Please select a date range.", "warning");
      return;
    }

    const startDate = new Date(startRaw);
    const endDate = new Date(endRaw);
    const filteredTickets = (cache.tickets || []).filter((t) => {
      if (!t) return false;
      const tDate = t.date ? new Date(t.date) : new Date(0);
      return tDate >= startDate && tDate <= endDate;
    });

    out += generateTitleBar("MAINTENANCE TICKET REPORT");
    out += `<p style="font-weight:700; font-size:12px; margin-top:-5px; margin-bottom:15px;">Period: ${startDate.toLocaleDateString("en-GB")} to ${endDate.toLocaleDateString("en-GB")}</p>`;

    let rows = filteredTickets
      .map((t) => {
        return `<tr style="page-break-inside: avoid;">
        <td style="padding:6px; border:1px solid #000; font-weight:bold;">${escapeHtml(t.ticketId || t.id || "N/A")}</td>
        <td style="padding:6px; border:1px solid #000;">${escapeHtml(t.date || "N/A")}</td>
        <td style="padding:6px; border:1px solid #000;">${escapeHtml(t.unit || t.apartment || "N/A")}</td>
        <td style="padding:6px; border:1px solid #000;">${escapeHtml(t.description || t.complaint || "N/A")}</td>
        <td style="padding:6px; border:1px solid #000; text-align:center;">${escapeHtml(t.priority || "Normal")}</td>
        <td style="padding:6px; border:1px solid #000; font-weight:bold;">${escapeHtml((t.status || "Pending").toUpperCase())}</td>
      </tr>`;
      })
      .join("");

    out += `
      <table style="width:100%; border-collapse: collapse; font-size: 12px;">
        <thead style="display: table-header-group;">
          <tr style="background-color: #f4f4f4; text-transform: uppercase; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Ticket ID</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Date</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Unit</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left; width: 35%;">Complaint</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:center;">Priority</th>
            <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Status</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="6" style="padding:10px; text-align:center;">No tickets logged in this period.</td></tr>`}</tbody>
      </table>`;
  } else if (layout === "daily_operations") {
    const reportDate = document.getElementById("rep-param-date").value;
    if (!reportDate) {
      showToast("Please select a date.", "warning");
      return;
    }

    const dailyTickets = (cache.tickets || []).filter(
      (t) => t && t.date === reportDate,
    );
    const closedTickets = dailyTickets.filter(
      (t) => t && t.status === "Completed",
    );

    out += generateTitleBar(`DAILY OPERATIONS: ${reportDate}`);
    out += `
      <div style="display: flex; gap: 15px; margin-bottom: 20px;">
         <div style="flex: 1; padding: 15px; border: 2px solid #000; background: #fafafa; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <h4 style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase;">Maintenance Activity</h4>
            <p style="margin: 0; font-size: 24px; font-weight: 900;">${dailyTickets.length} <span style="font-size: 11px; font-weight: normal; text-transform: uppercase;">Faults Logged</span></p>
            <p style="margin: 5px 0 0 0; font-size: 11px; font-weight: bold;">${closedTickets.length} Resolved Today</p>
         </div>
         <div style="flex: 1; padding: 15px; border: 2px solid #000; background: #fafafa; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <h4 style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase;">Generator & Power</h4>
            <p style="margin: 0; font-size: 11px; font-weight: bold; color: #555; font-style: italic;">* Requires Manual Entry *</p>
            <p style="margin: 8px 0 0 0; font-size: 12px; font-weight: bold;">Runtime: ______ hrs &nbsp;&nbsp;|&nbsp;&nbsp; Diesel: ______ Ltrs</p>
         </div>
      </div>`;
  } else if (layout === "monthly_fm" || layout === "kpi_dashboard") {
    const monthStr = document.getElementById("rep-param-month").value;
    if (!monthStr) {
      showToast("Please select a month.", "warning");
      return;
    }

    const apts = cache.apts || [];
    const occupied = apts.filter(
      (a) => a && String(a.status || "").toLowerCase() === "occupied",
    ).length;
    const occPercentage =
      apts.length > 0 ? Math.round((occupied / apts.length) * 100) : 0;

    let mInflow = 0;
    let mOutflow = 0;
    (cache.payments || [])
      .filter((p) => p && p.date && p.date.startsWith(monthStr))
      .forEach((p) => (mInflow += parseFloat(p.amount || 0)));
    (cache.cashExpenses || [])
      .filter((c) => c && c.date && c.date.startsWith(monthStr))
      .forEach((c) => (mOutflow += parseFloat(c.amount || 0)));

    out += generateTitleBar(
      `${layout === "monthly_fm" ? "MONTHLY FM REPORT" : "EXECUTIVE KPI DASHBOARD"} - ${monthStr}`,
    );
    out += `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
         <div style="padding: 15px; border: 1px solid #000; background: #fafafa; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <h4 style="margin: 0; font-size: 11px; text-transform: uppercase;">Occupancy Rate</h4>
            <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: 900;">${occPercentage}%</p>
         </div>
         <div style="padding: 15px; border: 1px solid #000; background: #fafafa; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <h4 style="margin: 0; font-size: 11px; text-transform: uppercase;">Net Financial Position</h4>
            <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: 900;">₦ ${formatMoney(mInflow - mOutflow)}</p>
         </div>
      </div>`;
  } else if (layout === "fin_wo" || layout === "ledger_summary") {
    const startRaw = document.getElementById("rep_start_date").value;
    const endRaw = document.getElementById("rep_end_date").value;
    if (!startRaw || !endRaw) {
      showToast("Please select a date range.", "warning");
      return;
    }

    out += generateTitleBar(
      layout === "fin_wo" ? `APPROVED WORK ORDERS` : `LEDGER SUMMARY`,
    );
    out += `<p style="font-weight:700; font-size:12px; margin-top:-5px; margin-bottom:15px;">Period: ${escapeHtml(startRaw)} to ${escapeHtml(endRaw)}</p>
            <div style="border: 1px solid #000; padding: 20px; text-align: center; font-style: italic;">Records successfully filtered. (Financial tables rendered below in full view).</div>`;
  }

  out = out.replace(/T\d{2}:\d{2}:\d{2}[\.a-zA-Z0-9]*/g, "");
  out += `</div>`;

  window.currentReportFilename =
    layout.toUpperCase() + "_REPORT_" + new Date().getTime();
  window.currentReportAttachmentManifest = [];

  if (viewport) viewport.innerHTML = out;
  const printContainer = document.getElementById("report-print-container");
  if (printContainer) printContainer.innerHTML = out;

  const previewCard = document.getElementById("report-onscreen-preview-card");
  if (previewCard) previewCard.style.display = "block";
}

function downloadCurrentReportPDF() {
  const source = document.getElementById("report-preview-viewport");
  if (!source || !source.innerHTML.trim()) {
    showToast("Please generate a report first.", "warning");
    return;
  }
  const filename = window.currentReportFilename || "Facility_Report";
  const attachments = window.currentReportAttachmentManifest || [];
  compileAndDownloadUnifiedPDF(source, attachments, filename);
}

function printCurrentReport() {
  const source = document.getElementById("report-preview-viewport");
  if (!source || !source.innerHTML.trim()) {
    showToast("Please generate a report first.", "warning");
    return;
  }
  const filename = window.currentReportFilename || "Facility_Report";
  const originalTitle = document.title;
  document.title = filename;
  window.print();
  setTimeout(() => {
    document.title = originalTitle;
  }, 1000);
}

function generateApartmentManifestReport() {
  const viewport = document.getElementById("report-preview-viewport");
  if (!viewport) return;

  window.currentReportFilename = "Apartment_Manifest_" + new Date().getTime();
  window.currentReportAttachmentManifest = [];

  const estateName = appSettings.estateName || "FACILITY PRO ESTATE";
  const estateAddress = appSettings.estateAddress || "Address not configured";
  const fmName = appSettings.fmName || "Facility Management";

  let html = `
  <div style="font-family: 'Arial', sans-serif; color: #000; background: #fff; padding: 20px; max-width: 800px; margin: 0 auto; line-height: 1.4;">
      <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="font-size: 22px; font-weight: 900; margin: 0; text-transform: uppercase;">${escapeHtml(estateName)}</h2>
          <p style="font-size: 14px; margin: 4px 0 0 0;">${escapeHtml(estateAddress)}</p>
          <p style="font-size: 14px; margin: 4px 0 0 0; font-weight: bold;">Managed by: ${escapeHtml(fmName)}</p>
          <br>
          <h3 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0; text-decoration: underline;">APARTMENTS MANIFEST</h3>
      </div>
  `;

  let apartments = [...(cache.apts || [])].filter(
    (a) => a && String(a.type || "").toLowerCase() !== "services",
  );

  apartments.forEach((apt) => {
    const unitId = escapeHtml(getUnitNumber(apt));
    const tenant = escapeHtml(apt.tenant || apt.Tenant || "VACANT");
    const type = escapeHtml(apt.type || apt.Type || "Standard");
    const meter = escapeHtml(apt.meterNo || apt.MeterNo || apt.meter || "N/A");
    const unitAssets = (cache.assets || []).filter(
      (a) =>
        a &&
        String(getUnitNumber(a)) === String(getUnitNumber(apt)) &&
        String(a.status || "") !== "Archived",
    );

    html += `
    <div style="margin-bottom: 25px; page-break-inside: avoid;">
        <table style="width: 100%; border-collapse: collapse; border: 2px solid #000; font-size: 14px; font-weight: bold;">
            <tr>
                <td style="border: 1px solid #000; padding: 6px; width: 15%; background: #f9f9f9;">Unit</td>
                <td style="border: 1px solid #000; padding: 6px; width: 35%;">${unitId}</td>
                <td style="border: 1px solid #000; padding: 6px; width: 15%; background: #f9f9f9;">Tenant</td>
                <td style="border: 1px solid #000; padding: 6px; width: 35%; color: ${tenant.toUpperCase() === "VACANT" ? "#DC3545" : "#198754"};">${tenant.toUpperCase()}</td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 6px; background: #f9f9f9;">Type</td>
                <td style="border: 1px solid #000; padding: 6px;">${type}</td>
                <td style="border: 1px solid #000; padding: 6px; background: #f9f9f9;">Meter No</td>
                <td style="border: 1px solid #000; padding: 6px;">${meter}</td>
            </tr>
        </table>
        <div style="margin-top: 10px;">
            <p style="margin: 0 0 5px 0; font-size: 13px; font-weight: bold; text-decoration: underline;">REGISTERED ASSETS:</p>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
    `;

    if (unitAssets.length > 0) {
      unitAssets.forEach((asset) => {
        const aType = escapeHtml(asset.type || asset.Type || "Appliance");
        const aTag = escapeHtml(asset.tag || asset.Tag || "NO-TAG");
        const aSpecs = escapeHtml(asset.specs || asset.Specs || "");
        html += `<li style="margin-bottom: 4px;">${aType} (${aTag})${aSpecs ? ` - ${aSpecs}` : ""}</li>`;
      });
    } else {
      html += `<li style="color: #666; font-style: italic;">No registered assets</li>`;
    }

    html += `</ul></div></div>`;
  });

  html += `</div>`;
  viewport.innerHTML = html;
  const printContainer = document.getElementById("report-print-container");
  if (printContainer) printContainer.innerHTML = html;
}

function generateApartmentDossierReport(targetUnitId) {
  const viewport = document.getElementById("report-preview-viewport");
  if (!viewport) return;

  window.currentReportFilename =
    `Apartment_Dossier_${targetUnitId}_` + new Date().getTime();
  window.currentReportAttachmentManifest = [];

  const apt = (cache.apts || []).find(
    (a) => a && String(getUnitNumber(a)) === String(targetUnitId),
  );
  if (!apt) {
    showToast("Apartment not found.", "error");
    return;
  }

  const estateName = appSettings.estateName || "FACILITY PRO ESTATE";
  const estateAddress = appSettings.estateAddress || "Address not configured";
  const fmName = appSettings.fmName || "Facility Management";

  const type = escapeHtml(apt.type || apt.Type || "Standard");
  const status = escapeHtml(apt.status || apt.Status || "Vacant");
  const meter = escapeHtml(apt.meterNo || apt.MeterNo || apt.meter || "N/A");

  let html = `
  <div style="font-family: 'Arial', sans-serif; color: #000; background: #fff; padding: 20px; max-width: 800px; margin: 0 auto; line-height: 1.4;">
      <div style="text-align: center; margin-bottom: 25px;">
          <h2 style="font-size: 22px; font-weight: 900; margin: 0; text-transform: uppercase;">${escapeHtml(estateName)}</h2>
          <p style="font-size: 14px; margin: 4px 0 0 0;">${escapeHtml(estateAddress)}</p>
          <p style="font-size: 14px; margin: 4px 0 0 0; font-weight: bold;">Managed by: ${escapeHtml(fmName)}</p>
          <br>
          <h3 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0; text-decoration: underline;">APARTMENT DETAILED DOSSIER</h3>
      </div>

      <div style="margin-bottom: 20px;">
           <table style="width: 100%; border-collapse: collapse; border: 2px solid #000; font-size: 14px; font-weight: bold; margin-bottom: 10px;">
              <tr>
                  <td style="border: 1px solid #000; padding: 6px; width: 15%; background: #f9f9f9;">Type</td>
                  <td style="border: 1px solid #000; padding: 6px; width: 35%;">${type}</td>
                  <td style="border: 1px solid #000; padding: 6px; width: 15%; background: #f9f9f9;">Status</td>
                  <td style="border: 1px solid #000; padding: 6px; width: 35%; color: ${status.toUpperCase() === "VACANT" ? "#DC3545" : "#198754"};">${status}</td>
              </tr>
              <tr>
                  <td style="border: 1px solid #000; padding: 6px; background: #f9f9f9;">Meter No</td>
                  <td style="border: 1px solid #000; padding: 6px;" colspan="3">${meter}</td>
              </tr>
          </table>
          <div style="display:flex; justify-content: space-between; font-weight: bold; font-size: 14px;">
              <span>RUN DATE: ${new Date().toLocaleDateString("en-GB")}</span>
              <span style="font-size: 20px;">${escapeHtml(targetUnitId)}</span>
          </div>
      </div>

      <h3 style="font-size: 14px; font-weight: bold; margin: 20px 0 10px 0; text-decoration: underline;">ASSETS:</h3>
      <div style="display: flex; flex-wrap: wrap; gap: 2%; row-gap: 15px;">
  `;

  const unitAssets = (cache.assets || []).filter(
    (a) =>
      a &&
      String(getUnitNumber(a)) === String(targetUnitId) &&
      String(a.status || "") !== "Archived",
  );

  if (unitAssets.length > 0) {
    unitAssets.forEach((asset) => {
      let imgHtml = `<div style="height: 120px; background: #eee; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; color: #aaa; border-bottom: 1px solid #ccc; -webkit-print-color-adjust: exact; print-color-adjust: exact;">No Image</div>`;

      if (asset.photos || asset.Photos) {
        const firstPhoto = String(asset.photos || asset.Photos).split(",")[0];
        if (firstPhoto) {
          const imgUrl = getDirectImageUrl(firstPhoto);
          imgHtml = `
          <div style="height: 120px; border-bottom: 1px solid #ccc; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fff;">
              <img src="${imgUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" alt="${escapeHtml(asset.type || "Asset")}">
          </div>`;
        }
      }

      html += `
      <div style="width: 32%; border: 1px solid #000; border-radius: 4px; overflow: hidden; page-break-inside: avoid;">
          ${imgHtml}
          <div style="padding: 10px; font-size: 12px; line-height: 1.5;">
              <div style="font-weight: 900; font-size: 13px; margin-bottom: 5px;">${escapeHtml(asset.type || asset.Type || "Asset")}</div>
              <div><strong>Specs:</strong> ${escapeHtml(asset.specs || asset.Specs || "N/A")}</div>
              <div><strong>Tag:</strong> ${escapeHtml(asset.tag || asset.Tag)}</div>
              <div><strong>Loc:</strong> ${escapeHtml(asset.loc || asset.Loc || "N/A")}</div>
              <div><strong>Status:</strong> ${escapeHtml(asset.status || asset.Status || "N/A")}</div>
          </div>
      </div>`;
    });
  } else {
    html += `<div style="font-style: italic; color: #666; font-size: 13px;">No physical assets recorded for this unit.</div>`;
  }

  html += `</div></div>`;
  viewport.innerHTML = html;
  const printContainer = document.getElementById("report-print-container");
  if (printContainer) printContainer.innerHTML = html;
}
