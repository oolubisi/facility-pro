const desktopState = {
  view: "apartments",
  query: "",
  loaded: false,
  collapsedSections: {},
  recentWindows: [],
  selectMode: false,
  selectedIds: new Set(),
};

const viewMeta = {
  apartments: {
    title: "Apartments",
    kicker: "Residence registry",
    key: "apts",
    action: "getApartments",
    newType: "apartment",
    empty: "No apartments found.",
  },
  assets: {
    title: "Assets",
    kicker: "Equipment register",
    key: "assets",
    action: "getAssets",
    newType: "asset",
    empty: "No assets found.",
  },
  tickets: {
    title: "Tickets",
    kicker: "Maintenance desk",
    key: "tickets",
    action: "getMaintenance",
    newType: "maintenance",
    empty: "No tickets found.",
  },
  workorders: {
    title: "Work Orders",
    kicker: "Approvals and payments",
    key: "workorders",
    action: "getWorkOrders",
    newType: "workorder",
    empty: "No work orders found.",
  },
  inventory: {
    title: "Inventory",
    kicker: "Stores and materials",
    key: "inventory",
    action: "getInventory",
    newType: "inventory",
    empty: "No inventory items found.",
  },
  vendors: {
    title: "Vendors",
    kicker: "Supplier directory",
    key: "vendors",
    action: "getVendors",
    newType: "vendor",
    empty: "No vendors found.",
  },
  accounts: {
    title: "Accounts",
    kicker: "Payment ledger",
    key: "payments",
    action: "getPayments",
    newType: "payment",
    empty: "No payments found.",
  },
  expenserequests: {
    title: "Expense Requests",
    kicker: "Awaiting review",
    key: "expenseRequests",
    action: "getExpenseRequests",
    newType: "expenserequest",
    empty: "No expense requests found.",
  },
  reports: {
    title: "Reports",
    kicker: "Desktop shortcuts",
    key: "reports",
    empty: "Choose a report action.",
  },
  settings: {
    title: "Settings",
    kicker: "Configuration",
    key: "settings",
    empty: "Settings are available in mobile view.",
  },
};

window.addEventListener("DOMContentLoaded", initDesktop);

async function initDesktop() {
  installDesktopCompatibilityShims();
  wireDesktopEvents();

  // Paint instantly from the last successful load before touching the
  // network, so the desktop shell never sits blank/blocked on boot.
  const hadCache = hydrateCacheFromLocalBackup();
  if (hadCache) {
    desktopState.loaded = true;
    applySettingsToUIHeaders();
    renderDesktop();
  }

  await Promise.all([loadDesktopSettings(), loadDesktopData(hadCache)]);
  renderDesktop();
}

function installDesktopCompatibilityShims() {
  window.bootstrapDataRegistriesPipeline = async () => {
    await loadDesktopData();
    renderDesktop();
  };

  window.refreshData = async () => {
    await loadAndRender();
  };

  window.generateNextRecordId = async (prefix, sheetName, idKey, fallbackList) => {
    try {
      const response = await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "generateId",
          data: { prefix, sheetName, idKey },
        }),
      });
      const result = await response.json();
      if (result?.status === "success" && result.id) return result.id;
    } catch (error) {
      console.warn("Desktop ID generation fallback in use.", error);
    }

    let maxId = 0;
    (Array.isArray(fallbackList) ? fallbackList : []).forEach((item) => {
      const idVal =
        item?.[idKey] ||
        item?.[idKey.charAt(0).toUpperCase() + idKey.slice(1)] ||
        item?.[idKey.toUpperCase()];
      if (typeof idVal === "string" && idVal.startsWith(prefix)) {
        const n = parseInt(idVal.split("-")[1], 10);
        if (!isNaN(n)) maxId = Math.max(maxId, n);
      }
    });
    return `${prefix}-${String(maxId + 1).padStart(4, "0")}`;
  };

  window.populateUnitDropdown = (selectElementId, currentlySelectedValue) => {
    const select = document.getElementById(selectElementId);
    if (!select) return;
    select.innerHTML = '<option value="">-- Choose Unit Reference --</option>';
    (cache.apts || []).forEach((unit) => {
      const unitNumber = getUnitNumber(unit);
      if (!unitNumber && unitNumber !== 0) return;
      const option = document.createElement("option");
      option.value = unitNumber;
      option.textContent = "Unit " + unitNumber;
      option.selected =
        currentlySelectedValue && String(unitNumber) === String(currentlySelectedValue);
      select.appendChild(option);
    });
  };

  window.applySettingsToUIHeaders = () => {
    document.getElementById("desktop-brand").textContent =
      appSettings.estateName || "Facility Pro";
  };

  window.syncSettingsInputsToUIFields = () => {
    const map = [
      ["cfg-estate-name", "estateName"],
      ["cfg-estate-address", "estateAddress"],
      ["cfg-fm-name", "fmName"],
      ["cfg-fm-address", "fmAddress"],
      ["cfg-logo-url", "logoUrl"],
      ["cfg-main-folder", "mainFolder"],
    ];
    map.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.value = appSettings[key] || "";
    });
  };

  window.commitApplicationSettingsData = async () => {
    appSettings.estateName = sanitizeInput(document.getElementById("cfg-estate-name")?.value);
    appSettings.estateAddress = sanitizeInput(document.getElementById("cfg-estate-address")?.value);
    appSettings.fmName = sanitizeInput(document.getElementById("cfg-fm-name")?.value);
    appSettings.fmAddress = sanitizeInput(document.getElementById("cfg-fm-address")?.value);
    appSettings.logoUrl = sanitizeInput(document.getElementById("cfg-logo-url")?.value);
    appSettings.mainFolder =
      sanitizeInput(document.getElementById("cfg-main-folder")?.value) ||
      "FacilityPro_Attachments";
    localStorage.setItem("facility_pro_config_meta", JSON.stringify(appSettings));
    await callApi("saveSettings", appSettings);
    applySettingsToUIHeaders();
    showToast("Settings saved", "success");
  };
}

function wireDesktopEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setDesktopView(button.dataset.view));
  });

  document.addEventListener("click", (event) => {
    const panel = document.getElementById("recent-windows-panel");
    const btn = document.getElementById("recent-windows-btn");
    if (!panel || panel.style.display !== "block") return;
    if (!panel.contains(event.target) && event.target !== btn && !btn.contains(event.target)) {
      panel.style.display = "none";
    }
  });

  const debouncedSearch = debounce((value) => {
    desktopState.query = value.trim().toLowerCase();
    renderDesktop();
  }, 200);
  document.getElementById("global-search").addEventListener("input", (event) => {
    debouncedSearch(event.target.value);
  });

  document.getElementById("refresh-now").addEventListener("click", loadAndRender);
  document.getElementById("sync-now").addEventListener("click", async () => {
    await processSyncQueue();
    await loadAndRender();
  });
  document.getElementById("open-mobile").addEventListener("click", openMobileApp);
  document.getElementById("new-record").addEventListener("click", openNewRecord);

  document.addEventListener("keydown", (event) => {
    const mod = event.metaKey || event.ctrlKey;
    if (!mod) return;
    if (event.key.toLowerCase() === "k") {
      event.preventDefault();
      document.getElementById("global-search")?.focus();
    } else if (event.key.toLowerCase() === "n") {
      const overlay = document.getElementById("modalOverlay");
      if (overlay && overlay.style.display === "flex") return; // don't hijack while a form is open
      event.preventDefault();
      openNewRecord();
    }
  });
}

async function loadDesktopSettings() {
  const stored = localStorage.getItem("facility_pro_config_meta");
  if (stored) {
    try {
      appSettings = { ...appSettings, ...JSON.parse(stored) };
    } catch (error) {
      console.warn("Stored settings unavailable", error);
    }
  }

  try {
    const cloudSettings = await callApi("getSettings", {});
    if (cloudSettings && typeof cloudSettings === "object") {
      appSettings = { ...appSettings, ...cloudSettings };
      localStorage.setItem("facility_pro_config_meta", JSON.stringify(appSettings));
    }
  } catch (error) {
    console.warn("Cloud settings unavailable", error);
  }

  document.getElementById("desktop-brand").textContent =
    appSettings.estateName || "Facility Pro";
  const logo = document.getElementById("desktop-logo");
  const logoUrl = getDirectImageUrl(appSettings.logoUrl);
  if (logoUrl) {
    logo.src = logoUrl;
    logo.style.display = "block";
  }
}

async function loadDesktopData(silent = false) {
  if (!silent) setGlobalLoading(true, "Loading desktop workspace...");
  try {
    await loadAllDataFromServer();
    desktopState.loaded = true;
  } catch (error) {
    console.warn("Could not load desktop data", error);
  } finally {
    setGlobalLoading(false);
  }
}

async function loadAndRender() {
  await loadDesktopData();
  renderDesktop();
  showToast("Desktop data refreshed", "success", 1800);
}

function setDesktopView(view) {
  desktopState.view = view;
  desktopState.selectMode = false;
  desktopState.selectedIds = new Set();
  document.getElementById("detail-panel").hidden = true;
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  renderDesktop();
}

function renderDesktop() {
  const meta = viewMeta[desktopState.view] || viewMeta.apartments;
  document.getElementById("section-title").textContent = meta.title;
  document.getElementById("section-kicker").textContent = meta.kicker;
  updateMetrics();
  renderOverdueDigest();

  const prButton = document.getElementById("print-pending-prs");
  if (prButton) prButton.style.display = desktopState.view === "accounts" ? "inline-flex" : "none";

  const selectBtn = document.getElementById("toggle-select-mode");
  if (selectBtn) {
    const supportsSelect = !!bulkActionConfig[desktopState.view];
    selectBtn.style.display = supportsSelect ? "inline-flex" : "none";
    selectBtn.classList.toggle("active", desktopState.selectMode);
    selectBtn.innerHTML = desktopState.selectMode
      ? `<i class="fas fa-xmark"></i> Exit Select`
      : `<i class="fas fa-check-double"></i> Select`;
  }

  if (desktopState.view === "reports") return renderReportShortcuts();
  if (desktopState.view === "settings") return renderSettingsShortcuts();

  const records = sortRecords(desktopState.view, filterRecords(cache[meta.key] || []));
  desktopState.lastRecords = records;
  document.getElementById("record-count").textContent = `${records.length} ${records.length === 1 ? "record" : "records"}`;
  const sectionedConfig = sectionedViewConfig[desktopState.view];
  document.getElementById("card-grid").innerHTML = records.length
    ? sectionedConfig
      ? renderSectionedGrid(desktopState.view, records, sectionedConfig)
      : records.map((item, index) => renderRecordCard(desktopState.view, item, index)).join("")
    : `<div class="empty-state">${escapeHtml(meta.empty)}</div>`;

  const bulkConfig = bulkActionConfig[desktopState.view];
  document.querySelectorAll(".record-card").forEach((card) => {
    const index = Number(card.dataset.index);
    const item = records[index];
    if (desktopState.selectMode && bulkConfig && item) {
      const id = bulkConfig.idField(item);
      card.dataset.selectId = id;
      card.classList.toggle("selected", desktopState.selectedIds.has(id));
      card.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleCardSelection(id);
      });
    } else {
      card.addEventListener("click", () => openDesktopRecord(desktopState.view, item));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDesktopRecord(desktopState.view, item);
        }
      });
    }
  });

  renderBulkActionBar();
}

// ─────────────────────────────────────────────
// § SECTIONED / COLLAPSIBLE GRIDS
// First section per view is always expanded and not collapsible.
// Remaining sections are collapsible and default to collapsed.
// ─────────────────────────────────────────────
function isMaintenanceDueSoon(item) {
  const status = String(item.status || item.Status || "");
  if (status === "Faulty" || status === "Under Repair" || status === "Archived") return false;
  const nextDate = parseToLocalDateObject(item.nextService || item.NextService || "");
  if (!nextDate) return false;
  const weekOut = new Date(startOfToday());
  weekOut.setDate(weekOut.getDate() + 7);
  return nextDate <= weekOut;
}

// § OVERDUE / DUE-SOON DIGEST
// A glanceable summary of what needs attention right now, shown above the
// dashboard metrics regardless of which view is currently open. Clicking a
// pill jumps straight to that view (whose first section already surfaces
// the relevant records, per sectionedViewConfig).
// ─────────────────────────────────────────────
function renderOverdueDigest() {
  const banner = document.getElementById("overdue-digest");
  if (!banner) return;

  const dueAssets = (cache.assets || []).filter(
    (a) => a && (String(a.status || a.Status || "") === "Faulty" || isMaintenanceDueSoon(a)),
  ).length;
  const pendingWO = (cache.workorders || []).filter(
    (w) => w && String(w.status || w.Status || "") === "Pending Approval",
  ).length;
  const openTickets = (cache.tickets || []).filter(
    (t) => t && String(t.status || t.Status || "") !== "Resolved",
  ).length;
  // ExpenseRequests have no status field — every request sits in this
  // sheet until it's actioned (converted to a Work Order/Payment), so the
  // full count is the meaningful "awaiting review" number.
  const pendingExpenseRequests = (cache.expenseRequests || []).filter(Boolean).length;
  const leaseExpiryWindow = new Date(startOfToday());
  leaseExpiryWindow.setDate(leaseExpiryWindow.getDate() + 30);
  const expiringLeases = (cache.apts || []).filter((a) => {
    if (!a || String(a.type || a.Type || "").toLowerCase() === "services") return false;
    const leaseEnd = parseToLocalDateObject(a.leaseEnd || a.LeaseEnd || "");
    return leaseEnd && leaseEnd <= leaseExpiryWindow;
  }).length;

  const items = [
    dueAssets
      ? { count: dueAssets, label: `asset${dueAssets === 1 ? "" : "s"} need attention`, view: "assets" }
      : null,
    pendingWO
      ? { count: pendingWO, label: `work order${pendingWO === 1 ? "" : "s"} pending approval`, view: "workorders" }
      : null,
    openTickets
      ? { count: openTickets, label: `ticket${openTickets === 1 ? "" : "s"} open`, view: "tickets" }
      : null,
    pendingExpenseRequests
      ? { count: pendingExpenseRequests, label: `expense request${pendingExpenseRequests === 1 ? "" : "s"} awaiting review`, view: "expenserequests" }
      : null,
    expiringLeases
      ? { count: expiringLeases, label: `lease${expiringLeases === 1 ? "" : "s"} expiring within 30 days`, view: "apartments" }
      : null,
  ].filter(Boolean);

  if (items.length === 0) {
    banner.hidden = true;
    banner.innerHTML = "";
    return;
  }

  banner.hidden = false;
  banner.innerHTML = items
    .map(
      (item) =>
        `<button class="digest-pill" data-view="${item.view}"><strong>${item.count}</strong> ${escapeHtml(item.label)}</button>`,
    )
    .join("");

  banner.querySelectorAll(".digest-pill").forEach((pill) => {
    pill.addEventListener("click", () => setDesktopView(pill.dataset.view));
  });
}

const sectionedViewConfig = {
  accounts: {
    classify: (item) => (isPaymentPaid(item) ? "cleared" : "pending"),
    sections: [
      { key: "pending", label: "Pending Payments" },
      { key: "cleared", label: "Cleared Payments" },
    ],
  },
  workorders: {
    classify: (item) => {
      const s = String(item.status || item.Status || "");
      if (s === "Pending Approval") return "pending";
      if (s === "Approved") return "approved";
      if (s === "Declined") return "declined";
      return "other";
    },
    sections: [
      { key: "pending", label: "Pending" },
      { key: "approved", label: "Approved" },
      { key: "declined", label: "Declined" },
    ],
  },
  apartments: {
    classify: (item) => {
      if (String(item.type || item.Type || "").toLowerCase() === "services") return "common";
      return String(item.status || item.Status || "Vacant") === "Occupied" ? "occupied" : "vacant";
    },
    sections: [
      { key: "vacant", label: "Vacant" },
      { key: "occupied", label: "Occupied" },
      { key: "common", label: "Common Area" },
    ],
  },
  assets: {
    classify: (item) => {
      const s = String(item.status || item.Status || "");
      if (s === "Archived") return "archived";
      if (s === "Faulty" || s === "Under Repair") return "faulty";
      if (isMaintenanceDueSoon(item)) return "duesoon";
      return "operational";
    },
    sections: [
      { key: "faulty", label: "Faulty" },
      { key: "duesoon", label: "Maintenance Due (7 Days)" },
      { key: "operational", label: "Operational" },
      { key: "archived", label: "Archived" },
    ],
  },
  tickets: {
    classify: (item) => {
      const s = String(item.status || item.Status || "Open");
      if (s === "In Progress") return "inprogress";
      if (s === "Resolved") return "resolved";
      return "open";
    },
    sections: [
      { key: "inprogress", label: "In Progress" },
      { key: "open", label: "Open" },
      { key: "resolved", label: "Resolved" },
    ],
  },
};

// ─────────────────────────────────────────────
// § BULK ACTIONS
// A view opts in by having an entry here. `idField` extracts a unique
// identifier per record; each action has a `filter` (which selected
// records it applies to) and a `run` (the actual per-record API call).
// ─────────────────────────────────────────────
const bulkActionConfig = {
  tickets: {
    idField: (item) => item.ticketId || item.TicketId || "",
    actions: [
      {
        key: "resolve",
        label: "Mark Resolved",
        icon: "fa-check",
        filter: (item) => String(item.status || item.Status || "") !== "Resolved",
        confirm: (n) => `Mark ${n} ticket${n === 1 ? "" : "s"} as Resolved?`,
        run: (item) => callApi("updateMaintenance", { ...item, status: "Resolved" }),
      },
    ],
  },
  accounts: {
    idField: (item) => item.paymentId || item.PaymentId || "",
    actions: [
      {
        key: "markpaid",
        label: "Mark Paid",
        icon: "fa-check",
        filter: (item) => !isPaymentPaid(item),
        confirm: (n) => `Mark ${n} payment${n === 1 ? "" : "s"} as Paid? Paid payments can no longer be edited.`,
        run: (item) => callApi("updatePayment", { ...item, isPaid: true }),
      },
    ],
  },
};

function toggleSelectMode() {
  desktopState.selectMode = !desktopState.selectMode;
  desktopState.selectedIds = new Set();
  renderDesktop();
}

function toggleCardSelection(id) {
  if (desktopState.selectedIds.has(id)) {
    desktopState.selectedIds.delete(id);
  } else {
    desktopState.selectedIds.add(id);
  }
  renderBulkActionBar();
  document.querySelectorAll(`.record-card[data-select-id]`).forEach((card) => {
    card.classList.toggle("selected", desktopState.selectedIds.has(card.dataset.selectId));
  });
}

function renderBulkActionBar() {
  const bar = document.getElementById("bulk-action-bar");
  if (!bar) return;
  const config = bulkActionConfig[desktopState.view];
  const count = desktopState.selectedIds.size;

  if (!desktopState.selectMode || !config) {
    bar.hidden = true;
    return;
  }

  bar.hidden = false;
  bar.innerHTML = `
    <span class="bulk-count">${count} selected</span>
    ${config.actions
      .map(
        (a) =>
          `<button class="bulk-action-btn" ${count === 0 ? "disabled" : ""} onclick="runBulkAction('${a.key}')"><i class="fas ${a.icon}"></i> ${escapeHtml(a.label)}</button>`,
      )
      .join("")}
    <button class="bulk-cancel-btn" onclick="toggleSelectMode()">Cancel</button>
  `;
}

async function runBulkAction(actionKey) {
  const config = bulkActionConfig[desktopState.view];
  if (!config) return;
  const action = config.actions.find((a) => a.key === actionKey);
  if (!action) return;

  const records = desktopState.lastRecords || [];
  const targets = records.filter(
    (item) => item && desktopState.selectedIds.has(config.idField(item)) && action.filter(item),
  );
  if (targets.length === 0) return;

  if (!confirm(action.confirm(targets.length))) return;

  showToast(`Applying "${action.label}" to ${targets.length} record${targets.length === 1 ? "" : "s"}...`, "info", 3000);
  let succeeded = 0;
  let failed = 0;
  for (const item of targets) {
    try {
      const result = await action.run(item);
      if (result && result.status === "error") failed++;
      else succeeded++;
    } catch (e) {
      failed++;
    }
  }

  desktopState.selectMode = false;
  desktopState.selectedIds = new Set();
  await loadDesktopData(true);
  renderDesktop();

  if (failed === 0) {
    showToast(`${succeeded} record${succeeded === 1 ? "" : "s"} updated`, "success");
  } else {
    showToast(`${succeeded} updated, ${failed} failed`, "warning");
  }
}

function isSectionCollapsed(sectionKey) {
  return desktopState.collapsedSections[sectionKey] !== false;
}

function toggleSection(sectionKey) {
  desktopState.collapsedSections[sectionKey] = !isSectionCollapsed(sectionKey);
  renderDesktop();
}

function renderSectionedGrid(view, records, config) {
  const buckets = {};
  records.forEach((item, index) => {
    const key = config.classify(item);
    (buckets[key] = buckets[key] || []).push({ item, index });
  });

  let html = "";
  config.sections.forEach((def, i) => {
    html += renderSectionBlock(view, def, buckets[def.key] || [], i === 0);
    delete buckets[def.key];
  });

  const leftover = Object.keys(buckets).reduce((acc, key) => acc.concat(buckets[key]), []);
  if (leftover.length) {
    html += renderSectionBlock(view, { key: "other", label: "Other" }, leftover, false);
  }

  return html;
}

function renderSectionBlock(view, def, entries, isFirst) {
  const count = entries.length;
  const sectionKey = `${view}:${def.key}`;
  const forceOpenForSearch = !!desktopState.query && count > 0;
  const collapsed = isFirst || forceOpenForSearch ? false : isSectionCollapsed(sectionKey);
  const caret = isFirst
    ? ""
    : `<i class="fas fa-chevron-${collapsed ? "right" : "down"}" style="margin-left:8px; font-size:12px; color:var(--muted);"></i>`;
  const labelAttrs = isFirst ? "" : `onclick="toggleSection('${sectionKey}')" style="cursor:pointer;"`;

  let body = "";
  if (!collapsed) {
    body = count
      ? entries.map(({ item, index }) => renderRecordCard(view, item, index)).join("")
      : `<div class="empty-state">No records in this section.</div>`;
  }

  return `
    <div class="section-label" ${labelAttrs}>${escapeHtml(def.label)} (${count})${caret}</div>
    ${body}
  `;
}

function updateMetrics() {
  setText("metric-apartments", activeCount(cache.apts));
  setText("metric-assets", activeCount(cache.assets));
  setText(
    "metric-tickets",
    (cache.tickets || []).filter((item) => !isClosedStatus(item.status || item.Status)).length,
  );
  setText(
    "metric-workorders",
    (cache.workorders || []).filter((item) => String(item.status || item.Status || "") === "Pending Approval").length,
  );
}

function filterRecords(records) {
  if (!desktopState.query) return records;
  return records.filter((item) =>
    Object.values(item || {}).join(" ").toLowerCase().includes(desktopState.query),
  );
}

function sortRecords(view, records) {
  if (view !== "accounts") return records;
  return [...records].sort((a, b) => Number(isPaymentPaid(a)) - Number(isPaymentPaid(b)));
}

function isPaymentPaid(item) {
  return String(item.isPaid || item.IsPaid || "").toUpperCase() === "TRUE" || item.isPaid === true;
}

function renderRecordCard(view, item, index) {
  if (view === "accounts") return renderPaymentCard(item, index);
  const model = getCardModel(view, item);
  const selectMode = desktopState.selectMode && !!bulkActionConfig[view];
  return `
    <div class="record-card generic-card ${model.tone} ${selectMode ? "select-mode" : ""}" data-index="${index}" role="button" tabindex="0" style="cursor:pointer; position:relative;">
      ${selectMode ? `<span class="select-check"><i class="fas fa-check"></i></span>` : `<button class="card-popout-btn" title="Open in new window" onclick="event.stopPropagation(); openRecordInNewWindow('${view}', ${index})"><i class="fas fa-up-right-from-square"></i></button>`}
      <h2>${escapeHtml(model.title)}</h2>
      <p>${escapeHtml(model.subtitle)}</p>
      <small>${escapeHtml(model.meta)}</small>
    </div>
  `;
}

function renderPaymentCard(item, index) {
  const model = getCardModel("accounts", item);
  const paymentId = escapeHtml(item.paymentId || item.PaymentId || "");
  const showPaymentRequest =
    item.showPaymentRequest !== false && item.ShowPaymentRequest !== false;
  const pendingClass = isPaymentPaid(item) ? "" : "pending-shadow";
  const selectMode = desktopState.selectMode && !!bulkActionConfig.accounts;
  return `
    <div class="record-card ${model.tone} ${pendingClass} ${selectMode ? "select-mode" : ""}" data-index="${index}" role="button" tabindex="0" style="cursor:pointer; position:relative;">
      ${selectMode ? `<span class="select-check"><i class="fas fa-check"></i></span>` : ""}
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
        <div>
          <h2>${escapeHtml(model.title)}</h2>
          <p>${escapeHtml(model.subtitle)}</p>
          <small>${escapeHtml(model.meta)}</small>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
          <button class="card-popout-btn" style="position:static;" title="Open in new window" onclick="event.stopPropagation(); openRecordInNewWindow('accounts', ${index})"><i class="fas fa-up-right-from-square"></i></button>
          <label style="display:flex; align-items:center; gap:4px; background:#f8f9fa; border:2px solid var(--line); padding:4px 8px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:700; color:#333; white-space:nowrap;" onclick="event.stopPropagation(); togglePaymentRequestVisibility('${paymentId}', this)">
            <input type="checkbox" ${showPaymentRequest ? "checked" : ""} style="width:32px; height:16px; margin:0; pointer-events:none;">
            <span>Show PR</span>
          </label>
          <button onclick="event.stopPropagation(); printSinglePaymentSystem('${paymentId}')" style="background:var(--blue); color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer; min-height:32px; white-space:nowrap;"><i class="fas fa-print"></i> Print</button>
        </div>
      </div>
    </div>
  `;
}

function getCardModel(view, item) {
  if (view === "apartments") {
    const unit = getUnitNumber(item) || item.id || "Unit";
    return {
      title: `Unit ${unit}`,
      subtitle: item.tenant || item.Tenant || item.type || item.Type || "Apartment",
      meta: `Status: ${item.status || item.Status || "Available"}`,
      tone: statusTone(item.status || item.Status),
    };
  }

  if (view === "assets") {
    const nextDate = parseToLocalDateObject(item.nextService || item.NextService || "");
    const overdue = nextDate && nextDate < startOfToday();
    return {
      title: item.type || item.Type || item.tag || item.Tag || "Asset",
      subtitle: [getUnitNumber(item) && `Unit ${getUnitNumber(item)}`, item.loc || item.Loc || item.specs || item.Specs]
        .filter(Boolean)
        .join(" | "),
      meta: `ID: ${item.tag || item.Tag || "No tag"} | ${item.status || item.Status || "Active"}`,
      tone: overdue ? "danger" : statusTone(item.status || item.Status),
    };
  }

  if (view === "tickets") {
    return {
      title: item.issue || item.Issue || item.category || item.Category || "Maintenance Ticket",
      subtitle: [getUnitNumber(item) && `Unit ${getUnitNumber(item)}`, item.description || item.Description]
        .filter(Boolean)
        .join(" | "),
      meta: `ID: ${item.ticketId || item.TicketId || "N/A"} | ${item.status || item.Status || "Open"}`,
      tone: statusTone(item.status || item.Status),
    };
  }

  if (view === "workorders") {
    return {
      title: item.assigned || item.Assigned || item.description || item.Description || "Work Order",
      subtitle: item.description || item.Description || item.scope || item.Scope || item.asset || item.Asset || "",
      meta: `ID: ${item.workOrderId || item.WorkOrderId || "N/A"} | ${item.status || item.Status || "Pending"}`,
      tone: statusTone(item.status || item.Status || item.paidStatus),
    };
  }

  if (view === "inventory") {
    return {
      title: item.name || item.Name || item.item || item.Item || "Inventory Item",
      subtitle: item.category || item.Category || "Stores",
      meta: `ID: ${item.itemId || item.ItemId || "N/A"} | Qty: ${item.qty || item.Qty || 0}`,
      tone: Number(item.qty || item.Qty || 0) <= 0 ? "warning" : "",
    };
  }

  if (view === "vendors") {
    return {
      title: item.company || item.Company || item.name || item.Name || "Vendor",
      subtitle: item.trade || item.Trade || item.service || item.Service || item.phone || item.Phone || item.email || item.Email || "",
      meta: `Status: ${item.status || item.Status || "Active"}`,
      tone: statusTone(item.status || item.Status),
    };
  }

  if (view === "expenserequests") {
    return {
      title: item.job || item.Job || item.reqId || item.ReqId || "Expense Request",
      subtitle: [getUnitNumber(item) && `Unit ${getUnitNumber(item)}`, item.assetTag || item.AssetTag]
        .filter(Boolean)
        .join(" | "),
      meta: `ID: ${item.reqId || item.ReqId || "N/A"} | ₦${formatMoney(item.cost || item.Cost || 0)}`,
      tone: "",
    };
  }

  return {
    title: item.party || item.Party || item.paymentId || item.PaymentId || "Payment",
    subtitle: item.reason || item.Reason || item.type || item.Type || "",
    meta: `${item.direction || item.Direction || "Ledger"} | ${formatMoney(item.amount || item.Amount || 0)}`,
    tone: String(item.direction || item.Direction || "").toLowerCase() === "outflow" ? "warning" : "",
  };
}

function openDesktopRecord(view, item) {
  const type = viewMeta[view]?.newType;
  if (type && typeof openModal === "function") {
    openModal(type, item);
    return;
  }
  showRecordDetails(item);
}

function showRecordDetails(item) {
  const panel = document.getElementById("detail-panel");
  const rows = Object.entries(item || {})
    .filter(([, value]) => value !== "" && value !== null && value !== undefined)
    .slice(0, 24)
    .map(
      ([key, value]) =>
        `<div class="detail-row"><span>${escapeHtml(labelize(key))}</span><strong>${escapeHtml(String(value))}</strong></div>`,
    )
    .join("");

  panel.innerHTML = `
    <button class="panel-close" aria-label="Close"><i class="fas fa-xmark"></i></button>
    <h2>${escapeHtml(getCardModel(desktopState.view, item).title)}</h2>
    ${rows || "<p>No details available.</p>"}
  `;
  panel.hidden = false;
  panel.querySelector(".panel-close").addEventListener("click", () => {
    panel.hidden = true;
  });
}

function renderReportShortcuts() {
  document.getElementById("record-count").textContent = "Report builder";
  document.getElementById("card-grid").innerHTML = `
    <div class="desktop-form-card">
      <label>SELECT CATEGORY PROFILE</label>
      <select id="rep-profile-selector">
        <option value="">-- Select Category --</option>
        <option value="apartments">Apartments & Tenancy</option>
        <option value="equipment">Assets, Equipment & Maintenance</option>
        <option value="financials">Financials & Ledger</option>
        <option value="executive">Executive & Dashboards</option>
      </select>

      <label>SELECT PRINT TYPE CONFIGURATION</label>
      <select id="rep-layout-selector"></select>
      <div id="rep-dynamic-parameters-frame"></div>

      <div class="desktop-report-actions">
        <button class="action-btn" id="desktop-preview-report">
          <i class="fas fa-eye"></i> Generate Preview
        </button>
        <button class="action-btn success" id="desktop-monthly-report">
          <i class="fas fa-layer-group"></i> Monthly Pack
        </button>
      </div>

      <div id="report-onscreen-preview-card" class="desktop-report-preview">
        <h3><i class="fas fa-eye"></i> Layout Print Preview</h3>
        <div id="report-preview-viewport"></div>
        <div class="desktop-report-actions">
          <button class="action-btn success" id="desktop-pdf-report">
            <i class="fas fa-share-alt"></i> Save PDF
          </button>
          <button class="action-btn dark" id="desktop-print-report">
            <i class="fas fa-print"></i> Print
          </button>
          <button class="action-btn" id="desktop-csv-report">
            <i class="fas fa-file-csv"></i> CSV
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("rep-profile-selector").addEventListener("change", handleReportProfileSwitch);
  document.getElementById("rep-layout-selector").addEventListener("change", handleReportLayoutSwitch);
  document.getElementById("desktop-preview-report").addEventListener("click", compileReportPreview);
  document.getElementById("desktop-monthly-report").addEventListener("click", generateMonthlyReportPack);
  document.getElementById("desktop-pdf-report").addEventListener("click", downloadCurrentReportPDF);
  document.getElementById("desktop-print-report").addEventListener("click", printCurrentReport);
  document.getElementById("desktop-csv-report").addEventListener("click", downloadCurrentReportCSV);
}

function renderSettingsShortcuts() {
  document.getElementById("record-count").textContent = "Editable settings";
  document.getElementById("card-grid").innerHTML = `
    <div class="desktop-form-card">
      <label>ESTATE NAME</label>
      <input type="text" id="cfg-estate-name" />
      <label>ESTATE ADDRESS</label>
      <input type="text" id="cfg-estate-address" />
      <label>FM COMPANY NAME</label>
      <input type="text" id="cfg-fm-name" />
      <label>FM COMPANY ADDRESS</label>
      <input type="text" id="cfg-fm-address" />
      <label>COMPANY LOGO URL</label>
      <input type="text" id="cfg-logo-url" />
      <label>MAIN GOOGLE DRIVE FOLDER NAME</label>
      <input type="text" id="cfg-main-folder" />
      <button class="action-btn success" id="desktop-save-settings">
        <i class="fas fa-save"></i> Save Settings
      </button>
    </div>
  `;
  syncSettingsInputsToUIFields();
  document
    .getElementById("desktop-save-settings")
    .addEventListener("click", commitApplicationSettingsData);
}

function openNewRecord() {
  const type = viewMeta[desktopState.view]?.newType;
  if (type && typeof openModal === "function") {
    openModal(type);
    return;
  }
  showToast("New records are not available for this section yet.", "warning");
}

function openMobileApp() {
  window.open("./index.html", "_blank", "noopener");
}

function activeCount(records) {
  return (records || []).filter((item) => !isClosedStatus(item.status || item.Status || item.archived || item.Archived)).length;
}

function isClosedStatus(value) {
  const status = String(value || "").toLowerCase();
  return ["closed", "resolved", "complete", "completed", "paid", "archived", "declined", "yes"].includes(status);
}

function statusTone(value) {
  const status = String(value || "").toLowerCase();
  if (["declined", "archived", "closed", "inactive"].includes(status)) return "declined";
  if (["pending", "open", "in progress", "low stock"].includes(status)) return "warning";
  if (["overdue", "urgent"].includes(status)) return "danger";
  return "";
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function labelize(key) {
  return String(key)
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .trim();
}

// § MULTI-WINDOW SUPPORT
// Opens a small, independent read-only window with a snapshot of the
// record's fields via the Electron bridge exposed in preload.js. This is
// a point-in-time snapshot, not a live view — intended for quick
// side-by-side reference, not for editing.
function openRecordInNewWindow(view, index) {
  const item = (desktopState.lastRecords || [])[index];
  if (!item) return;

  if (!window.desktopBridge || typeof window.desktopBridge.openRecordWindow !== "function") {
    showToast("Multi-window is only available in the desktop app.", "warning");
    return;
  }

  const model = getCardModel(view, item);
  const rowsHtml = Object.entries(item || {})
    .filter(([, value]) => value !== "" && value !== null && value !== undefined)
    .map(
      ([key, value]) =>
        `<div class="row"><span>${escapeHtml(labelize(key))}</span><strong>${escapeHtml(String(value))}</strong></div>`,
    )
    .join("");

  openSnapshotWindow(model.title, rowsHtml);
}

// Recent windows list (in-memory only, resets on app restart). Lets the
// user reopen a snapshot without re-navigating and re-clicking the card.
const MAX_RECENT_WINDOWS = 8;

function openSnapshotWindow(title, rowsHtml) {
  window.desktopBridge.openRecordWindow(title, rowsHtml);
  desktopState.recentWindows = desktopState.recentWindows || [];
  desktopState.recentWindows.unshift({ title, rowsHtml, ts: Date.now() });
  if (desktopState.recentWindows.length > MAX_RECENT_WINDOWS) {
    desktopState.recentWindows.length = MAX_RECENT_WINDOWS;
  }
  renderRecentWindowsList();
}

function toggleRecentWindowsPanel() {
  const panel = document.getElementById("recent-windows-panel");
  if (!panel) return;
  const isOpen = panel.style.display === "block";
  panel.style.display = isOpen ? "none" : "block";
  if (!isOpen) renderRecentWindowsList();
}

function renderRecentWindowsList() {
  const listEl = document.getElementById("recent-windows-list");
  if (!listEl) return;
  const recent = desktopState.recentWindows || [];
  if (recent.length === 0) {
    listEl.innerHTML = `<div style="padding:14px; color:var(--muted); font-size:13px;">No windows opened yet. Use the <i class="fas fa-up-right-from-square"></i> icon on any card.</div>`;
    return;
  }
  listEl.innerHTML = recent
    .map(
      (w, i) =>
        `<button class="recent-window-item" onclick="window.desktopBridge.openRecordWindow(desktopState.recentWindows[${i}].title, desktopState.recentWindows[${i}].rowsHtml)">
          <i class="fas fa-clone"></i>
          <span>${escapeHtml(w.title)}</span>
        </button>`,
    )
    .join("");
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
