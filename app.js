    // REPLACE THIS URL WITH YOUR ACTUAL APP SCRIPT URL
    const GAS_URL = "https://script.google.com/macros/s/AKfycbywuJnim2WBgSIrM-uFvLxKyBtKvMevnbbs0QOHQBShlsHHtAHbUdJAxeaP524v_Boj/exec"; 
                       
    // --- FORMATTING HELPERS ---
    function formatMoney(amount) {
      return Number(amount || 0).toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      });
    }

    function convertAmountToWords(amount) {
      const val = parseFloat(amount);
      if (isNaN(val) || val === 0) return "Zero Naira Only";

      const a = ['','One ','Two ','Three ','Four ','Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
      const b = ['', '', 'Twenty ','Thirty ','Forty ','Fifty ','Sixty ','Seventy ','Eighty ','Ninety '];

      const toWords = (num) => {
        if (num === 0) return '';
        if (num < 20) return a[num];
        if (num < 100) return b[Math.floor(num / 10)] + a[num % 10];
        if (num < 1000) return a[Math.floor(num / 100)] + "Hundred " + (num % 100 > 0 ? "and " + toWords(num % 100) : "");
        if (num < 1000000) return toWords(Math.floor(num / 1000)) + "Thousand " + toWords(num % 1000);
        if (num < 1000000000) return toWords(Math.floor(num / 1000000)) + "Million " + toWords(num % 1000000);
        return toWords(Math.floor(num / 1000000000)) + "Billion " + toWords(num % 1000000000);
      };

      const naira = Math.floor(val);
      const kobo = Math.round((val - naira) * 100);

      let result = toWords(naira).trim() + " Naira";
      if (kobo > 0) result += " and " + toWords(kobo).trim() + " Kobo";
      
      return result + " Only";
    }

    // --- UNIFIED PDF COMPILER ENGINE ---
    function extractDriveFileId(url) {
      if (!url) return null;
      let match = url.match(/\/d\/(.+?)(\/|$)/);
      if (match) return match[1];
      match = url.match(/id=(.+?)(&|$)/);
      if (match) return match[1];
      return null;
    }

// =========================================================
// PDF ENGINE
// =========================================================

function normalizeReportSource(source) {
  if (typeof source === 'string') {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = source;
    return wrapper;
  }
  return source;
}

async function compileAndDownloadUnifiedPDF(sourceElement, attachmentUrls = [], filename = 'Facility_Report') {
  const normalizedSource = normalizeReportSource(sourceElement);
  if (!normalizedSource || typeof normalizedSource.cloneNode !== 'function') {
    alert('Report content is not ready yet.');
    return;
  }

  const loadingScreen = document.createElement('div');
  loadingScreen.id = 'pdf-loading-screen';
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
    
    const originalInputs = normalizedSource.querySelectorAll('input, select, textarea');
    const clonedInputs = clone.querySelectorAll('input, select, textarea');
    
    originalInputs.forEach((original, index) => {
      const cloneNode = clonedInputs[index];
      if (!cloneNode) return;
      const span = document.createElement('span');
      
      if (original.type === 'checkbox' || original.type === 'radio') {
        span.innerHTML = original.checked ? '<b>Yes</b>' : 'No';
        span.style.fontSize = '14px';
      } else {
        span.innerText = original.value || original.innerText || ''; 
      }
      
      span.style.display = 'inline-block';
      span.style.fontWeight = 'bold';
      span.style.color = '#000';
      
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
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 15px; 
              border: 1px solid #444 !important; /* Outer border */
            }
            th, td { 
              text-align: left; 
              padding: 8px; 
              border: 1px solid #ccc !important;
              vertical-align: top;
            }
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
      method: 'POST',
      body: JSON.stringify({
        action: 'generatePDF',
        html: cleanHTML
      })
    });
    const result = await response.json();

    if (result.status !== 'success') throw new Error(result.message);

    loadingScreen.querySelector('h2').innerText = "Processing Attachments...";
    const { PDFDocument, degrees, rgb } = PDFLib;
    
    const pdfBytes = Uint8Array.from(atob(result.base64), c => c.charCodeAt(0));
    const masterPdf = await PDFDocument.load(pdfBytes);

    if (attachmentUrls && attachmentUrls.length > 0) {
      for (let url of attachmentUrls) {
        if (!url) continue;
        let fileId = null;
        try { fileId = extractDriveFileId(url); } catch(e) {}
        if (!fileId) continue;

        try {
          const fileData = await callApi('getFileBase64', { id: fileId });
          if (fileData?.status === 'success') {
            const bytes = Uint8Array.from(atob(fileData.base64.replace(/\s/g, '')), c => c.charCodeAt(0));
            if (fileData.mimeType === 'application/pdf') {
              const extPdf = await PDFDocument.load(bytes);
              const pages = await masterPdf.copyPages(extPdf, extPdf.getPageIndices());
              pages.forEach(p => masterPdf.addPage(p));
            } else if (fileData.mimeType.startsWith('image/')) {
              const img = fileData.mimeType === 'image/png' ? await masterPdf.embedPng(bytes) : await masterPdf.embedJpg(bytes);
              const page = masterPdf.addPage();
              const ratio = Math.min((page.getWidth() - 80) / img.width, (page.getHeight() - 80) / img.height, 1);
              page.drawImage(img, { x: (page.getWidth() - img.width * ratio) / 2, y: (page.getHeight() - img.height * ratio) / 2, width: img.width * ratio, height: img.height * ratio });
            }
          }
        } catch (e) { console.error('Attachment error:', e); }
      }
    }

    const pages = masterPdf.getPages();
    pages.forEach((page, index) => {
      const { width, height } = page.getSize();
      page.drawText(`Page ${index + 1} of ${pages.length}`, { x: width - 110, y: 20, size: 10, color: rgb(0.4, 0.4, 0.4) });
      page.drawText('Facility Pro', { x: width / 4, y: height / 2, size: 48, rotate: degrees(-45), opacity: 0.08, color: rgb(0.5, 0.5, 0.5) });
    });

    loadingScreen.querySelector('h2').innerText = "Finishing up...";
    const finalPdfBytes = await masterPdf.save();
    const file = new File([finalPdfBytes], filename + '.pdf', { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: filename, text: 'Facility Pro report attached.', files: [file] });
      loadingScreen.innerHTML = '<i class="fas fa-check-circle" style="font-size: 50px; margin-bottom: 20px; color: #198754;"></i><h2 style="margin: 0;">Shared Successfully!</h2>';
    } else {
      loadingScreen.innerHTML = '<i class="fas fa-download" style="font-size: 50px; margin-bottom: 20px; color: #198754;"></i><h2 style="margin: 0;">Downloading...</h2>';
      const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename + '.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(link.href), 3000);
    }

  } catch (err) {
    console.error('Server PDF Generation Failed:', err);
    alert('Server PDF Generation Failed. Please check your internet connection.');
  } finally {
    setTimeout(() => {
      const screen = document.getElementById('pdf-loading-screen');
      if (screen) screen.remove();
    }, 2500);
  }
}


async function callApi(action, data = {}) {
      try {
        const response = await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ action: action, data: data }) });
        const result = await response.json();
        
        if (action.startsWith('get')) {
          localStorage.setItem('facility_pro_backup_' + action, JSON.stringify(result));
        }
        
        return result;
      } catch (err) { 
        console.warn("Network Error / Offline:", err);
        
        if (action.startsWith('get')) {
          const backup = localStorage.getItem('facility_pro_backup_' + action);
          return backup ? JSON.parse(backup) : []; 
        }

        if (action === 'uploadImage') {
          alert("Cannot upload photos while offline. Please try again when connected.");
          return null; 
        }

        const queue = JSON.parse(localStorage.getItem('facility_pro_sync_queue') || '[]');
        queue.push({ action, data, timestamp: Date.now() });
        localStorage.setItem('facility_pro_sync_queue', JSON.stringify(queue));
        
        // Show sync status indicator globally
        document.getElementById('sync-status').style.display = 'block';
        alert("Connection lost. Your data was saved locally and will sync automatically when you regain signal.");
        return { status: "queued" };
      }
    }
    
    let cache = { apts: [], assets: [], tickets: [], staff: [], vendors: [], utilities: [], workorders: [], inventory: [], payments: [], expenseRequests: [], cashExpenses: [] };
    
    let currentModalFiles = [];
    let currentAvatarPhoto = "";
    let currentSelectedRecord = null;
    
    let appSettings = {
      estateName: "Facility Pro Estate",
      estateAddress: "123 Infrastructure Way, Lagos, Nigeria",
      fmName: "Facility Operations Management",
      fmAddress: "Primary Support Office Center",
      logoUrl: ""
    };

    window.onload = async () => { 
      await loadApplicationSettingsData();
      bootstrapDataRegistriesPipeline(); 
    };

    function generateNextId(prefix, list, idKey) {
      let maxId = 0;
      const safeList = Array.isArray(list) ? list : [];
      
      safeList.forEach(item => {
        const idVal = item[idKey] || item[idKey.charAt(0).toUpperCase() + idKey.slice(1)] || item[idKey.toUpperCase()];
        if (idVal && typeof idVal === 'string' && idVal.startsWith(prefix)) {
          const parts = idVal.split('-');
          if (parts.length > 1) {
            const numPart = parseInt(parts[1], 10);
            if (!isNaN(numPart) && numPart > maxId) maxId = numPart;
          }
        }
      });
      return `${prefix}-${String(maxId + 1).padStart(4, '0')}`;
    }


    async function loadApplicationSettingsData() {
      const stored = localStorage.getItem("facility_pro_config_meta");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed) appSettings = { ...appSettings, ...parsed };
        } catch(e) {}
      }
      applySettingsToUIHeaders();

      try {
        const cloudSettings = await callApi('getSettings', {});
        if (cloudSettings && (cloudSettings.estateName || cloudSettings.fmName)) {
          appSettings = { ...appSettings, ...cloudSettings };
          localStorage.setItem("facility_pro_config_meta", JSON.stringify(appSettings));
          applySettingsToUIHeaders();
          syncSettingsInputsToUIFields();
        }
      } catch(e) { console.error("Cloud configuration load failed:", e); }
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
      if (titleEl) {
        titleEl.innerText = appSettings.estateName || "Facility Pro";
      }
    }

    async function commitApplicationSettingsData() {
      appSettings.estateName = document.getElementById("cfg-estate-name").value.trim();
      appSettings.estateAddress = document.getElementById("cfg-estate-address").value.trim();
      appSettings.fmName = document.getElementById("cfg-fm-name").value.trim();
      appSettings.fmAddress = document.getElementById("cfg-fm-address").value.trim();
      appSettings.logoUrl = document.getElementById("cfg-logo-url").value.trim();
      
      localStorage.setItem("facility_pro_config_meta", JSON.stringify(appSettings));
      applySettingsToUIHeaders();
      
      try {
        await callApi('saveSettings', appSettings);
        alert("Settings successfully synchronized globally to Google Sheet across all devices!");
      } catch (err) {
        console.error("Cloud synchronization failing, saved locally:", err);
        alert("Saved locally! Cloud syncing is currently offline.");
      }
      showPage("dashboard");
    }

    function syncSettingsInputsToUIFields() {
      if (document.getElementById("cfg-estate-name")) {
        document.getElementById("cfg-estate-name").value = appSettings.estateName || "";
        document.getElementById("cfg-estate-address").value = appSettings.estateAddress || "";
        document.getElementById("cfg-fm-name").value = appSettings.fmName || "";
        document.getElementById("cfg-fm-address").value = appSettings.fmAddress || "";
        document.getElementById("cfg-logo-url").value = appSettings.logoUrl || "";
      }
    }

    async function bootstrapDataRegistriesPipeline() {
      const actions = [
        'getApartments', 'getAssets', 'getMaintenance', 'getStaff', 'getVendors', 
        'getUtilities', 'getWorkOrders', 'getInventory', 'getPayments', 
        'getExpenseRequests', 'getCashExpenses'
      ];
      const map = [
        'apts', 'assets', 'tickets', 'staff', 'vendors', 
        'utilities', 'workorders', 'inventory', 'payments', 
        'expenseRequests', 'cashExpenses'
      ];
      
      console.log("Starting Data Pipeline...");

      const results = await Promise.all(actions.map(async (act) => {
        try { return await callApi(act, {}); } 
        catch (e) { return []; }
      }));

      results.forEach((res, i) => { 
        if(res && res.status !== "queued") { cache[map[i]] = res; }
      });

      if (cache.apts) sortApartmentsCacheList();
      
      updateDashboardCounters();
      evalPreventiveMaintenanceAlerts();
      prepopulateStaticFilterSelectors();
      
      console.log("Registry Pipeline Finished.");
    }
    
    function getUnitNumber(u) {
      if (!u) return '';
      if (u.apt !== undefined) return u.apt;
      if (u.Apt !== undefined) return u.Apt;
      if (u.APT !== undefined) return u.APT;
      for (var key in u) {
        if (key.toLowerCase().trim() === 'apt') return u[key];
      }
      return '';
    }

    function fromSheetDate(dStr) {
      if (!dStr) return "";
      dStr = String(dStr).trim();
      if (dStr.match(/^\d{4}-\d{2}-\d{2}/)) return dStr.substring(0, 10);
      if (dStr.includes('/')) {
        const clean = dStr.split(' ')[0];
        const parts = clean.split('/');
        if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      const parsed = Date.parse(dStr);
      if (!isNaN(parsed)) {
        const dt = new Date(parsed);
        const pad = (num) => String(num).padStart(2, '0');
        return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
      }
      return "";
    }

    function formatDateForDisplay(dStr) {
      if (!dStr) return "Not Tracked";
      dStr = String(dStr).trim();
      if (dStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) return dStr;
      if (dStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        const parts = dStr.substring(0, 10).split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      if (dStr.includes('/')) {
        const clean = dStr.split(' ')[0];
        const parts = clean.split('/');
        if (parts.length === 3) return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
      }
      const parsed = Date.parse(dStr);
      if (!isNaN(parsed)) {
        const dt = new Date(parsed);
        const pad = (num) => String(num).padStart(2, '0');
        return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
      }
      return dStr;
    }

    function parseToLocalDateObject(dateStr) {
      if (!dateStr) return null;
      const normalized = fromSheetDate(dateStr);
      if (!normalized) return null;
      const [y, m, d] = normalized.split('-');
      return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    }

    function sortApartmentsCacheList() {
      if (!cache.apts || !Array.isArray(cache.apts)) return;
      cache.apts.sort((a, b) => {
        const aNum = String(getUnitNumber(a)).replace(/[^0-9]/g, '');
        const bNum = String(getUnitNumber(b)).replace(/[^0-9]/g, '');
        const aVal = parseInt(aNum, 10) || 0;
        const bVal = parseInt(bNum, 10) || 0;
        return aVal - bVal;
      });
    }

    function prepopulateStaticFilterSelectors() {
      const uFilter = document.getElementById('asset-unit-filter');
      if (uFilter && cache.apts.length > 0) {
        uFilter.innerHTML = '<option value="ALL">-- ALL ASSETS --</option>';
        cache.apts.forEach(a => {
          const uNum = getUnitNumber(a);
          if (uNum !== undefined && uNum !== '') {
            const o = document.createElement('option'); o.value = uNum; o.innerText = `Unit ${uNum}`; uFilter.appendChild(o);
          }
        });
      }
    }

    function populateUnitDropdown(selectElementId, currentlySelectedValue) {
      const selectElement = document.getElementById(selectElementId);
      if (!selectElement) return;
      selectElement.innerHTML = '<option value="">-- Choose Unit Reference --</option>';
      
      function renderPickerOptions() {
        (cache.apts || []).forEach(u => {
          const uNum = getUnitNumber(u);
          if (uNum !== undefined && uNum !== '') {
            const statusLabel = String(u.status || u.Status || '').toLowerCase();
            if (statusLabel === 'services') return;
            const opt = document.createElement('option');
            opt.value = uNum;
            opt.innerText = 'Unit ' + uNum;
            if (currentlySelectedValue && String(uNum) === String(currentlySelectedValue)) opt.selected = true;
            selectElement.appendChild(opt);
          }
        });
      }

      if (!cache.apts || cache.apts.length === 0) {
        callApi('getApartments', {}).then(res => {
          if (res) {
            cache.apts = res;
            sortApartmentsCacheList();
            renderPickerOptions();
          }
        });
      } else {
        renderPickerOptions();
      }
    }

    function evalPreventiveMaintenanceAlerts() {
      if (!cache.assets) return;
      const today = new Date(); today.setHours(0,0,0,0);
      let overdueCount = 0;
      cache.assets.forEach(a => {
        if (String(a.status || a.Status || '') !== 'Archived' && String(a.archived || a.Archived || '') !== 'Yes') {
          const nextServiceDate = parseToLocalDateObject(a.nextService || a.NextService || '');
          if (nextServiceDate && nextServiceDate <= today) overdueCount++;
        }
      });
      const banner = document.getElementById('pms-alert-banner');
      const text = document.getElementById('pms-alert-text');
      if (overdueCount > 0 && banner && text) {
        text.innerText = `${overdueCount} Heavy Asset${overdueCount > 1 ? 's Are' : ' Is'} Overdue for Scheduled PM Check`;
        banner.style.display = 'flex';
      } else if (banner) {
        banner.style.display = 'none';
      }
    }

    function renderGeneratorEfficiencyLogs() {
      const card = document.getElementById('generator-efficiency-card'); if (!card) return;
      const plantLogs = (cache.utilities || []).filter(u => u.type === 'Plant Check' && String(getUnitNumber(u)).includes('GENERATOR')).sort((a,b) => parseFloat(b.reading || 0) - parseFloat(a.reading || 0));
      if (plantLogs.length < 2) { card.style.display = 'none'; return; }
      
      const current = plantLogs[0];
      const previous = plantLogs[1];
      const deltaHours = parseFloat(current.reading || 0) - parseFloat(previous.reading || 0);
      const litersAdded = parseFloat(current.amount || current.Amount || 0);
      if (deltaHours > 0 && litersAdded > 0) {
        const rate = (litersAdded / deltaHours).toFixed(2);
        card.innerHTML = `<h4><i class="fas fa-chart-line"></i> Generator Burn Analytics</h4>
                          <p style="font-size:14px; font-weight:600; margin-top:4px;">Last run logged <strong>${deltaHours} Hours</strong> with <strong>${litersAdded}L</strong> addition.</p>
                          <div style="font-size:22px; font-weight:900; color:var(--primary); margin-top:5px;">${rate} L / Hr <span style="font-size:12px; color:var(--muted);">Consumption Rate</span></div>`;
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    }

    function renderTotalBalance() {
      const balEl = document.getElementById('s-ledger-balance');
      if (!balEl) return;
      
      // Initialize both Cleared and Pending trackers (No duplicates!)
      let totalInflow = 0;       // Actual money in the bank
      let totalOutflow = 0;      // Actual money spent
      let pendingInflow = 0;     // Expected receivables
      let pendingOutflow = 0;    // Unpaid payables

      if (cache.payments) {
        cache.payments.forEach(p => {
          const amt = parseFloat(p.amount || p.Amount || 0);
          // Check if the record has the paid flag
          const isCleared = (String(p.isPaid).toUpperCase() === 'TRUE' || p.isPaid === true);

          if (p.direction === 'OUTFLOW') {
            if (isCleared) totalOutflow += amt;
            else pendingOutflow += amt;
          } else {
            if (isCleared) totalInflow += amt;
            else pendingInflow += amt;
          }
        });
      }
      
      if (cache.cashExpenses) {
        cache.cashExpenses.forEach(c => {
          const amt = parseFloat(c.amount || c.Amount || 0);
          const isCleared = (String(c.isPaid).toUpperCase() === 'TRUE' || c.isPaid === true);

          if (isCleared) totalOutflow += amt;
          else pendingOutflow += amt;
        });
      }
      
      const netBalance = totalInflow - totalOutflow;
      
      balEl.innerText = `${netBalance >= 0 ? '+' : '-'}₦${formatMoney(Math.abs(netBalance))}`;
      balEl.style.color = netBalance >= 0 ? 'var(--success)' : 'var(--danger)';
    }

    function updateDashboardCounters() {
      const tenancyCount = cache.apts ? cache.apts.filter(a => {
        var status = String(a.status || a.Status || '').toLowerCase();
        var tenant = String(a.tenant || a.Tenant || '').toLowerCase();
        var type = String(a.type || a.Type || '').toLowerCase();
        return status !== 'services' && tenant !== 'services' && type !== 'services';
      }).length : 0;
      
      const assetCount = cache.assets ? cache.assets.filter(a => String(a.status || a.Status || '') !== 'Archived' && String(a.archived || a.Archived || '') !== 'Yes').length : 0;
      const invCount = cache.inventory ? cache.inventory.filter(i => String(i.archived || i.Archived || '') !== 'Yes').length : 0;
      const maintCount = cache.tickets ? cache.tickets.filter(t => String(t.status || t.Status || '') !== 'Resolved').length : 0;
      const woCount = cache.workorders ? cache.workorders.filter(w => String(w.status || w.Status || '') === 'Pending Approval').length : 0;

      const today = new Date(); today.setHours(0,0,0,0);
      const fourteenDaysLimit = new Date(); fourteenDaysLimit.setDate(today.getDate() + 14); fourteenDaysLimit.setHours(23,59,59,999);
      let pmCombinedSum = 0;
      
      if (cache.assets) {
        cache.assets.forEach(a => {
          if (String(a.status || a.Status || '') !== 'Archived' && String(a.archived || a.Archived || '') !== 'Yes') {
            const nextServiceDate = parseToLocalDateObject(a.nextService || a.NextService || '');
            if (nextServiceDate && nextServiceDate <= fourteenDaysLimit) pmCombinedSum++;
          }
        });
      }

      if (document.getElementById('s-tenancy')) document.getElementById('s-tenancy').innerText = tenancyCount || '0';
      if (document.getElementById('s-asset')) document.getElementById('s-asset').innerText = assetCount || '0';
      if (document.getElementById('s-inv')) document.getElementById('s-inv').innerText = invCount || '0';
      if (document.getElementById('count-maint')) document.getElementById('count-maint').innerText = maintCount || '0';
      if (document.getElementById('s-wo')) document.getElementById('s-wo').innerText = woCount || '0';
      if (document.getElementById('s-pm-due')) document.getElementById('s-pm-due').innerText = pmCombinedSum || '0';
    }

    function showPage(p) {
      document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active-view'));
      document.getElementById('report-print-container').innerHTML = '';
      
      const target = document.getElementById('view-' + p);
      if (target) { target.classList.add('active-view'); window.scrollTo(0,0); }
      
      const homeBtn = document.querySelector('.active-view .home-btn');
      if (homeBtn) {
        const moreChildren = ['serviceunits', 'utilities', 'expenserequests', 'cashexpenses', 'payments', 'staff', 'vendors', 'archived', 'reports', 'settings'];
        homeBtn.onclick = () => showPage(moreChildren.includes(p) ? 'more' : 'dashboard');
      }
      
      if (p === 'dashboard') { updateDashboardCounters(); evalPreventiveMaintenanceAlerts(); }
      else if (p === 'reports') { initReportsEngine(); }
      else if (p === 'settings') { syncSettingsInputsToUIFields(); }
      else if (p === 'utilities') { refreshData('utilities'); setTimeout(renderGeneratorEfficiencyLogs, 500); }
      else if (p === 'payments') { refreshData('payments'); }
      else if (p !== 'more') { refreshData(p); }
    }

    function openRecordRow(type, lookupId) {
      let match = null;
      if (type === 'apartment') match = cache.apts.find(i => String(getUnitNumber(i)) === String(lookupId));
      if (type === 'asset') match = cache.assets.find(i => String(i.tag || i.Tag || i.TAG) === String(lookupId));
      if (type === 'maintenance') match = cache.tickets.find(i => String(i.ticketId || i.TicketId || i.TICKETID) === String(lookupId));
      if (type === 'staff') match = cache.staff.find(i => String(i.rowId || i.RowId || i.ROWID) === String(lookupId));
      if (type === 'vendor') match = cache.vendors.find(i => String(i.rowId || i.RowId || i.ROWID) === String(lookupId));
      if (type === 'workorder') match = cache.workorders.find(i => String(i.workOrderId || i.WorkOrderId || i.WORKORDERID) === String(lookupId));
      if (type === 'inventory') match = cache.inventory.find(i => String(i.itemId || i.ItemId || i.ITEMID) === String(lookupId));
      if (type === 'payment') match = cache.payments.find(i => String(i.paymentId || i.PaymentId) === String(lookupId));
      if (type === 'expenserequest') match = cache.expenseRequests.find(i => String(i.reqId) === String(lookupId));
      if (type === 'cashexpense') match = cache.cashExpenses.find(i => String(i.cashId) === String(lookupId));
      if (type === 'utility' || type === 'generator') {
        match = cache.utilities.find((i, idx) => String(i.rowId || i.id || idx) === String(lookupId));
      }
      
      if (match) openModal(type, match);
    }

    window.processExpenseAction = function(actionType, reqId) {
      const req = cache.expenseRequests.find(r => r.reqId === reqId);
      if(!req) return;

      if (actionType === 'DELETE') {
        if(confirm("Permanently delete this request?")) {
          callApi('deleteExpenseRequest', { reqId: reqId }).then(() => refreshData('expenserequests'));
        }
      } 
      else if (actionType === 'CREATE_WO') {
        openModal('workorder', { apt: req.apt, description: req.job, amount: req.cost, asset: req.assetTag });
        const originalSubmit = document.getElementById('modalSubmit').onclick;
        document.getElementById('modalSubmit').onclick = () => {
          originalSubmit();
          callApi('deleteExpenseRequest', { reqId: reqId }); 
        };
      }
      else if (actionType === 'CREATE_CASH') {
         openModal('cashexpense', { amount: req.cost, description: req.job, apt: req.apt });
         const originalSubmit = document.getElementById('modalSubmit').onclick;
         document.getElementById('modalSubmit').onclick = () => {
           originalSubmit();
           callApi('deleteExpenseRequest', { reqId: reqId });
         };
      }
    };

    function refreshData(p) {
      const idMap = { 
        'apartments': 'apt-list', 'serviceunits': 'service-list', 'assets': 'asset-list', 
        'maintenance': 'maint-list', 'maint': 'maint-list', 'utilities': 'util-list', 
        'staff': 'staff-list', 'vendors': 'vendor-list', 'workorders': 'wo-list', 
        'inventory': 'inventory-list', 'payments': 'payment-list', 'archived': 'archived-list',
        'expenserequests': 'expense-req-list', 'cashexpenses': 'cash-expense-list'
      };
      const listEl = document.getElementById(idMap[p]); if (!listEl) return;
      
      const isMaint = (p === 'maintenance' || p === 'maint');
      
      let apiCmd = p === 'assets' ? 'getAssets' : 
                   p === 'vendors' ? 'getVendors' : 
                   isMaint ? 'getMaintenance' : 
                   p === 'utilities' ? 'getUtilities' : 
                   p === 'staff' ? 'getStaff' : 
                   p === 'workorders' ? 'getWorkOrders' : 
                   p === 'inventory' ? 'getInventory' : 
                   p === 'payments' ? 'getPayments' : 
                   p === 'expenserequests' ? 'getExpenseRequests' :
                   p === 'cashexpenses' ? 'getCashExpenses' : 'getApartments';

      if (p === 'archived') { renderArchiveBinDashboardView(listEl); return; }

      callApi(apiCmd, {}).then(data => {
        let displayData = data || [];
        if (p === 'apartments' || p === 'serviceunits') { 
          cache.apts = displayData; sortApartmentsCacheList(); 
          if (p === 'apartments') {
            displayData = cache.apts.filter(item => item && String(item.type || item.Type || '').toLowerCase() !== 'services');
          } else {
            displayData = cache.apts.filter(item => item && String(item.type || item.Type || '').toLowerCase() === 'services');
          }
        }
        if (p === 'assets') { cache.assets = displayData; displayData = displayData.filter(item => item && String(item.status || item.Status || '') !== 'Archived' && String(item.archived || item.Archived || '') !== 'Yes'); }
        if (isMaint) cache.tickets = displayData;
        if (p === 'staff') { cache.staff = displayData; displayData = displayData.filter(item => item && String(item.archived || item.Archived || '') !== 'Yes'); }
        if (p === 'vendors') { cache.vendors = displayData; displayData = displayData.filter(item => item && String(item.archived || item.Archived || '') !== 'Yes'); }
        if (p === 'utilities') cache.utilities = displayData;
        if (p === 'workorders') cache.workorders = displayData;
        if (p === 'payments') {
            cache.payments = displayData; 
            if(!cache.cashExpenses || cache.cashExpenses.length === 0) {
               callApi('getCashExpenses', {}).then(cashData => {
                 cache.cashExpenses = cashData || [];
                 renderTotalBalance();
               });
            } else {
               renderTotalBalance();
            }
        }
        if (p === 'expenserequests') cache.expenseRequests = displayData;
        if (p === 'cashexpenses') {
             cache.cashExpenses = displayData;
             if(!cache.payments || cache.payments.length === 0) {
                callApi('getPayments', {}).then(payData => {
                    cache.payments = payData || [];
                    renderTotalBalance();
                });
             } else {
                 renderTotalBalance();
             }
        }
        if (p === 'inventory') { cache.inventory = displayData; displayData = displayData.filter(item => item && String(item.archived || item.Archived || '') !== 'Yes'); }
    
        if (p === 'assets') {
          const filter = document.getElementById('asset-unit-filter');
          if (filter && filter.value !== "ALL") displayData = displayData.filter(item => String(getUnitNumber(item)) === filter.value);
        }
        if (isMaint) {
          const filter = document.getElementById('maint-status-filter');
          if (filter && filter.value !== "ALL") displayData = displayData.filter(item => String(item.status || item.Status || '') === filter.value);
        }
        if (p === 'workorders') {
          const filter = document.getElementById('wo-status-filter');
          if (filter && filter.value !== "ALL") displayData = displayData.filter(item => String(item.status || item.Status || '') === filter.value);
        }
    
        listEl.innerHTML = displayData.map((item, idx) => {
          if (!item) return '';
          var unitId = getUnitNumber(item);
          
          if (p === 'expenserequests') {
            return `
              <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:start;" onclick="openRecordRow('expenserequest', '${item.reqId}')">
                  <div><strong style="font-size:20px;">Unit ${unitId}</strong><br><small style="color:var(--muted); font-weight:700;">${item.reqId}</small></div>
                  <div style="font-size:20px; font-weight:900; color:var(--primary)">₦${formatMoney(item.cost)}</div>
                </div>
                <div style="font-size:15px; margin:8px 0; font-weight:600; color:#000;">${item.job || ''}</div>
                <div style="display:flex; gap:8px; margin-top:10px;">
                  <button onclick="processExpenseAction('CREATE_WO', '${item.reqId}')" style="flex:1; background:#000; color:#fff; padding:10px; border-radius:8px; font-weight:900; border:none; cursor:pointer;">New WO</button>
                  <button onclick="processExpenseAction('CREATE_CASH', '${item.reqId}')" style="flex:1; background:var(--primary); color:#fff; padding:10px; border-radius:8px; font-weight:900; border:none; cursor:pointer;">Cash Exp</button>
                  <button onclick="processExpenseAction('DELETE', '${item.reqId}')" style="background:var(--danger); color:#fff; padding:10px 15px; border-radius:8px; border:none; cursor:pointer;"><i class="fas fa-trash"></i></button>
                </div>
                <button onclick="event.stopPropagation(); printSingleExpenseRequestDirect('${item.reqId}')" style="width:100%; margin-top:8px; background:var(--card-light); color:#000; border:2px solid var(--border); padding:10px; border-radius:8px; font-size:12px; font-weight:800; cursor:pointer; text-transform:uppercase;">
                  <i class="fas fa-print"></i> Print Request
                </button>
              </div>`;
          }
          else if (p === 'cashexpenses') {
             return `
              <div class="card" onclick="openRecordRow('cashexpense', '${item.cashId}')">
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:4px;">
                  <div><strong style="font-size:20px;">Unit ${unitId || 'N/A'}</strong><br><small style="color:var(--muted); font-weight:700;">ID: ${item.cashId}</small></div>
                  <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
                    <div style="text-align:right;"><span style="font-size:20px; font-weight:900; color:var(--danger);">-₦${formatMoney(item.amount)}</span><br><small style="font-size:11px; font-weight:700; color:var(--muted);">${formatDateForDisplay(item.date)}</small></div>
                    <button onclick="event.stopPropagation(); printSingleCashExpenseDirect('${item.cashId}')" style="background:var(--primary); color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer; text-transform:uppercase;">
                      <i class="fas fa-print"></i> Print
                    </button>
                  </div>
                </div>
                <div style="font-size:15px; font-weight:600; color:#000;">${item.description || ''}</div>
              </div>`;
          }
          else if (isMaint) {
            return `
              <div class="card" onclick="openRecordRow('maintenance', '${item.ticketId || item.TicketId}')">
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:4px;">
                  <div><strong style="font-size:20px;">Unit ${unitId}</strong><br><small style="color:var(--muted); font-weight:700;">${item.ticketId || item.TicketId}</small></div>
                  <span style="padding:4px 10px; border:2px solid #000; border-radius:6px; font-size:12px; font-weight:900; background:${String(item.status || '').toLowerCase() === 'resolved' ? 'var(--success)' : 'var(--danger)'}; color:#fff;">${String(item.status || 'OPEN').toUpperCase()}</span>
                </div>
                <div style="font-size:16px; font-weight:800; color:var(--primary);">${item.category || item.Category || ''}</div>
                <div style="font-size:15px; color:#000; font-weight:600;">${item.description || item.Description || ''}</div>
              </div>`;
          } 
          else if (p === 'workorders') {
            const woId = item.workOrderId || item.WorkOrderId;
            
            const submittedPreview = (item.submittedValue || item.SubmittedValue) 
              ? `<span style="font-size:13px; font-weight:700; color:var(--muted); text-decoration:line-through; margin-left:8px;">₦${formatMoney(item.submittedValue || item.SubmittedValue)}</span>` 
              : '';

            return `
              <div class="card" onclick="openRecordRow('workorder', '${woId}')">
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:4px;">
                  <div>
                    <strong style="font-size:20px;">Unit ${unitId}</strong><br>
                    <small style="color:var(--muted); font-weight:700;">${woId}</small>
                  </div>
                  <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
                    <span style="padding:4px 10px; border:2px solid #000; border-radius:6px; font-size:12px; font-weight:900; background:${String(item.status || '') === 'Approved' ? 'var(--success)' : String(item.status || '') === 'Declined' ? 'var(--danger)' : '#ffc107'}; color:#fff; text-align:center;">
                      ${String(item.status || 'PENDING').toUpperCase()}
                    </span>
                    
                    <div style="display:flex; gap:5px;">
                      <button onclick="event.stopPropagation(); printSingleWorkOrderDirect('${woId}', false)" style="background:var(--card-light); color:#000; border:2px solid var(--border); padding:6px 10px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer; text-transform:uppercase;">
                        <i class="fas fa-file-alt"></i> Text
                      </button>
                      <button onclick="event.stopPropagation(); printSingleWorkOrderDirect('${woId}', true)" style="background:var(--primary); color:#fff; border:none; padding:6px 10px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer; text-transform:uppercase;">
                        <i class="fas fa-paperclip"></i> Full
                      </button>
                    </div>

                  </div>
                </div>
                
                <div style="display:flex; align-items:baseline; margin:4px 0;">
                   <div style="font-size:18px; font-weight:900; color:var(--success)">₦${formatMoney(item.amount)}</div>
                   ${submittedPreview}
                </div>
                
                ${item.assigned ? `<div style="font-size:14px; font-weight:700; color:var(--muted); margin-bottom:4px;"><i class="fas fa-user-check"></i> ${item.assigned} ${item.duration ? `• ${item.duration}` : ''}</div>` : ''}
                <div style="font-size:15px; font-weight:600; color:#000;">${item.description || item.Description || ''}</div>
              </div>`;
          }
          else if (p === 'payments') {
            const isOutflow = item.direction === 'OUTFLOW';
            const color = isOutflow ? 'var(--danger)' : 'var(--success)';
            const sign = isOutflow ? '-' : '+';
            
            const reasonPreview = item.reason ? `<div style="font-size:13px; color:var(--muted); margin-top:2px;">${item.reason}</div>` : '';
            const linkPreview = item.reference ? `<span style="background:var(--card-light); padding:2px 6px; border:1px solid var(--border); border-radius:4px; font-size:10px; margin-left:6px;"><i class="fas fa-link"></i> ${item.reference}</span>` : '';
            const bankPreview = item.bank ? `${item.bank}: ` : 'Acc: ';
            
            // Generate Paperclip icon if attachments exist
            const hasAttachments = item.attachments || item.Attachments;
            const attachmentPreview = hasAttachments ? `<span style="background:#e8f4fd; color:#0D6EFD; padding:2px 6px; border:1px solid #b6d4fe; border-radius:4px; font-size:10px; margin-left:6px;"><i class="fas fa-paperclip"></i></span>` : '';
            
            return `
              <div class="card" onclick="openRecordRow('payment', '${item.paymentId || item.PaymentId}')">
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:4px;">
                  <div>
                    <strong style="font-size:18px;">${item.party || 'No Party Listed'}</strong><br>
                    <small style="color:var(--muted); font-weight:700;">ID: ${item.paymentId || item.PaymentId || ''} | ${bankPreview}${(item.account || item.Account) ? String(item.account || item.Account).padStart(10, '0') : 'N/A'}</small>
                  </div>
                  <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
                    <div style="text-align:right;">
                      <span style="font-size:20px; font-weight:900; color:${color};">${sign}₦${formatMoney(item.amount)}</span><br>
                      <small style="font-size:11px; font-weight:700; color:var(--muted);">${formatDateForDisplay(item.date)}</small>
                    </div>
                    <button onclick="event.stopPropagation(); printSinglePaymentDirect('${item.paymentId || item.PaymentId}')" style="background:var(--primary); color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer; text-transform:uppercase;">
                      <i class="fas fa-print"></i> Print
                    </button>
                  </div>
                </div>
                <div style="font-size:15px; font-weight:800; color:${color};">${item.direction || 'INFLOW'} &bull; ${item.type || 'General Record'} ${linkPreview} ${attachmentPreview}</div>
                ${reasonPreview}
              </div>`;
          }
          else if (p === 'inventory') {
            return `
              <div class="card" onclick="openRecordRow('inventory', '${item.itemId || item.ItemId}')">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div><strong style="font-size:20px;">Unit ${unitId}</strong><br><small style="color:var(--muted); font-weight:700;">ID: ${item.itemId || item.ItemId || ''} [${item.category || item.Category || 'General'}]</small></div>
                  <div style="text-align:right;"><span style="font-size:22px; font-weight:900; color:var(--primary);">${item.qty || item.Qty || 0}</span><br><small style="font-weight:800; font-size:10px; color:var(--muted)">UNITS</small></div>
                </div>
              </div>`;
          }
          else if (p === 'assets') {
            const nextDateStr = item.nextService || item.NextService || '';
            let isOverdue = false;
            const nextServiceDate = parseToLocalDateObject(nextDateStr);
            if (nextServiceDate) {
              isOverdue = nextServiceDate <= new Date().setHours(0,0,0,0);
            }
            return `
              <div class="card" onclick="openRecordRow('asset', '${item.tag || item.Tag}')" style="${isOverdue ? 'border-left: 6px solid var(--danger);' : ''}">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                  <div><strong style="font-size:20px;">Unit ${unitId}</strong><br><span style="font-weight:800; color:var(--primary);">${item.type || item.Type || ''}</span></div>
                  <span style="padding:4px 10px; border:2px solid #000; border-radius:6px; font-size:12px; font-weight:900; background:#000; color:#fff;">${String(item.status || 'OPERATIONAL').toUpperCase()}</span>
                </div>
                <div style="font-size:14px; font-weight:700; margin-top:4px;">Tag Parameter: ${item.tag || item.Tag || ''}</div>
                <div style="font-size:13px; font-weight:700; margin-top:2px; color:${isOverdue ? 'var(--danger)' : 'var(--muted)'};">Next PM Check: ${formatDateForDisplay(nextDateStr)}</div>
              </div>`;
          }
          else if (p === 'staff') {
            return `
              <div class="card" onclick="openRecordRow('staff', '${item.rowId || item.RowId}')">
                <div style="display:flex; gap:12px; align-items:center;">
                  <img src="${getDirectImageUrl(item.passport || item.Passport) || 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 width=%2240%22 height=%2240%22><path d=%22M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z%22 fill=%22%23ccc%22/></svg>'}" style="width:60px; height:60px; object-fit:cover; border-radius:50%; border:2px solid #000;">
                  <div style="flex:1;"><strong style="font-size:18px;">${item.name || item.Name || ''}</strong><br><span style="font-weight:700; color:var(--muted); font-size:13px;">ID: ${item.rowId || item.RowId || ''}</span><br><span style="font-weight:700; color:var(--primary); font-size:14px;">${item.role || item.Role || ''}</span></div>
                </div>
              </div>`;
          }
          else if (p === 'vendors') {
            return `
              <div class="card" onclick="openRecordRow('vendor', '${item.rowId || item.RowId || ''}')">
                <div style="display:flex; gap:12px; align-items:center;">
                  <div style="flex:1;">
                    <strong style="font-size:18px;">${item.company || item.Company || 'Unnamed Corporate Vendor'}</strong><br>
                    <span style="font-weight:700; color:var(--muted); font-size:13px;">ID: ${item.rowId || item.RowId || ''}</span><br>
                    <span style="font-weight:700; color:var(--success); font-size:14px;">${String(item.trade || item.Trade || '').toUpperCase()}</span>
                  </div>
                </div>
              </div>`;
          }
          else if (p === 'utilities') {
            const isPlant = item.type === 'Plant Check' || String(unitId).includes('GENERATOR') || unitId === 'DIESEL-TANK';
            const itemType = isPlant ? 'generator' : 'utility';
            const lookupId = item.rowId || item.id || idx;
            return `
              <div class="card" onclick="openRecordRow('${itemType}', '${lookupId}')" style="border-left: 6px solid ${isPlant ? '#fd7e14' : 'var(--primary)'}; cursor: pointer;">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                  <div><strong>${unitId}</strong><br><span style="font-size:12px; font-weight:800; color:var(--muted);">${String(item.type || '').toUpperCase()}</span></div>
                  <span style="padding:4px 10px; font-weight:900; background:#000; color:#fff; border-radius:6px; font-size:14px;">${item.reading || item.Reading || 0}</span>
                </div>
              </div>`;
          }
          else {
            return `
              <div class="card" onclick="openRecordRow('apartment', '${unitId}')">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div><strong style="font-size:22px;">Unit ${unitId}</strong><br><span style="font-weight:600; color:var(--muted);">${item.tenant || item.Tenant || 'Vacant Infrastructure'}</span></div>
                  <span style="padding:4px 10px; border:2px solid #000; border-radius:6px; font-size:12px; font-weight:900; background:${String(item.status || '') === 'Occupied' ? 'var(--success)' : String(item.status || '') === 'Common Area' ? 'var(--primary)' : 'var(--danger)'}; color:#fff;">${item.status || item.Status || 'Vacant'}</span>
                </div>
              </div>`;
          }
        }).join('');
      });
    }

    function renderArchiveBinDashboardView(targetContainerElement) {
      let archiveBundleHTML = "";
      const selectedFilterSegment = document.getElementById('archive-segment-filter') ? document.getElementById('archive-segment-filter').value : 'ALL';
      
      const archivedAssets = cache.assets.filter(a => a && (String(a.status || a.Status || '') === 'Archived' || String(a.archived || a.Archived || '') === 'Yes'));
      const archivedStaff = cache.staff.filter(s => s && String(s.archived || s.Archived || '') === 'Yes');
      const archivedVendors = cache.vendors.filter(v => v && String(v.archived || v.Archived || '') === 'Yes');
      const archivedInventory = cache.inventory.filter(i => i && String(i.archived || i.Archived || '') === 'Yes');

      if (selectedFilterSegment === 'ALL' || selectedFilterSegment === 'assets') {
        archivedAssets.forEach(a => { archiveBundleHTML += `<div class="card" style="border-left:5px solid var(--danger)"><strong>[ASSET ARCHIVE] ${a.type || 'Asset'}</strong><br><small>Tag Ref ID: ${a.tag || a.Tag} | Location: Unit ${getUnitNumber(a)}</small></div>`; });
      }
      if (selectedFilterSegment === 'ALL' || selectedFilterSegment === 'inventory') {
        archivedInventory.forEach(i => { archiveBundleHTML += `<div class="card" style="border-left:5px solid #ffc107"><strong>[INVENTORY ARCHIVE] ${i.name || i.Name || ''}</strong><br><small>Category: ${i.category || i.Category} | Qty: ${i.qty || i.Qty} | ID: ${i.itemId || i.ItemId}</small></div>`; });
      }
      if (selectedFilterSegment === 'ALL' || selectedFilterSegment === 'staff') {
        archivedStaff.forEach(s => { archiveBundleHTML += `<div class="card" style="border-left:5px solid var(--primary)"><strong>[STAFF ARCHIVE] ${s.name || s.Name || ''}</strong><br><small>Role: ${s.role || s.Role} | Staff ID: ${s.rowId || s.RowId}</small></div>`; });
      }
      if (selectedFilterSegment === 'ALL' || selectedFilterSegment === 'vendors') {
        archivedVendors.forEach(v => { archiveBundleHTML += `<div class="card" style="border-left:5px solid var(--success)"><strong>[VENDOR ARCHIVE] ${v.company || v.Company || ''}</strong><br><small>Trade Field: ${v.trade || v.Trade} | Vendor ID: ${v.rowId || v.RowId}</small></div>`; });
      }

      if(!archiveBundleHTML) {
        targetContainerElement.innerHTML = `<p style="text-align:center; padding:30px; font-weight:700; color:var(--muted)">No archived items match this selection profile.</p>`;
        return;
      }
      targetContainerElement.innerHTML = archiveBundleHTML;
    }

    function populateModalInlineImageGalleryPreviews(renderBoxId) {
      const box = document.getElementById(renderBoxId); if(!box) return;
      if(currentModalFiles.length === 0) { box.innerHTML = ''; box.style.display = 'none'; return; }
      box.style.display = 'flex';
      box.innerHTML = currentModalFiles.map((url, idx) => {
        const isPdf = url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('pdf_');
        let content = isPdf 
          ? `<div style="width:100%; height:100%; border:2px solid var(--text); border-radius:6px; background:#fff; display:flex; align-items:center; justify-content:center;"><i class="fas fa-file-pdf" style="font-size:24px; color:var(--danger);"></i></div>`
          : `<img src="${getDirectImageUrl(url)}" style="width:100%; height:100%; object-fit:cover; border:2px solid var(--text); border-radius:6px; margin:0;">`;
        
        return `
          <div style="position: relative; width: 60px; height: 60px; flex-shrink: 0;">
            ${content}
            <div onclick="removeAttachmentByIndex(${idx}, '${renderBoxId}')" style="position: absolute; top: -6px; right: -6px; background: var(--danger); color: white; border: 2px solid white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.3); z-index: 10;">&times;</div>
          </div>
        `;
      }).join('');
    }

    function removeAttachmentByIndex(index, renderBoxId) {
      currentModalFiles.splice(index, 1);
      populateModalInlineImageGalleryPreviews(renderBoxId);
    }

    function clearAvatarPhotoFrame() {
      currentAvatarPhoto = "";
      document.getElementById('passport_frame_view').src = 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 width=%2250%22 height=%2250%22><path d=%22M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z%22 fill=%22%236c757d%22/></svg>';
      if(document.getElementById('p_avatar_remove_btn')) document.getElementById('p_avatar_remove_btn').style.display = 'none';
    }

    function processIncomingMultiAttachments(filesList, previewTargetId) {
      if(!filesList || filesList.length === 0) return;
      Array.from(filesList).forEach(file => {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        
        if (isPdf) {
          if (file.size > 500 * 1024) {
            alert(`Boundary Warning: "${file.name}" exceeds limits (PDF limit is 500KB). Skipped.`);
            return;
          }
          const reader = new FileReader();
          reader.onload = (evt) => {
            const generatedName = "pdf_" + Date.now() + "_" + file.name.replace(/[^a-zA-Z0-9.]/g, "_");
            callApi('uploadImage', { base64: evt.target.result, name: generatedName }).then(res => {
              if(res && res.url) {
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
              base64StringData = await compressImageToTargetLimit(evt.target.result, 185000);
            }
            const generatedName = "img_" + Date.now() + "_" + file.name.replace(/[^a-zA-Z0-9.]/g, "_");
            callApi('uploadImage', { base64: base64StringData, name: generatedName }).then(res => {
              if(res && res.url) {
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
      const body = document.getElementById('modalBody'); const submit = document.getElementById('modalSubmit');
      const title = document.getElementById('modalTitle'); const overlay = document.getElementById('modalOverlay');
      const isEdit = !!editData; overlay.style.display = 'flex'; body.innerHTML = ''; submit.disabled = false; submit.style.display = 'block';
      submit.innerText = isEdit ? "Update" : "Save";
      
      const largeInput = 'style="font-size: 19px; padding: 12px; margin-bottom: 6px;"';
      const labelStyle = 'style="font-size: 15px; color: var(--text); font-weight:800; display: block; margin-top: 8px; margin-bottom: 2px;"';
      
      currentModalFiles = [];
      currentAvatarPhoto = "";
      currentSelectedRecord = editData; // SET ACTIVE RECORD FOR SHARING
      
      if (type === 'expenserequest') {
        const uniqueId = isEdit ? (editData.reqId || editData.ReqId) : generateNextId('EXR', cache.expenseRequests || [], 'reqId');
        title.innerText = isEdit ? "Update Expense Request" : "Draft Expense Request";
        if (isEdit && (editData.attachments || editData.Attachments)) currentModalFiles = (editData.attachments || editData.Attachments).split(',').filter(Boolean);
        
        body.innerHTML = `
          <label ${labelStyle}>Request ID</label><input type="text" value="${uniqueId}" disabled ${largeInput} style="background:#e9ecef; font-weight:900;">
          <label ${labelStyle}>Date Created</label><input id="er_date" type="date" value="${isEdit ? fromSheetDate(editData.date) : new Date().toISOString().split('T')[0]}" ${largeInput}>
          <label ${labelStyle}>Target Unit</label><select id="er_apt" ${largeInput}></select>
          <label ${labelStyle}>Asset Tag (Optional)</label><input id="er_asset" value="${isEdit ? (editData.assetTag || '') : ''}" placeholder="e.g. AST-12345" ${largeInput}>
          <label ${labelStyle}>Job Profile / Scope</label><textarea id="er_job" rows="3" placeholder="Multiline description..." ${largeInput}>${isEdit ? (editData.job || '') : ''}</textarea>
          <label ${labelStyle}>Estimated Cost (₦)</label><input id="er_cost" type="number" required placeholder="Amount (₦)" value="${isEdit ? (editData.cost || '') : ''}" ${largeInput}>
          
          <label ${labelStyle}>Supporting Attachments</label>
          <div id="erPreviews" class="modal-preview-grid" style="display:none;"></div>
          <label class="icon-upload-label"><i class="fas fa-paperclip"></i><input type="file" id="erCameraInput" accept="image/*,application/pdf" multiple style="display:none"></label>
        `;
        
        populateUnitDropdown('er_apt', isEdit ? getUnitNumber(editData) : '');
        if(isEdit && currentModalFiles.length > 0) populateModalInlineImageGalleryPreviews('erPreviews');
        document.getElementById('erCameraInput').onchange = (e) => { processIncomingMultiAttachments(e.target.files, 'erPreviews'); };
        
        submit.onclick = () => {
          if(!document.getElementById('er_cost').value) { alert("Estimated Cost is required."); return; }
          submit.disabled = true;
          callApi(isEdit ? 'updateExpenseRequest' : 'saveExpenseRequest', {
            reqId: uniqueId, 
            date: toSheetDate(document.getElementById('er_date').value), 
            apt: document.getElementById('er_apt').value,
            assetTag: document.getElementById('er_asset').value, 
            job: document.getElementById('er_job').value, 
            cost: document.getElementById('er_cost').value,
            attachments: currentModalFiles.join(',')
          }).then(() => { closeModal(); refreshData('expenserequests'); });
        };
    }
    else if (type === 'cashexpense') {
        const uniqueId = isEdit ? (editData.cashId || editData.CashId) : generateNextId('CSH', cache.cashExpenses || [], 'cashId');
        title.innerText = isEdit ? "Edit Cash Expense" : "Log Cash Expense";
        if (isEdit && (editData.attachments || editData.Attachments)) currentModalFiles = (editData.attachments || editData.Attachments).split(',').filter(Boolean);
        
        body.innerHTML = `
          <label ${labelStyle}>Cash ID</label><input type="text" value="${uniqueId}" disabled ${largeInput} style="background:#e9ecef; font-weight:900;">
          <label ${labelStyle}>Date</label><input id="ce_date" type="date" value="${isEdit ? fromSheetDate(editData.date) : new Date().toISOString().split('T')[0]}" ${largeInput}>
          <label ${labelStyle}>Target Unit</label><select id="ce_apt" ${largeInput}></select>
          <label ${labelStyle}>Amount (₦)</label><input id="ce_amount" type="number" required placeholder="Amount (₦)" value="${isEdit ? (editData.amount || '') : ''}" ${largeInput}>
          <label ${labelStyle}>Description / Notes</label><textarea id="ce_desc" rows="3" ${largeInput}>${isEdit ? (editData.description || '') : ''}</textarea>
          
          <label ${labelStyle}>Supporting Attachments</label>
          <div id="cePreviews" class="modal-preview-grid" style="display:none;"></div>
          <label class="icon-upload-label"><i class="fas fa-paperclip"></i><input type="file" id="ceCameraInput" accept="image/*,application/pdf" multiple style="display:none"></label>
        `;
        
        populateUnitDropdown('ce_apt', isEdit ? getUnitNumber(editData) : '');
        if(isEdit && currentModalFiles.length > 0) populateModalInlineImageGalleryPreviews('cePreviews');
        document.getElementById('ceCameraInput').onchange = (e) => { processIncomingMultiAttachments(e.target.files, 'cePreviews'); };

        submit.onclick = () => {
          if(!document.getElementById('ce_amount').value) { alert("Amount is required."); return; }
          submit.disabled = true;
          callApi(isEdit ? 'updateCashExpense' : 'saveCashExpense', {
            cashId: uniqueId, 
            date: toSheetDate(document.getElementById('ce_date').value), 
            apt: document.getElementById('ce_apt').value,
            amount: document.getElementById('ce_amount').value, 
            description: document.getElementById('ce_desc').value,
            attachments: currentModalFiles.join(',')
          }).then(() => { closeModal(); refreshData('cashexpenses'); });
        };
    }
      else if (type === 'apartment') {
        var currentUnit = getUnitNumber(editData);
        title.innerText = "Unit Profile: " + currentUnit;
        if (isEdit && (editData.photos || editData.Photos)) currentModalFiles = (editData.photos || editData.Photos).split(',').filter(Boolean);
        body.innerHTML = `
          <label ${labelStyle}>Tenant Name</label><input id="f_tenant" value="${editData.tenant || editData.Tenant || ''}" ${largeInput}>
          <label ${labelStyle}>Apartment Type</label><input id="f_type" value="${editData.type || editData.Type || 'Standard'}" disabled ${largeInput}>
          <label ${labelStyle}>Status State</label>
          <select id="f_status" ${largeInput}>
            <option value="Occupied" ${String(editData.status || editData.Status)==='Occupied'?'selected':''}>Occupied</option>
            <option value="Vacant" ${String(editData.status || editData.Status)==='Vacant'?'selected':''}>Vacant</option>
            <option value="Common Area" ${String(editData.status || editData.Status)==='Common Area'?'selected':''}>Common Area</option>
          </select>
          <label ${labelStyle}>Phone 1</label><input id="f_p1" type="tel" maxlength="11" oninput="this.value=this.value.replace(/[^0-9]/g,'')" value="${editData.phone1 || editData.Phone1 || ''}" ${largeInput}>
          <label ${labelStyle}>Phone 2</label><input id="f_p2" type="tel" maxlength="11" oninput="this.value=this.value.replace(/[^0-9]/g,'')" value="${editData.phone2 || editData.Phone2 || ''}" ${largeInput}>
          <label ${labelStyle}>Lease End</label><input id="f_lease" type="date" value="${fromSheetDate(editData.leaseEnd || editData.LeaseEnd)}" ${largeInput}>
          <label ${labelStyle}>Last Inspected</label><input id="f_inspected" type="date" value="${fromSheetDate(editData.inspected || editData.Inspected)}" ${largeInput}>
          <label ${labelStyle}>Notes</label><textarea id="f_notes" rows="2" ${largeInput}>${editData.notes || editData.Notes || ''}</textarea>
          
          <label ${labelStyle}>Form Attachments</label>
          <div id="aptPreviews" class="modal-preview-grid" style="display:none;"></div>
          <label class="icon-upload-label"><i class="fas fa-paperclip"></i><input type="file" id="cameraInput" accept="image/*,application/pdf" style="display:none"></label>`;
        
        if(isEdit && currentModalFiles.length > 0) populateModalInlineImageGalleryPreviews('aptPreviews');
        document.getElementById('cameraInput').onchange = (e) => { processIncomingMultiAttachments(e.target.files, 'aptPreviews'); };

        submit.onclick = () => {
          submit.disabled = true;
          callApi('updateApartment', { apt: currentUnit, tenant: document.getElementById('f_tenant').value, status: document.getElementById('f_status').value, phone1: String(document.getElementById('f_p1').value), phone2: String(document.getElementById('f_p2').value), leaseEnd: toSheetDate(document.getElementById('f_lease').value), inspected: toSheetDate(document.getElementById('f_inspected').value), notes: document.getElementById('f_notes').value, photos: currentModalFiles.join(','), type: editData.type || editData.Type || '', oldApt: currentUnit }).then(() => { closeModal(); refreshData('apartments'); });
        };
      }
      else if (type === 'asset') {
        const uniqueTag = isEdit ? (editData.tag || editData.Tag) : "AST-" + Math.random().toString(36).substr(2, 5).toUpperCase();
        
        title.innerText = isEdit ? "Update Asset" : "Register Facility Asset";
        if (isEdit && (editData.photos || editData.Photos)) currentModalFiles = (editData.photos || editData.Photos).split(',').filter(Boolean);
        
        let defaultInterval = "30";
        if (isEdit) {
          const lsNormalized = fromSheetDate(editData.lastServiced || editData.LastServiced || '');
          const nsNormalized = fromSheetDate(editData.nextService || editData.NextService || '');
          if (lsNormalized && nsNormalized) {
            const lsDate = new Date(lsNormalized);
            const nsDate = new Date(nsNormalized);
            const dTime = Math.abs(nsDate - lsDate);
            const dDays = Math.ceil(dTime / (1000 * 60 * 60 * 24));
            const optionsArr = [30, 60, 90, 120, 150, 180];
            const closest = optionsArr.reduce((prev, curr) => Math.abs(curr - dDays) < Math.abs(prev - dDays) ? curr : prev);
            defaultInterval = String(closest);
          }
        }

        body.innerHTML = `
          <label ${labelStyle}>Asset Tag (System ID)</label>
          <input type="text" value="${uniqueTag}" disabled ${largeInput} style="background: #e9ecef; font-weight: 900; color: #495057;">
          
          <label ${labelStyle}>Unit Connection Location</label><select id="a_apt" ${largeInput}></select>
          <label ${labelStyle}>Category Class Type</label><input id="a_type" value="${isEdit ? (editData.type || editData.Type) : ''}" ${largeInput}>
          <label ${labelStyle}>Asset Functional Status</label>
          <select id="a_status" ${largeInput}>
            <option value="Operational" ${isEdit&&String(editData.status || editData.Status)==='Operational'?'selected':''}>Operational</option>
            <option value="Faulty" ${isEdit&&String(editData.status || editData.Status)==='Faulty'?'selected':''}>Faulty</option>
            <option value="Under Repair" ${isEdit&&String(editData.status || editData.Status)==='Under Repair'?'selected':''}>Under Repair</option>
            <option value="Archived" ${isEdit&&String(editData.status || editData.Status)==='Archived'?'selected':''}>Archived</option>
          </select>
          <label ${labelStyle}>Specs Configuration Profile</label><input id="a_specs" value="${isEdit ? (editData.specs || editData.Specs) : ''}" ${largeInput}>
          <label ${labelStyle}>Internal Placement Area</label><input id="a_loc" value="${isEdit ? (editData.loc || editData.Loc) : ''}" ${largeInput}>
          <label ${labelStyle}>Last Serviced Date</label><input id="a_serviced" type="date" value="${isEdit ? fromSheetDate(editData.lastServiced || editData.LastServiced) : ''}" ${largeInput}>
          <label ${labelStyle}>Last Inspected Date</label><input id="a_inspected" type="date" value="${isEdit ? fromSheetDate(editData.lastInspected || editData.LastInspected) : ''}" ${largeInput}>
          
          <label ${labelStyle}>Next Scheduled PM Due in</label>
          <select id="a_nextServiceInterval" ${largeInput}>
            <option value="30" ${defaultInterval==='30'?'selected':''}>30 days</option>
            <option value="60" ${defaultInterval==='60'?'selected':''}>60 days</option>
            <option value="90" ${defaultInterval==='90'?'selected':''}>90 days</option>
            <option value="120" ${defaultInterval==='120'?'selected':''}>120 days</option>
            <option value="150" ${defaultInterval==='150'?'selected':''}>150 days</option>
            <option value="180" ${defaultInterval==='180'?'selected':''}>180 days</option>
          </select>

          <label ${labelStyle}>Notes</label><textarea id="a_notes" rows="2" ${largeInput}>${isEdit ? (editData.notes || editData.Notes) : ''}</textarea>
          
          <label ${labelStyle}>Form Attachments</label>
          <div id="assetPreviews" class="modal-preview-grid" style="display:none;"></div>
          <label class="icon-upload-label"><i class="fas fa-paperclip"></i><input type="file" id="assetCameraInput" accept="image/*,application/pdf" style="display:none"></label>`;
        
        populateUnitDropdown('a_apt', isEdit ? getUnitNumber(editData) : '');
        if(isEdit && currentModalFiles.length > 0) populateModalInlineImageGalleryPreviews('assetPreviews');
        document.getElementById('assetCameraInput').onchange = (e) => { processIncomingMultiAttachments(e.target.files, 'assetPreviews'); };

        submit.onclick = () => {
          submit.disabled = true;
          const lastServicedVal = document.getElementById('a_serviced').value;
          let calculatedNextServiceStr = "";
          
          if (lastServicedVal) {
            const [y, m, d] = lastServicedVal.split('-');
            const lastServicedDate = new Date(y, m - 1, d);
            const daysToAdd = parseInt(document.getElementById('a_nextServiceInterval').value, 10) || 30;
            lastServicedDate.setDate(lastServicedDate.getDate() + daysToAdd);
            const pad = (num) => String(num).padStart(2, '0');
            calculatedNextServiceStr = `${pad(lastServicedDate.getDate())}/${pad(lastServicedDate.getMonth() + 1)}/${lastServicedDate.getFullYear()}`;
          }

          callApi(isEdit?'updateAsset':'saveAsset', { 
            apt: document.getElementById('a_apt').value, 
            tag: uniqueTag, 
            type: document.getElementById('a_type').value, 
            status: document.getElementById('a_status').value, 
            specs: document.getElementById('a_specs').value, 
            loc: document.getElementById('a_loc').value, 
            lastServiced: toSheetDate(lastServicedVal), 
            lastInspected: toSheetDate(document.getElementById('a_inspected').value), 
            nextService: calculatedNextServiceStr, 
            notes: document.getElementById('a_notes').value, 
            photos: currentModalFiles.join(','), 
            archived: document.getElementById('a_status').value === "Archived" ? "Yes" : "No" 
          }).then(() => { closeModal(); refreshData('assets'); });
        };
      }
      else if (type === 'maintenance') {
        const uniqueTicket = isEdit ? (editData.ticketId || editData.TicketId) : generateNextId('TKT', cache.tickets, 'ticketId');
        title.innerText = isEdit ? "Update Ticket" : "Log Maintenance Issue";
        if (isEdit && (editData.photos || editData.Photos)) currentModalFiles = (editData.photos || editData.Photos).split(',').filter(Boolean);
        body.innerHTML = `
          <label ${labelStyle}>Ticket ID</label><input type="text" value="${uniqueTicket}" disabled ${largeInput} style="background:#e9ecef; font-weight:900;">
          <label ${labelStyle}>Property Target Unit Coordinate</label><select id="m_apt" ${largeInput}></select>
          <label ${labelStyle}>Issue Category</label><input id="m_category" value="${isEdit ? (editData.category || editData.Category) : ''}" ${largeInput}>
          <label ${labelStyle}>Priority Level</label>
          <select id="m_priority" ${largeInput}>
            <option value="Low" ${isEdit&&String(editData.priority || editData.Priority)==='Low'?'selected':''}>Low</option>
            <option value="Medium" ${isEdit&&String(editData.priority || editData.Priority)==='Medium'?'selected':''}>Medium</option>
            <option value="High" ${isEdit&&String(editData.priority || editData.Priority)==='High'?'selected':''}>High</option>
          </select>
          <label ${labelStyle}>Ticket Lifecycle Status</label>
          <select id="m_status" ${largeInput}>
            <option value="Open" ${isEdit&&String(editData.status || editData.Status)==='Open'?'selected':''}>Open</option>
            <option value="In Progress" ${isEdit&&String(editData.status || editData.Status)==='In Progress'?'selected':''}>In Progress</option>
            <option value="Resolved" ${isEdit&&String(editData.status || editData.Status)==='Resolved'?'selected':''}>Resolved</option>
          </select>
          <label ${labelStyle}>Assigned Responder Entity</label><select id="m_tech" ${largeInput}></select>
          <label ${labelStyle}>Problem Narrative Description</label><textarea id="m_desc" rows="3" ${largeInput}>${isEdit ? (editData.description || editData.Description) : ''}</textarea>
          
          <label ${labelStyle}>Form Attachments</label>
          <div id="maintPreviews" class="modal-preview-grid" style="display:none;"></div>
          <label class="icon-upload-label"><i class="fas fa-paperclip"></i><input type="file" id="maintCameraInput" accept="image/*,application/pdf" style="display:none"></label>`;

        populateUnitDropdown('m_apt', isEdit ? getUnitNumber(editData) : '');
        const tSel = document.getElementById('m_tech'); tSel.innerHTML = '<option value="">-- Unassigned Responder --</option>';
        (cache.staff || []).forEach(s => { const o=document.createElement('option'); o.value=`${s.name || s.Name} (${s.role || s.Role})`; o.innerText=`${s.name || s.Name} [Staff]`; if(isEdit&&(editData.tech || editData.Tech)===o.value) o.selected=true; tSel.appendChild(o); });
        (cache.vendors || []).forEach(v => { const o=document.createElement('option'); o.value=`${v.company || v.Company} (${v.trade || v.Trade})`; o.innerText=`${v.company || v.Company} [Vendor]`; if(isEdit&&(editData.tech || editData.Tech)===o.value) o.selected=true; tSel.appendChild(o); });
        
        if(isEdit && currentModalFiles.length > 0) populateModalInlineImageGalleryPreviews('maintPreviews');
        document.getElementById('maintCameraInput').onchange = (e) => { processIncomingMultiAttachments(e.target.files, 'maintPreviews'); };

        submit.onclick = () => {
          submit.disabled = true;
          callApi(isEdit?'updateMaintenance':'saveMaintenance', { ticketId: uniqueTicket, apt: document.getElementById('m_apt').value, category: document.getElementById('m_category').value, priority: document.getElementById('m_priority').value, status: document.getElementById('m_status').value, tech: tSel.value, description: document.getElementById('m_desc').value, photos: currentModalFiles.join(',') }).then(() => { closeModal(); refreshData('maintenance'); });
        };
      }
      else if (type === 'workorder') {
        const uniqueWO = isEdit ? (editData.workOrderId || editData.WorkOrderId) : generateNextId('WO', cache.workorders, 'workOrderId');
        title.innerText = isEdit ? "Work Order Portfolio" : "Log Work Order Expense";
        const isApproved = isEdit && String(editData.status || editData.Status) === "Approved";
        if (isEdit && (editData.attachments || editData.Attachments)) currentModalFiles = (editData.attachments || editData.Attachments).split(',').filter(Boolean);
        
        const communicationButtons = isEdit ? `
          <div style="margin-top:15px; margin-bottom:15px; border-top:2px solid var(--border); padding-top:15px; border-bottom:2px solid var(--border); padding-bottom:15px; display:flex; gap:10px;">
            <button type="button" onclick="printSingleWorkOrderDirect('${uniqueWO}', true)" style="flex:1; background:#0D6EFD; color:#fff; border:none; padding:12px; border-radius:8px; font-weight:800; cursor:pointer; font-size:12px; text-transform:uppercase; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
              <i class="fas fa-paperclip"></i> Full PDF
            </button>
            <button type="button" onclick="printSingleWorkOrderDirect('${uniqueWO}', false)" style="flex:1; background:#6c757d; color:#fff; border:none; padding:12px; border-radius:8px; font-weight:800; cursor:pointer; font-size:12px; text-transform:uppercase; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
              <i class="fas fa-file-alt"></i> Text Only
            </button>
          </div>
        ` : '';
        
        body.innerHTML = `
          <label ${labelStyle}>Work Order ID</label><input type="text" value="${uniqueWO}" disabled ${largeInput} style="background:#e9ecef; font-weight:900;">
          ${communicationButtons}
          <label ${labelStyle}>Date Logged</label><input id="w_date" type="date" value="${isEdit && (editData.date || editData.Date) ? fromSheetDate(editData.date || editData.Date) : new Date().toISOString().split('T')[0]}" ${largeInput} ${isApproved ? 'disabled' : ''}>
          <label ${labelStyle}>Unit Node</label><select id="w_apt" ${largeInput} ${isApproved ? 'disabled' : ''}></select>
          <label ${labelStyle}>Target Asset (Optional)</label><select id="w_asset" ${largeInput} ${isApproved ? 'disabled' : ''}><option value="">-- No Specific Asset --</option></select>
          <label ${labelStyle}>Assigned</label><select id="w_assigned" ${largeInput} ${isApproved ? 'disabled' : ''}></select>
          <label ${labelStyle}>Duration</label><input id="w_duration" type="text" value="${isEdit ? (editData.duration || editData.Duration || '') : ''}" placeholder="e.g. 3 Days, 1 Week" ${largeInput} ${isApproved ? 'disabled' : ''}>
          
          <label ${labelStyle}>Submitted Value (₦)</label><input id="w_submitted_val" type="number" placeholder="Initial proposed cost" value="${isEdit ? (editData.submittedValue || editData.SubmittedValue || '') : ''}" ${largeInput} ${isApproved ? 'disabled' : ''}>
          <label ${labelStyle}>Negotiated Value (₦)</label><input id="w_amount" type="number" required placeholder="Final agreed cost" value="${isEdit ? (editData.amount || editData.Amount || '') : ''}" ${largeInput} ${isApproved ? 'disabled' : ''}>
          
          <label ${labelStyle}>Authorization Status</label>
          <select id="w_status" ${largeInput} ${isApproved ? 'disabled' : ''}>
            <option value="Pending Approval" ${isEdit && String(editData.status || editData.Status)==='Pending Approval'?'selected':''}>Pending Approval</option>
            <option value="Approved" ${isEdit && String(editData.status || editData.Status)==='Approved'?'selected':''}>Approved</option>
            <option value="Declined" ${isEdit && String(editData.status || editData.Status)==='Declined'?'selected':''}>Declined</option>
          </select>
          <label ${labelStyle}>Scope / Narrative</label><textarea id="w_desc" rows="3" ${largeInput} ${isApproved ? 'disabled' : ''}>${isEdit ? (editData.description || editData.Description || '') : ''}</textarea>
          <label ${labelStyle}>Operational Remarks</label><textarea id="w_notes" rows="2" ${largeInput} ${isApproved ? 'disabled' : ''}>${isEdit ? (editData.notes || editData.Notes || '') : ''}</textarea>
          
          <label ${labelStyle}>Supporting Attachments</label>
          <div id="woPreviews" class="modal-preview-grid" style="display:none;"></div>
          <label class="icon-upload-label"><i class="fas fa-paperclip"></i><input type="file" id="woCameraInput" accept="image/*,application/pdf" multiple style="display:none" ${isApproved ? 'disabled' : ''}></label>
        `;       
        
        populateUnitDropdown('w_apt', isEdit ? getUnitNumber(editData) : '');
        
        const assetSel = document.getElementById('w_asset');
        const populateAssets = (unitNum) => {
            assetSel.innerHTML = '<option value="">-- No Specific Asset (Unit Level) --</option>';
            if (!unitNum) return;
            const related = cache.assets.filter(a => String(getUnitNumber(a)) === String(unitNum) && String(a.status || a.Status) !== 'Archived');
            related.forEach(a => {
                const o = document.createElement('option');
                o.value = a.tag || a.Tag;
                o.innerText = `${a.type || 'Asset'} (${a.tag || a.Tag})`;
                if (isEdit && String(editData.asset || editData.Asset) === String(o.value)) o.selected = true;
                assetSel.appendChild(o);
            });
        };
        setTimeout(() => populateAssets(isEdit ? getUnitNumber(editData) : ''), 100);
        document.getElementById('w_apt').addEventListener('change', (e) => populateAssets(e.target.value));

        const asSel = document.getElementById('w_assigned');
        asSel.innerHTML = '<option value="">-- Choose Participant --</option>';
        (cache.staff || []).forEach(s => { const o=document.createElement('option'); o.value=`${s.name || s.Name} (${s.role || s.Role})`; o.innerText=`${s.name || s.Name} [Staff]`; if(isEdit && (editData.assigned || editData.Assigned)===o.value) o.selected=true; asSel.appendChild(o); });
        (cache.vendors || []).forEach(v => { const o=document.createElement('option'); o.value=`${v.company || v.Company} (${v.trade || v.Trade})`; o.innerText=`${v.company || v.Company} [Vendor]`; if(isEdit && (editData.assigned || editData.Assigned)===o.value) o.selected=true; asSel.appendChild(o); });

        if(isEdit && currentModalFiles.length > 0) populateModalInlineImageGalleryPreviews('woPreviews');
        document.getElementById('woCameraInput').onchange = (e) => { processIncomingMultiAttachments(e.target.files, 'woPreviews'); };

        if (isApproved) { 
          submit.style.display = "none"; 
        } else {
          submit.onclick = () => {
            if(!document.getElementById('w_amount').value) { alert("Negotiated Value is required."); return; }
            submit.disabled = true;
            callApi(isEdit ? 'updateWorkOrder' : 'saveWorkOrder', { 
              workOrderId: uniqueWO, 
              date: toSheetDate(document.getElementById('w_date').value),
              apt: document.getElementById('w_apt').value, 
              asset: document.getElementById('w_asset').value,
              assigned: asSel.value,
              duration: document.getElementById('w_duration').value,
              submittedValue: document.getElementById('w_submitted_val').value, // Add new value to payload
              amount: document.getElementById('w_amount').value, 
              status: document.getElementById('w_status').value, 
              description: document.getElementById('w_desc').value, 
              notes: document.getElementById('w_notes').value,
              attachments: currentModalFiles.join(',') 
            }).then(() => { closeModal(); refreshData('workorders'); });
          };
        }
      }
      else if (type === 'payment') {
        const uniqueId = isEdit ? (editData.paymentId) : generateNextId('PAY', cache.payments, 'paymentId');
        title.innerText = isEdit ? "Edit Ledger Record" : "Log Financial Ledger";
        
        // 1. DETERMINE IF RECORD IS LOCKED
        const isAlreadyPaid = isEdit && (String(editData.isPaid).toUpperCase() === 'TRUE' || editData.isPaid === true);
        const disabledState = isAlreadyPaid ? 'disabled' : ''; // Applies to all inputs if locked

        if (isEdit && (editData.attachments || editData.Attachments)) {
            currentModalFiles = (editData.attachments || editData.Attachments).split(',').filter(Boolean);
        }

        let partyOpts = '';
        (cache.apts || []).forEach(a => { if(a.tenant && a.tenant.toLowerCase() !== 'services') partyOpts += `<option value="${a.tenant}">`; });
        (cache.staff || []).forEach(s => { if(s.name) partyOpts += `<option value="${s.name}">`; });
        (cache.vendors || []).forEach(v => { if(v.company) partyOpts += `<option value="${v.company}">`; });

        let inflowRefOpts = '<option value="">-- No Linked Unit --</option>';
        (cache.apts || []).forEach(a => {
            const uNum = getUnitNumber(a);
            if(uNum && String(a.type).toLowerCase() !== 'services') {
                const valStr = `Unit ${uNum}`;
                inflowRefOpts += `<option value="${valStr}" ${isEdit && editData.reference === valStr ? 'selected' : ''}>${valStr} - ${a.tenant || 'Vacant'}</option>`;
            }
        });

        let outflowRefOpts = '<option value="">-- No Linked Record --</option>';
        const approvedWOs = (cache.workorders || []).filter(w => String(w.status) === 'Approved');
        const expReqs = cache.expenseRequests || [];
        
        if (approvedWOs.length > 0) {
            outflowRefOpts += '<optgroup label="Approved Work Orders">';
            approvedWOs.forEach(w => {
                const wid = w.workOrderId || w.WorkOrderId;
                outflowRefOpts += `<option value="${wid}" ${isEdit && editData.reference===wid?'selected':''}>${wid} - ₦${formatMoney(w.amount)}</option>`;
            });
            outflowRefOpts += '</optgroup>';
        }
        if (expReqs.length > 0) {
            outflowRefOpts += '<optgroup label="Expense Requests">';
            expReqs.forEach(r => {
                outflowRefOpts += `<option value="${r.reqId}" ${isEdit && editData.reference===r.reqId?'selected':''}>${r.reqId} - ₦${formatMoney(r.cost)}</option>`;
            });
            outflowRefOpts += '</optgroup>';
        }
        if (approvedWOs.length === 0 && expReqs.length === 0) {
            outflowRefOpts += '<option disabled>⚠️ No Approved Records Available</option>';
        }

        body.innerHTML = `
          <label ${labelStyle}>Payment ID</label><input type="text" value="${uniqueId}" disabled ${largeInput} style="background:#e9ecef; font-weight:900;">
          <label ${labelStyle}>Transaction Direction</label>
          <select id="p_direction" ${largeInput} ${disabledState}>
            <option value="INFLOW" ${isEdit && editData.direction==='INFLOW'?'selected':''}>INFLOW (+ Receivables)</option>
            <option value="OUTFLOW" ${isEdit && editData.direction==='OUTFLOW'?'selected':''}>OUTFLOW (- Payables)</option>
          </select>
          
          <label ${labelStyle}>Party / Payer / Payee Name</label>
          <input list="party_list" id="p_party" value="${isEdit ? (editData.party || '') : ''}" placeholder="Type or select from list..." ${largeInput} ${disabledState}>
          <datalist id="party_list">${partyOpts}</datalist>
          
          <label ${labelStyle}>Bank Name</label>
          <input list="bank_list" id="p_bank" type="text" value="${isEdit ? (editData.bank || editData.Bank || '') : ''}" placeholder="e.g. GTBank, Zenith, Access" ${largeInput} ${disabledState}>
          <datalist id="bank_list">
            <option value="Access Bank"><option value="First Bank"><option value="GTBank"><option value="Kuda Bank"><option value="Moniepoint"><option value="Opay"><option value="UBA"><option value="Zenith Bank">
          </datalist>

          <label ${labelStyle}>Account Number (10 Digits)</label>
          <input id="p_account" type="text" inputmode="numeric" maxlength="10" oninput="this.value=this.value.replace(/[^0-9]/g,'')" value="${isEdit ? (editData.account || editData.Account || '') : ''}" placeholder="e.g. 0123456789" ${largeInput} ${disabledState}>
          
          <label ${labelStyle}>Linked Record</label>
          <select id="p_reference" ${largeInput} ${disabledState}></select>

          <label ${labelStyle}>Classification Note</label><input id="p_type" value="${isEdit ? (editData.type || '') : ''}" placeholder="e.g. Rent, Vendor Payment" ${largeInput} ${disabledState}>
          <label ${labelStyle}>Reason / Justification</label><textarea id="p_reason" rows="2" placeholder="Describe the transaction..." ${largeInput} ${disabledState}>${isEdit ? (editData.reason || '') : ''}</textarea>
          
          <div style="background:#f8f9fa; padding:15px; border-radius:8px; border:1px solid #dee2e6; margin:15px 0;">
            <h4 style="margin-top:0; margin-bottom:10px; font-size:13px; color:#6c757d; text-transform:uppercase; letter-spacing:0.5px;">Contract Financials</h4>
            
            <label ${labelStyle}>Total Job Value (₦)</label>
            <input id="p_total_job" type="number" value="${isEdit ? (editData.totalJobValue || editData.TotalJobValue || '') : ''}" placeholder="e.g. 500000" ${largeInput} ${disabledState}>
            
            <label ${labelStyle}>Paid to Date (₦)</label>
            <input id="p_paid_todate" type="number" value="${isEdit ? (editData.paidToDate || editData.PaidToDate || '') : ''}" placeholder="Amount already paid" ${largeInput} ${disabledState}>
            
            <label ${labelStyle}>Amount to Pay (₦)</label>
            <input id="p_amount" type="number" required value="${isEdit ? (editData.amount || '') : ''}" placeholder="Current payment amount" ${largeInput} style="border-color:var(--primary); border-width:3px;" ${disabledState}>
            
            <label ${labelStyle}>Balance Due (₦)</label>
            <input id="p_balance_due" type="number" value="${isEdit ? (editData.balanceDue || editData.BalanceDue || '') : ''}" placeholder="Remaining balance" ${largeInput} ${disabledState}>
          </div>

          <label ${labelStyle}>Date</label><input id="p_date" type="date" value="${isEdit ? fromSheetDate(editData.date) : new Date().toISOString().split('T')[0]}" ${largeInput} ${disabledState}>
          
          <div style="margin-top: 15px; padding: 12px; border: 2px solid ${isAlreadyPaid ? '#198754' : '#DEE2E6'}; border-radius: 12px; background: ${isAlreadyPaid ? '#E8F5E9' : '#F8F9FA'};">
            <label style="display: flex; align-items: center; gap: 10px; margin: 0; cursor: pointer;">
              <input type="checkbox" id="p_is_paid" style="width: 24px; height: 24px; margin: 0;" 
                     ${isAlreadyPaid ? 'checked disabled' : ''}>
              <span style="color: ${isAlreadyPaid ? '#198754' : '#212529'}; font-weight: 900; font-size: 16px;">
                 ${isAlreadyPaid ? '<i class="fas fa-lock"></i> STATUS: PAID & LOCKED' : 'MARK AS PAID / CLEARED'}
              </span>
            </label>
            ${isAlreadyPaid ? '<p style="margin: 4px 0 0 0; font-size: 12px; color: #198754;">This ledger record has been settled and cannot be modified.</p>' : ''}
          </div>

          <label ${labelStyle} style="margin-top:15px;">Supporting Attachments</label>
          <div id="paymentPreviews" class="modal-preview-grid" style="${currentModalFiles.length > 0 ? '' : 'display:none;'}"></div>
          
          ${isAlreadyPaid ? '' : `<label class="icon-upload-label"><i class="fas fa-paperclip"></i><input type="file" id="p_multi_uploader" accept="image/*,application/pdf" multiple style="display:none"></label>`}
        `;
        
        // 3. HIDE THE SAVE BUTTON IF LOCKED
        if (isAlreadyPaid) {
            submit.style.display = 'none';
        } else {
            submit.style.display = 'block';
        }

        const pDir = document.getElementById('p_direction');
        const pRef = document.getElementById('p_reference');
        
        const updateRefDropdown = () => { pRef.innerHTML = pDir.value === 'INFLOW' ? inflowRefOpts : outflowRefOpts; };
        pDir.addEventListener('change', updateRefDropdown);
        updateRefDropdown(); 
        
        // Auto-fill account details when a Staff or Vendor is selected
        document.getElementById('p_party').addEventListener('change', (e) => {
            const selectedParty = e.target.value.trim();
            if (!selectedParty) return;

            const vendorMatch = cache.vendors.find(v => (v.company || v.Company) === selectedParty);
            if (vendorMatch && (vendorMatch.account || vendorMatch.Account)) {
                document.getElementById('p_bank').value = vendorMatch.bank || vendorMatch.Bank || '';
                document.getElementById('p_account').value = vendorMatch.account || vendorMatch.Account || '';
                return;
            }

            const staffMatch = cache.staff.find(s => (s.name || s.Name) === selectedParty);
            if (staffMatch && (staffMatch.account || staffMatch.Account)) {
                document.getElementById('p_bank').value = staffMatch.bank || staffMatch.Bank || '';
                document.getElementById('p_account').value = staffMatch.account || staffMatch.Account || '';
                return;
            }
        });

        // Auto-Calculate Balance Due UX
        const calcBalance = () => {
            const tjv = parseFloat(document.getElementById('p_total_job').value) || 0;
            const ptd = parseFloat(document.getElementById('p_paid_todate').value) || 0;
            const amt = parseFloat(document.getElementById('p_amount').value) || 0;
            if (tjv > 0) document.getElementById('p_balance_due').value = (tjv - ptd - amt);
        };
        ['p_total_job', 'p_paid_todate', 'p_amount'].forEach(id => {
            document.getElementById(id).addEventListener('input', calcBalance);
        });

        if(isEdit && currentModalFiles.length > 0) populateModalInlineImageGalleryPreviews('paymentPreviews');
        
        const uploader = document.getElementById('p_multi_uploader');
        if (uploader) {
            uploader.onchange = (e) => { processIncomingMultiAttachments(e.target.files, 'paymentPreviews'); };
        }

        submit.onclick = () => {
          if(!document.getElementById('p_amount').value) { alert("Amount to Pay is required."); return; }
          
          let accVal = document.getElementById('p_account').value;
          if (accVal) accVal = String(accVal).padStart(10, '0');
          if (accVal && accVal.length !== 10) { alert("Account Number must be exactly 10 digits."); return; }
          
          submit.disabled = true;
          submit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; 

          callApi(isEdit ? 'updatePayment' : 'savePayment', {
            paymentId: uniqueId, 
            direction: document.getElementById('p_direction').value, 
            party: document.getElementById('p_party').value,
            bank: document.getElementById('p_bank').value,
            account: accVal,
            reference: document.getElementById('p_reference').value,
            type: document.getElementById('p_type').value, 
            reason: document.getElementById('p_reason').value,
            totalJobValue: document.getElementById('p_total_job').value,
            paidToDate: document.getElementById('p_paid_todate').value,
            amount: document.getElementById('p_amount').value, 
            balanceDue: document.getElementById('p_balance_due').value,
            date: toSheetDate(document.getElementById('p_date').value),
            isPaid: document.getElementById('p_is_paid').checked, // 4. SEND PAID STATUS
            attachments: currentModalFiles.join(',')
          }).then(() => { closeModal(); refreshData('payments'); })
            .catch(() => { submit.disabled = false; submit.innerHTML = isEdit ? "Update" : "Save"; });
        };
      }
          
      else if (type === 'inventory') {
        const uniqueItem = isEdit ? (editData.itemId || editData.ItemId) : generateNextId('INV', cache.inventory, 'itemId');
        title.innerText = isEdit ? "Edit Stock Ledger Item" : "Register New Inventory Item";
        body.innerHTML = `
          <label ${labelStyle}>Item Identity Code</label><input id="i_id" value="${uniqueItem}" disabled ${largeInput}>
          <label ${labelStyle}>Material Item / Resource Name</label><input id="i_name" value="${isEdit ? (editData.name || editData.Name) : ''}" placeholder="e.g. Led Bulb 18W" ${largeInput}>
          <label ${labelStyle}>Resource Stock Quantity</label><input id="i_qty" type="number" value="${isEdit ? (editData.qty || editData.Qty) : '0'}" ${largeInput}>
          <label ${labelStyle}>Material Category Classification</label><input id="i_category" value="${isEdit ? (editData.category || editData.Category) : ''}" placeholder="e.g. Electrical" ${largeInput}>
          <label ${labelStyle}>Restock Minimum Alert Threshold</label><input id="i_min" type="number" value="${isEdit ? (editData.minAlert || editData.MinAlert) : '5'}" ${largeInput}>
          <label ${labelStyle}>Warehouse Location Placement Notes</label><textarea id="i_notes" rows="2" ${largeInput}>${isEdit ? (editData.notes || editData.Notes) : ''}</textarea>
          
          <label ${labelStyle}>Archive Profile State</label>
          <select id="i_archived" ${largeInput}>
            <option value="No" ${isEdit && String(editData.archived || editData.Archived) === 'Yes' ? '' : 'selected'}>Active Asset Track</option>
            <option value="Yes" ${isEdit && String(editData.archived || editData.Archived) === 'Yes' ? 'selected' : ''}>Archived / Pinned Out</option>
          </select>`;
        
        submit.onclick = () => {
          submit.disabled = true;
          callApi(isEdit ? 'updateInventory' : 'saveInventory', { itemId: uniqueItem, name: document.getElementById('i_name').value, qty: document.getElementById('i_qty').value, category: document.getElementById('i_category').value, minAlert: document.getElementById('i_min').value, notes: document.getElementById('i_notes').value, archived: document.getElementById('i_archived').value }).then(() => { closeModal(); refreshData('inventory'); });
        };
      }
      else if (type === 'utility') {
        title.innerText = isEdit ? "Update Utility Data" : "Record Utility Data";
        body.innerHTML = `
          <label ${labelStyle}>Select Asset Unit</label><select id="u_apt" ${largeInput}></select>
          <label ${labelStyle}>Utility Profile Class</label>
          <select id="u_type" ${largeInput}>
            <option value="Electricity" ${isEdit && String(editData.type)==='Electricity'?'selected':''}>Electricity Meter</option>
            <option value="Water" ${isEdit && String(editData.type)==='Water'?'selected':''}>Water Gauge</option>
          </select>
          <label ${labelStyle}>Meter Box Serial No</label><input id="u_meter" value="${isEdit ? (editData.meterNo || '') : ''}" disabled ${largeInput}>
          <label ${labelStyle}>Consumption Meter Reading</label><input id="u_reading" type="number" value="${isEdit ? (editData.reading || '') : ''}" ${largeInput}>
          <label ${labelStyle}>Token Purchase Cost (₦)</label><input id="u_amount" type="number" value="${isEdit ? (editData.amount || editData.Amount || '') : ''}" ${largeInput}>
          <label ${labelStyle}>Log Notes</label><textarea id="u_notes" rows="2" ${largeInput}>${isEdit ? (editData.notes || '') : ''}</textarea>`;
        
        populateUnitDropdown('u_apt', isEdit ? getUnitNumber(editData) : '');
        submit.onclick = () => {
          submit.disabled = true;
          callApi(isEdit ? 'updateUtility' : 'saveUtility', { 
            rowId: isEdit ? (editData.rowId || editData.id || '') : '',
            apt: document.getElementById('u_apt').value, 
            type: document.getElementById('u_type').value, 
            meterNo: document.getElementById('u_meter').value, 
            reading: document.getElementById('u_reading').value, 
            amount: document.getElementById('u_amount').value, 
            notes: document.getElementById('u_notes').value, 
            photos: isEdit ? (editData.photos || '') : '' 
          }).then(() => { closeModal(); refreshData('utilities'); });
        };
      }
      else if (type === 'generator') {
        title.innerText = isEdit ? "Update Plant Status" : "Log Plant Status";
        body.innerHTML = `
          <label ${labelStyle}>Select Heavy Plant Machine</label>
          <select id="g_equipment" ${largeInput}>
            <option value="GENERATOR-1" ${isEdit && String(editData.apt || editData.Apt)==='GENERATOR-1'?'selected':''}>Generator 1 (Main)</option>
            <option value="GENERATOR-2" ${isEdit && String(editData.apt || editData.Apt)==='GENERATOR-2'?'selected':''}>Generator 2 (Backup)</option>
            <option value="DIESEL-TANK" ${isEdit && String(editData.apt || editData.Apt)==='DIESEL-TANK'?'selected':''}>Bulk Diesel Fuel Reservoir</option>
          </select>
          <label ${labelStyle}>S/N</label><input id="g_sn" value="${isEdit ? (editData.sn || editData.SN || '') : ''}" disabled ${largeInput}>
          <label ${labelStyle}>Engine Run Hours Meter</label><input id="g_reading" type="number" step="0.1" value="${isEdit ? (editData.reading || '') : ''}" ${largeInput}>
          <label ${labelStyle}>Tank Current Storage Capacity Level</label>
          <select id="g_tank" ${largeInput}>
            <option value="Tank Level: Full (100%)" ${isEdit && String(editData.meterNo)==='Tank Level: Full (100%)'?'selected':''}>Full (100%)</option>
            <option value="Tank Level: Half Full (50%)" ${isEdit && String(editData.meterNo)==='Tank Level: Half Full (50%)'?'selected':''}>Half Full (50%)</option>
            <option value="Tank Level: Critical (10%)" ${isEdit && String(editData.meterNo)==='Tank Level: Critical (10%)'?'selected':''}>Critical Threshold (10%)</option>
          </select>
          <label ${labelStyle}>Diesel Liters Added</label><input id="g_added" type="number" value="${isEdit ? (editData.amount || editData.Amount || '') : ''}" ${largeInput}>
          <label ${labelStyle}>Field Observations Remark</label><textarea id="g_notes" rows="2" ${largeInput}>${isEdit ? (editData.notes || '') : ''}</textarea>`;

        setTimeout(() => {
          const updatePlantSN = () => {
            const eq = document.getElementById('g_equipment').value;
            const snInput = document.getElementById('g_sn');
            if (!snInput) return;
            if (isEdit && editData.sn) { snInput.value = editData.sn; return; }
            if (eq === 'GENERATOR-1') snInput.value = 'SN-G1-MAIN-101';
            else if (eq === 'GENERATOR-2') snInput.value = 'SN-G2-STBY-202';
            else if (eq === 'DIESEL-TANK') snInput.value = 'SN-DT-BULK-303';
          };
          document.getElementById('g_equipment').addEventListener('change', updatePlantSN);
          updatePlantSN();
        }, 0);

        submit.onclick = () => {
          submit.disabled = true;
          callApi(isEdit ? 'updateUtility' : 'saveUtility', { 
            rowId: isEdit ? (editData.rowId || editData.id || '') : '',
            apt: document.getElementById('g_equipment').value, 
            type: "Plant Check", 
            meterNo: document.getElementById('g_tank').value, 
            reading: document.getElementById('g_reading').value, 
            amount: document.getElementById('g_added').value || 0, 
            notes: document.getElementById('g_notes').value, 
            photos: isEdit ? (editData.photos || '') : '',
            sn: document.getElementById('g_sn').value
          }).then(() => { closeModal(); refreshData('utilities'); });
        };
      }
      else if (type === 'staff') {
        const uniqueId = isEdit ? (editData.rowId || editData.RowId) : generateNextId('STF', cache.staff, 'rowId');
        title.innerText = "Staff Profile Management";
        currentAvatarPhoto = isEdit ? (editData.passport || editData.Passport) : "";
        if (isEdit && (editData.attachments || editData.Attachments)) currentModalFiles = (editData.attachments || editData.Attachments).split(',').filter(Boolean);

        body.innerHTML = `
          <div class="passport-frame-container" style="position:relative;">
            <img id="passport_frame_view" src="${currentAvatarPhoto ? getDirectImageUrl(currentAvatarPhoto) : 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 width=%2260%22 height=%2260%22><path d=%22M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z%22 fill=%22%236c757d%22/></svg>'}" style="width:100%; height:100%; object-fit:cover;">
            <label style="position:absolute; bottom:2px; right:2px; background:var(--primary); color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #fff; cursor:pointer;">
              <i class="fas fa-camera" style="font-size:12px;"></i>
              <input type="file" id="st_pass_uploader" accept="image/*" capture="environment" style="display:none">
            </label>
            <div id="p_avatar_remove_btn" onclick="clearAvatarPhotoFrame()" style="position:absolute; top:2px; right:2px; background:var(--danger); color:white; border:2px solid white; border-radius:50%; width:22px; height:22px; display:${currentAvatarPhoto?'flex':'none'}; align-items:center; justify-content:center; font-size:12px; font-weight:900; cursor:pointer; z-index:15;">&times;</div>
          </div>

          <label ${labelStyle}>Staff ID</label><input id="st_id" value="${uniqueId}" ${largeInput} ${isEdit?'disabled':''}>
          <label ${labelStyle}>Employee Full Name</label><input id="st_name" value="${isEdit ? (editData.name || editData.Name) : ''}" ${largeInput}>
          <label ${labelStyle}>Contact Address</label><input id="st_address" value="${isEdit ? (editData.address || editData.Address || '') : ''}" ${largeInput}>
          <label ${labelStyle}>Core Specialization / Role</label><input id="st_role" value="${isEdit ? (editData.role || editData.Role) : ''}" ${largeInput}>
          <label ${labelStyle}>Phone 1</label><input id="st_p1" type="tel" maxlength="11" inputmode="numeric" oninput="this.value=this.value.replace(/[^0-9]/g,'')" value="${isEdit?(editData.phone1 || editData.Phone1 || ''):''}" ${largeInput}>
          <label ${labelStyle}>Phone 2</label><input id="st_p2" type="tel" maxlength="11" inputmode="numeric" oninput="this.value=this.value.replace(/[^0-9]/g,'')" value="${isEdit?(editData.phone2 || editData.Phone2 || ''):''}" ${largeInput}>
          <label ${labelStyle}>Staff Email Address</label><input id="st_email" type="email" value="${isEdit?(editData.email || editData.Email || ''):''}" ${largeInput}>
          <label ${labelStyle}>Bank Name</label>
          <input list="bank_list" id="st_bank" value="${isEdit?(editData.bank || editData.Bank || ''):''}" placeholder="e.g. GTBank" ${largeInput}>
          <label ${labelStyle}>Account Number</label>
          <input id="st_account" type="text" inputmode="numeric" maxlength="10" oninput="this.value=this.value.replace(/[^0-9]/g,'')" value="${isEdit?(editData.account || editData.Account || ''):''}" placeholder="10 Digit Account Number" ${largeInput}>
          
          <label ${labelStyle}>Profile Archive Lifecycle Deployment State</label>
          <select id="st_archived" ${largeInput}>
            <option value="No" ${isEdit && String(editData.archived || editData.Archived) === 'No' ? 'selected' : ''}>Active Member</option>
            <option value="Yes" ${isEdit && String(editData.archived || editData.Archived) === 'Yes' ? 'selected' : ''}>Archived / Deactivated Account</option>
          </select>

          <label ${labelStyle}>Form Attachments</label>
          <div id="stAttachmentsPreviews" class="modal-preview-grid" style="display:none;"></div>
          <label class="icon-upload-label"><i class="fas fa-paperclip"></i><input type="file" id="st_multi_uploader" accept="image/*,application/pdf" multiple style="display:none"></label>`;

        if(isEdit && currentModalFiles.length > 0) populateModalInlineImageGalleryPreviews('stAttachmentsPreviews');

        document.getElementById('st_pass_uploader').onchange = (e) => {
          const file = e.target.files[0]; if(!file) return;
          const r = new FileReader(); r.onload = async (evt) => {
            let comp = evt.target.result;
            if (file.size > 200 * 1024) {
              comp = await compressImageToTargetLimit(evt.target.result, 185000);
            }
            callApi('uploadImage', { base64: comp, name: "pass_" + uniqueId + ".jpg" }).then(res => { if(res.url){ currentAvatarPhoto = res.url; document.getElementById('passport_frame_view').src = getDirectImageUrl(res.url); document.getElementById('p_avatar_remove_btn').style.display='flex'; } });
          }; r.readAsDataURL(file);
        };
        document.getElementById('st_multi_uploader').onchange = (e) => { processIncomingMultiAttachments(e.target.files, 'stAttachmentsPreviews'); };

        submit.onclick = () => {
          const p1 = document.getElementById('st_p1').value; const p2 = document.getElementById('st_p2').value;
          if(!p1 || p1.length !== 11) { alert("Phone 1 must be exactly 11 numeric digits."); return; }
          if(p2 && p2.length !== 11) { alert("Phone 2 must be exactly 11 numeric digits if provided."); return; }
          submit.disabled = true;
          
          callApi(isEdit?'updateStaff':'saveStaff', { 
            rowId: document.getElementById('st_id').value, 
            name: document.getElementById('st_name').value, 
            address: document.getElementById('st_address').value, 
            role: document.getElementById('st_role').value, 
            phone1: String(p1), 
            phone2: String(p2), 
            email: document.getElementById('st_email').value,
            bank: document.getElementById('st_bank').value,                   // NEW
            account: String(document.getElementById('st_account').value).padStart(10, '0'), // Auto-pads to 10 digits
            passport: currentAvatarPhoto, 
            attachments: currentModalFiles.join(','), 
            archived: document.getElementById('st_archived').value 
          }).then(() => { closeModal(); refreshData('staff'); });
        };
      }
      else if (type === 'vendor') {
        const uniqueId = isEdit ? (editData.rowId || editData.RowId) : generateNextId('VND', cache.vendors, 'rowId');
        title.innerText = "Vendor SLA Registry Profile";
        currentAvatarPhoto = isEdit ? (editData.passport || editData.Passport) : "";
        if (isEdit && (editData.attachments || editData.Attachments)) currentModalFiles = (editData.attachments || editData.Attachments).split(',').filter(Boolean);

        // Auto-restore stripped leading zeros from Google Sheets
        let vPhone1 = isEdit ? String(editData.phone1 || editData.Phone1 || '').replace(/[^0-9]/g, '') : '';
        if (vPhone1.length === 10 && !vPhone1.startsWith('0')) vPhone1 = '0' + vPhone1;

        let vPhone2 = isEdit ? String(editData.phone2 || editData.Phone2 || '').replace(/[^0-9]/g, '') : '';
        if (vPhone2.length === 10 && !vPhone2.startsWith('0')) vPhone2 = '0' + vPhone2;
        
        body.innerHTML = `
          <div class="passport-frame-container" style="position:relative;">
            <img id="vendor_frame_view" src="${currentAvatarPhoto ? getDirectImageUrl(currentAvatarPhoto) : 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 width=%2260%22 height=%2260%22><path d=%22M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z%22 fill=%22%236c757d%22/></svg>'}" style="width:100%; height:100%; object-fit:cover;">
            <label style="position:absolute; bottom:2px; right:2px; background:var(--primary); color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #fff; cursor:pointer;">
              <i class="fas fa-camera" style="font-size:12px;"></i>
              <input type="file" id="v_pass_uploader" accept="image/*" capture="environment" style="display:none">
            </label>
            <div id="p_avatar_remove_btn" onclick="clearAvatarPhotoFrame()" style="position:absolute; top:2px; right:2px; background:var(--danger); color:white; border:2px solid white; border-radius:50%; width:22px; height:22px; display:${currentAvatarPhoto?'flex':'none'}; align-items:center; justify-content:center; font-size:12px; font-weight:900; cursor:pointer; z-index:15;">&times;</div>
          </div>

          <label ${labelStyle}>Vendor ID</label><input id="v_id" value="${uniqueId}" ${largeInput} ${isEdit?'disabled':''}>
          <label ${labelStyle}>Corporate Entity Name</label><input id="v_company" value="${isEdit ? (editData.company || editData.Company) : ''}" ${largeInput}>
          <label ${labelStyle}>Business Address</label><input id="v_address" value="${isEdit ? (editData.address || editData.Address || '') : ''}" ${largeInput}>
          <label ${labelStyle}>Trade Domain Specialization</label><input id="v_trade" value="${isEdit ? (editData.trade || editData.Trade) : ''}" ${largeInput}>
          <label ${labelStyle}>Primary Account Contact Name</label><input id="v_contact" value="${isEdit ? (editData.contactName || editData.ContactName) : ''}" ${largeInput}>
          <label ${labelStyle}>Phone 1</label><input id="v_phone1" type="tel" maxlength="11" inputmode="numeric" oninput="this.value=this.value.replace(/[^0-9]/g,'')" value="${vPhone1}" ${largeInput}>
          <label ${labelStyle}>Phone 2</label><input id="v_phone2" type="tel" maxlength="11" inputmode="numeric" oninput="this.value=this.value.replace(/[^0-9]/g,'')" value="${vPhone2}" ${largeInput}>
          <label ${labelStyle}>Corporate Support Email</label><input id="v_email" type="email" value="${isEdit?(editData.email || editData.Email || ''):''}" ${largeInput}>
          <label ${labelStyle}>Bank Name</label>
          <input list="bank_list" id="v_bank" value="${isEdit?(editData.bank || editData.Bank || ''):''}" placeholder="e.g. Zenith Bank" ${largeInput}>
          <label ${labelStyle}>Account Number</label>
          <input id="v_account" type="text" inputmode="numeric" maxlength="10" oninput="this.value=this.value.replace(/[^0-9]/g,'')" value="${isEdit?(editData.account || editData.Account || ''):''}" placeholder="10 Digit Account Number" ${largeInput}>
          <label ${labelStyle}>SLA Contract Expiration Timeline</label><input id="v_end" type="date" value="${isEdit?fromSheetDate(editData.contractEnd || editData.ContractEnd):''}" ${largeInput}>
          
          <label ${labelStyle}>Archive Profile Account</label>
          <select id="v_archived" ${largeInput}>
            <option value="No" ${isEdit && String(editData.archived || editData.Archived) === 'No' ? 'selected' : ''}>Active Portfolio</option>
            <option value="Yes" ${isEdit && String(editData.archived || editData.Archived) === 'Yes' ? 'selected' : ''}>Archived</option>
          </select>

          <label ${labelStyle}>Form Attachments</label>
          <div id="vAttachmentsPreviews" class="modal-preview-grid" style="display:none;"></div>
          <label class="icon-upload-label"><i class="fas fa-paperclip"></i><input type="file" id="v_multi_uploader" accept="image/*,application/pdf" multiple style="display:none"></label>`;

        if(isEdit && currentModalFiles.length > 0) populateModalInlineImageGalleryPreviews('vAttachmentsPreviews');

        document.getElementById('v_pass_uploader').onchange = (e) => {
          const file = e.target.files[0]; if(!file) return;
          const r = new FileReader(); r.onload = async (evt) => {
            let comp = evt.target.result;
            if (file.size > 200 * 1024) {
              comp = await compressImageToTargetLimit(evt.target.result, 185000);
            }
            callApi('uploadImage', { base64: comp, name: "vpass_" + uniqueId + ".jpg" }).then(res => { if(res.url){ currentAvatarPhoto = res.url; document.getElementById('vendor_frame_view').src = getDirectImageUrl(res.url); document.getElementById('p_avatar_remove_btn').style.display='flex'; } });
          }; r.readAsDataURL(file);
        };
        document.getElementById('v_multi_uploader').onchange = (e) => { processIncomingMultiAttachments(e.target.files, 'vAttachmentsPreviews'); };

        submit.onclick = () => {
          const p1 = document.getElementById('v_phone1').value; const p2 = document.getElementById('v_phone2').value;
          if(!p1 || p1.length !== 11) { alert("Phone 1 must be exactly 11 numeric digits."); return; }
          if(p2 && p2.length !== 11) { alert("Phone 2 must be exactly 11 numeric digits if provided."); return; }
          submit.disabled = true;
          
          callApi(isEdit?'updateVendor':'saveVendor', { 
            rowId: document.getElementById('v_id').value, 
            company: document.getElementById('v_company').value, 
            address: document.getElementById('v_address').value, 
            trade: document.getElementById('v_trade').value, 
            contactName: document.getElementById('v_contact').value, 
            phone1: String(p1), 
            phone2: String(p2), 
            email: document.getElementById('v_email').value, 
            bank: document.getElementById('v_bank').value,                    // NEW
            account: String(document.getElementById('v_account').value).padStart(10, '0'), // Auto-pads to 10 digits
            contractEnd: toSheetDate(document.getElementById('v_end').value), 
            passport: currentAvatarPhoto, 
            attachments: currentModalFiles.join(','), 
            archived: document.getElementById('v_archived').value 
          }).then(() => { closeModal(); refreshData('vendors'); });
        };
      }
    }

    // --- PDF PRINT LAYOUT ENGINE ---
    function printSingleWorkOrderDirect(woId, includeAttachments = true) {
      const orderItem = cache.workorders.find(w => String(w.workOrderId || w.WorkOrderId) === woId); if(!orderItem) return;
      var unitId = getUnitNumber(orderItem);
      
      let assetInfo = "N/A";
      if (orderItem.asset || orderItem.Asset) {
          const ast = cache.assets.find(a => String(a.tag || a.Tag) === String(orderItem.asset || orderItem.Asset));
          assetInfo = ast ? `${ast.tag || 'N/A'}; ${ast.type || 'N/A'}; ${ast.specs || 'N/A'}; ${ast.loc || ast.Loc || 'N/A'}` : (orderItem.asset || orderItem.Asset);
      }
      
      // Dynamic Styling for the Approved Badge
      const woStatus = String(orderItem.status || orderItem.Status || 'PENDING').toUpperCase();
      const statusBadge = woStatus === 'APPROVED' 
        ? `<span style="background-color: #198754; color: #ffffff; padding: 4px 10px; border-radius: 4px;">${woStatus}</span>` 
        : woStatus;
      
      let invoiceLayoutHtml = `
        <div style="width: 800px; padding: 20px 40px; font-family:'Inter', sans-serif; color:#000; background:#fff; box-sizing: border-box;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #000; padding-bottom:10px; margin-bottom:20px;">
            <div>
              <h2 style="font-size:32px; margin:0; text-transform:uppercase;">${appSettings.estateName || 'Work Order Dossier'}</h2>
              <small style="display:block; font-weight:700; color:#444; margin-top:2px;">Managed by: ${appSettings.fmName || 'Facility Pro Engine'}</small>
            </div>
            <div style="text-align:right; font-size:12px; font-weight:800;">PRINT DATE:<br>${new Date().toLocaleDateString()}</div>
          </div>
          
          <h3 style="text-transform: uppercase; margin-bottom: 15px;">Work Order Authorization Form</h3>
          <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:14px;">
            <tr><th style="width:30%; padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Work Order Ref</th><td style="padding:10px; border:1px solid #000;"><strong>${orderItem.workOrderId || orderItem.WorkOrderId}</strong></td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Date Logged</th><td style="padding:10px; border:1px solid #000;">${formatDateForDisplay(orderItem.date || orderItem.Date)}</td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Target Node</th><td style="padding:10px; border:1px solid #000;">Unit ${unitId} | Asset: ${assetInfo}</td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Assigned</th><td style="padding:10px; border:1px solid #000;">${orderItem.assigned || orderItem.Assigned || 'Unassigned'}</td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Project Duration</th><td style="padding:10px; border:1px solid #000;">${orderItem.duration || orderItem.Duration || 'Not Specified'}</td></tr>
            
            <tr><th style="padding:10px; border:1px solid #000; background:#f9f9f9; text-align:left;">Submitted Value</th><td style="padding:10px; border:1px solid #000; background:#f9f9f9; font-size:15px; color:#555;"><strong>₦${formatMoney(orderItem.submittedValue || orderItem.SubmittedValue)}</strong></td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#e8f4fd; text-align:left;">Negotiated Value</th><td style="padding:10px; border:1px solid #000; background:#e8f4fd; font-size:18px;"><strong>₦${formatMoney(orderItem.amount || orderItem.Amount)}</strong></td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f9f9f9; text-align:left;">Amount in Words</th><td style="padding:10px; border:1px solid #000; font-style:italic;"><strong>${convertAmountToWords(orderItem.amount || orderItem.Amount)}</strong></td></tr>
            
            <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Lifecycle Auth Status</th><td style="padding:10px; border:1px solid #000;"><strong>${statusBadge}</strong></td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left; vertical-align:top;">Scope / Narrative</th><td style="padding:10px; border:1px solid #000;">${orderItem.description || orderItem.Description || 'No description provided.'}</td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left; vertical-align:top;">Operational Remarks</th><td style="padding:10px; border:1px solid #000;">${orderItem.notes || orderItem.Notes || 'No operational feedback logged.'}</td></tr>
          </table>
        </div>`;

      let attachmentsArr = [];
      // Respect the includeAttachments toggle
      if (includeAttachments && (orderItem.attachments || orderItem.Attachments)) {
          attachmentsArr = (orderItem.attachments || orderItem.Attachments).split(',').filter(Boolean);
      }
      compileAndDownloadUnifiedPDF(invoiceLayoutHtml, attachmentsArr, `WorkOrder_${woId}`);
    }
    
    function printSingleExpenseRequestDirect(reqId) {
      const orderItem = cache.expenseRequests.find(w => String(w.reqId || w.ReqId) === reqId); if(!orderItem) return;
      var unitId = getUnitNumber(orderItem);
      
      let invoiceLayoutHtml = `
        <div style="width: 800px; padding: 20px 40px; font-family:'Inter', sans-serif; color:#000; background:#fff; box-sizing: border-box;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #000; padding-bottom:10px; margin-bottom:20px;">
            <div>
              <h2 style="font-size:32px; margin:0; text-transform:uppercase;">${appSettings.estateName || 'Facility Pro'}</h2>
              <small style="display:block; font-weight:700; color:#444; margin-top:2px;">Expense Request Form</small>
            </div>
            <div style="text-align:right; font-size:12px; font-weight:800;">PRINT DATE:<br>${new Date().toLocaleDateString()}</div>
          </div>
          
          <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:14px;">
            <tr><th style="width:30%; padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Request Ref</th><td style="padding:10px; border:1px solid #000;"><strong>${orderItem.reqId || orderItem.ReqId}</strong></td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Apt : Asset</th><td style="padding:10px; border:1px solid #000;">Unit ${unitId} : ${orderItem.assetTag || 'N/A'}</td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#e8f4fd; text-align:left;">Estimated Cost</th><td style="padding:10px; border:1px solid #000; background:#e8f4fd; font-size:18px;"><strong>₦${formatMoney(orderItem.cost || orderItem.Cost)}</strong></td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f9f9f9; text-align:left;">Amount in Words</th><td style="padding:10px; border:1px solid #000; font-style:italic;"><strong>${convertAmountToWords(orderItem.cost || orderItem.Cost)}</strong></td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left; vertical-align:top;">Job Scope</th><td style="padding:10px; border:1px solid #000;">${orderItem.job || orderItem.Job || 'No description provided.'}</td></tr>
          </table>
        </div>`;

      let attachmentsArr = [];
      if (orderItem.attachments || orderItem.Attachments) {
          attachmentsArr = (orderItem.attachments || orderItem.Attachments).split(',').filter(Boolean);
      }
      compileAndDownloadUnifiedPDF(invoiceLayoutHtml, attachmentsArr, `ExpenseReq_${reqId}`);
    }

    function printSingleCashExpenseDirect(cashId) {
      const orderItem = cache.cashExpenses.find(w => String(w.cashId || w.CashId) === cashId); if(!orderItem) return;
      var unitId = getUnitNumber(orderItem);
      
      let invoiceLayoutHtml = `
        <div style="width: 800px; padding: 20px 40px; font-family:'Inter', sans-serif; color:#000; background:#fff; box-sizing: border-box;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #000; padding-bottom:10px; margin-bottom:20px;">
            <div>
              <h2 style="font-size:32px; margin:0; text-transform:uppercase;">${appSettings.estateName || 'Facility Pro'}</h2>
              <small style="display:block; font-weight:700; color:#444; margin-top:2px;">Cash Expense Voucher</small>
            </div>
            <div style="text-align:right; font-size:12px; font-weight:800;">PRINT DATE:<br>${new Date().toLocaleDateString()}</div>
          </div>
          
          <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:14px;">
            <tr><th style="width:30%; padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Voucher ID</th><td style="padding:10px; border:1px solid #000;"><strong>${orderItem.cashId || orderItem.CashId}</strong></td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Associated Unit</th><td style="padding:10px; border:1px solid #000;">Unit ${unitId}</td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#e8f4fd; text-align:left;">Amount Dispensed</th><td style="padding:10px; border:1px solid #000; background:#e8f4fd; font-size:22px;"><strong>₦${formatMoney(orderItem.amount || orderItem.Amount)}</strong></td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f9f9f9; text-align:left;">Amount in Words</th><td style="padding:10px; border:1px solid #000; font-style:italic;"><strong>${convertAmountToWords(orderItem.amount || orderItem.Amount)}</strong></td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left; vertical-align:top;">Justification</th><td style="padding:10px; border:1px solid #000;">${orderItem.description || orderItem.Description || 'No description provided.'}</td></tr>
          </table>
        </div>`;

      let attachmentsArr = [];
      if (orderItem.attachments || orderItem.Attachments) {
          attachmentsArr = (orderItem.attachments || orderItem.Attachments).split(',').filter(Boolean);
      }
      compileAndDownloadUnifiedPDF(invoiceLayoutHtml, attachmentsArr, `CashVoucher_${cashId}`);
    }

    function printSinglePaymentDirect(paymentId) {
      const orderItem = cache.payments.find(p => String(p.paymentId || p.PaymentId) === paymentId); 
      if(!orderItem) return;
      
      const isOutflow = orderItem.direction === 'OUTFLOW';
      const documentTitle = isOutflow ? 'Payment Voucher / Request' : 'Official Receipt';
      const partyLabel = isOutflow ? 'Payee / Vendor' : 'Received From';
      
      // 1. Get Payment Attachments
      const rawAttachments = orderItem.attachments || orderItem.Attachments;
      let combinedAttachmentsArray = rawAttachments ? String(rawAttachments).split(',').map(s => s.trim()).filter(Boolean) : [];
      
      // 2. Build the Primary Ledger HTML
      // 2. Build the Primary Ledger HTML
      let finalLayoutHtml = `
        <div style="width: 800px; padding: 20px 40px; font-family:'Inter', sans-serif; color:#000; background:#fff; box-sizing: border-box;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #000; padding-bottom:10px; margin-bottom:20px;">
            <div>
              <h2 style="font-size:32px; margin:0; text-transform:uppercase;">${appSettings.estateName || 'Facility Pro'}</h2>
              <small style="display:block; font-weight:700; color:#444; margin-top:2px;">${documentTitle}</small>
            </div>
            <div style="text-align:right; font-size:12px; font-weight:800;">PRINT DATE:<br>${new Date().toLocaleDateString()}</div>
          </div>
          
          <table style="width:100%; border-collapse:collapse; margin-bottom:10px; font-size:14px;">
            <tr><th style="width:30%; padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Transaction Ref</th><td style="padding:10px; border:1px solid #000;"><strong>${orderItem.paymentId || orderItem.PaymentId}</strong></td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Date Logged</th><td style="padding:10px; border:1px solid #000;">${formatDateForDisplay(orderItem.date || orderItem.Date)}</td></tr>
            ${(orderItem.reference || orderItem.Reference) ? `<tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Linked Record</th><td style="padding:10px; border:1px solid #000;"><strong>${orderItem.reference || orderItem.Reference}</strong></td></tr>` : ''}
            <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Reason / Justification</th><td style="padding:10px; border:1px solid #000;">${orderItem.reason || orderItem.Reason || 'No specific reason provided.'}</td></tr>
            
            ${(orderItem.totalJobValue || orderItem.TotalJobValue) ? `<tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Total Job Value</th><td style="padding:10px; border:1px solid #000; font-size:16px;"><strong>₦${formatMoney(orderItem.totalJobValue || orderItem.TotalJobValue)}</strong></td></tr>` : ''}
            ${(orderItem.paidToDate || orderItem.PaidToDate) ? `<tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Paid to Date</th><td style="padding:10px; border:1px solid #000;">₦${formatMoney(orderItem.paidToDate || orderItem.PaidToDate)}</td></tr>` : ''}
            
            <tr><th style="padding:10px; border:1px solid #000; background:#e8f4fd; text-align:left;">Amount to Pay</th><td style="padding:10px; border:1px solid #000; background:#e8f4fd; font-size:18px;"><strong>₦${formatMoney(orderItem.amount || orderItem.Amount)}</strong></td></tr>
            <tr><th style="padding:10px; border:1px solid #000; background:#f9f9f9; text-align:left;">Amount in Words</th><td style="padding:10px; border:1px solid #000; font-style:italic;"><strong>${convertAmountToWords(orderItem.amount || orderItem.Amount)}</strong></td></tr>
            
            ${(orderItem.balanceDue || orderItem.BalanceDue) ? `<tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Balance Due</th><td style="padding:10px; border:1px solid #000; font-size:16px; color:#dc3545;"><strong>₦${formatMoney(orderItem.balanceDue || orderItem.BalanceDue)}</strong></td></tr>` : ''}
          </table>

          <div style="border: 2px dashed #000; padding: 20px; margin-top: 25px; background-color: #fafafa; border-radius: 8px; page-break-inside: avoid;">
            <h4 style="margin-top:0; margin-bottom: 15px; text-transform: uppercase; font-size: 14px; color: #444; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Transaction Disbursement Details</h4>
            <div style="display: flex; justify-content: space-between; font-size: 16px; align-items: flex-end;">
              <div style="width: 35%;">
                <small style="color: #666; font-weight: 700; font-size: 12px; display: block; text-transform: uppercase;">${partyLabel}</small>
                <strong>${orderItem.party || orderItem.Party || 'N/A'}</strong>
              </div>
              <div style="width: 30%;">
                <small style="color: #666; font-weight: 700; font-size: 12px; display: block; text-transform: uppercase;">Bank Account</small>
                <strong>${(orderItem.account || orderItem.Account) ? String(orderItem.account || orderItem.Account).padStart(10, '0') : 'N/A'}</strong><br>
                <span style="font-size: 14px; color: #555;">${orderItem.bank || orderItem.Bank || ''}</span>
              </div>
              <div style="width: 35%; text-align: right;">
                <small style="color: #666; font-weight: 700; font-size: 12px; display: block; text-transform: uppercase; margin-bottom: 4px;">Amount to Pay</small>
                <span style="font-size: 30px; font-weight: 900; color: #000; display: block; line-height: 1;">₦${formatMoney(orderItem.amount || orderItem.Amount)}</span>
              </div>
            </div>
          </div>
        </div>`;
      
      // 3. Check for and stitch Linked Records (Work Orders or Expense Requests)
      const ref = orderItem.reference || orderItem.Reference;
      
      if (ref) {
          if (ref.startsWith('WO-')) {
              const wo = cache.workorders.find(w => String(w.workOrderId || w.WorkOrderId) === ref);
              if (wo) {
                  let assetInfo = "N/A";
                  if (wo.asset || wo.Asset) {
                      const ast = cache.assets.find(a => String(a.tag || a.Tag) === String(wo.asset || wo.Asset));
                      assetInfo = ast ? `${ast.tag || 'N/A'}; ${ast.type || 'N/A'}; ${ast.specs || 'N/A'}; ${ast.loc || ast.Loc || 'N/A'}` : (wo.asset || wo.Asset);
                  }
                  
                  finalLayoutHtml += `
                    <div style="page-break-before: always; height: 0; clear: both;"></div>
                    <div style="width: 800px; padding: 20px 40px; font-family:'Inter', sans-serif; color:#000; background:#fff; box-sizing: border-box;">
                      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #000; padding-bottom:10px; margin-bottom:20px;">
                        <div>
                          <h2 style="font-size:32px; margin:0; text-transform:uppercase;">${appSettings.estateName || 'Work Order Dossier'}</h2>
                          <small style="display:block; font-weight:700; color:#444; margin-top:2px;">[SUPPORTING DOCUMENT] Managed by: ${appSettings.fmName || 'Facility Pro'}</small>
                        </div>
                        <div style="text-align:right; font-size:12px; font-weight:800;">PRINT DATE:<br>${new Date().toLocaleDateString()}</div>
                      </div>
                      <h3 style="text-transform: uppercase; margin-bottom: 15px;">Work Order Authorization Form</h3>
                      <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:14px;">
                        <tr><th style="width:30%; padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Work Order Ref</th><td style="padding:10px; border:1px solid #000;"><strong>${wo.workOrderId || wo.WorkOrderId}</strong></td></tr>
                        <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Date Logged</th><td style="padding:10px; border:1px solid #000;">${formatDateForDisplay(wo.date || wo.Date)}</td></tr>
                        <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Target Node</th><td style="padding:10px; border:1px solid #000;">Unit ${getUnitNumber(wo)} | Asset: ${assetInfo}</td></tr>
                        <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Assigned</th><td style="padding:10px; border:1px solid #000;">${wo.assigned || wo.Assigned || 'Unassigned'}</td></tr>
                        <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Project Duration</th><td style="padding:10px; border:1px solid #000;">${wo.duration || wo.Duration || 'Not Specified'}</td></tr>
                        <tr><th style="padding:10px; border:1px solid #000; background:#f9f9f9; text-align:left;">Submitted Value</th><td style="padding:10px; border:1px solid #000; background:#f9f9f9; font-size:15px; color:#555;"><strong>₦${formatMoney(wo.submittedValue || wo.SubmittedValue)}</strong></td></tr>
                        <tr><th style="padding:10px; border:1px solid #000; background:#e8f4fd; text-align:left;">Negotiated Value</th><td style="padding:10px; border:1px solid #000; background:#e8f4fd; font-size:18px;"><strong>₦${formatMoney(wo.amount || wo.Amount)}</strong></td></tr>
                        <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Lifecycle Auth Status</th><td style="padding:10px; border:1px solid #000;"><strong>${String(wo.status || wo.Status || 'PENDING').toUpperCase()}</strong></td></tr>
                        <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left; vertical-align:top;">Scope / Narrative</th><td style="padding:10px; border:1px solid #000;">${wo.description || wo.Description || 'No description provided.'}</td></tr>
                      </table>
                    </div>`;
                    
                  if (wo.attachments || wo.Attachments) combinedAttachmentsArray.push(...(wo.attachments || wo.Attachments).split(',').filter(Boolean));
              }
          } 
          else if (ref.startsWith('EXR-')) {
              const exr = cache.expenseRequests.find(r => String(r.reqId || r.ReqId) === ref);
              if (exr) {
                  finalLayoutHtml += `
                    <div style="page-break-before: always; height: 0; clear: both;"></div>
                    <div style="width: 800px; padding: 20px 40px; font-family:'Inter', sans-serif; color:#000; background:#fff; box-sizing: border-box;">
                      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #000; padding-bottom:10px; margin-bottom:20px;">
                        <div>
                          <h2 style="font-size:32px; margin:0; text-transform:uppercase;">${appSettings.estateName || 'Facility Pro'}</h2>
                          <small style="display:block; font-weight:700; color:#444; margin-top:2px;">[SUPPORTING DOCUMENT] Expense Request Form</small>
                        </div>
                        <div style="text-align:right; font-size:12px; font-weight:800;">PRINT DATE:<br>${new Date().toLocaleDateString()}</div>
                      </div>
                      <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:14px;">
                        <tr><th style="width:30%; padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Request Ref</th><td style="padding:10px; border:1px solid #000;"><strong>${exr.reqId || exr.ReqId}</strong></td></tr>
                        <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left;">Apt : Asset</th><td style="padding:10px; border:1px solid #000;">Unit ${getUnitNumber(exr)} : ${exr.assetTag || 'N/A'}</td></tr>
                        <tr><th style="padding:10px; border:1px solid #000; background:#e8f4fd; text-align:left;">Estimated Cost</th><td style="padding:10px; border:1px solid #000; background:#e8f4fd; font-size:18px;"><strong>₦${formatMoney(exr.cost || exr.Cost)}</strong></td></tr>
                        <tr><th style="padding:10px; border:1px solid #000; background:#f0f0f0; text-align:left; vertical-align:top;">Job Scope</th><td style="padding:10px; border:1px solid #000;">${exr.job || exr.Job || 'No description provided.'}</td></tr>
                      </table>
                    </div>`;
                    
                  if (exr.attachments || exr.Attachments) combinedAttachmentsArray.push(...(exr.attachments || exr.Attachments).split(',').filter(Boolean));
              }
          }
      }

      // 4. Clean up any duplicate attachments (in case the same receipt was uploaded to both)
      combinedAttachmentsArray = Array.from(new Set(combinedAttachmentsArray));

      // 5. Send everything to the PDF compiler
      compileAndDownloadUnifiedPDF(finalLayoutHtml, combinedAttachmentsArray, `Ledger_Dossier_${orderItem.paymentId || orderItem.PaymentId}`);
    }
    
    // ---------------------------------------------------------
    // COMPRESSION LOGIC
    // ---------------------------------------------------------
    function compressImageToTargetLimit(base64Str, targetMaxBytes) {
      return new Promise((resolve) => {
        const img = new Image(); img.src = base64Str; img.onload = () => {
          const canvas = document.createElement('canvas'); let w = img.width; let h = img.height;
          if (w > h) { if (w > 1000) { h *= 1000 / w; w = 1000; } } else { if (h > 1000) { w *= 1000 / h; h = 1000; } }
          canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
          let q = 0.8; let res = canvas.toDataURL('image/jpeg', q);
          while (res.length > targetMaxBytes && q > 0.15) { q -= 0.1; res = canvas.toDataURL('image/jpeg', q); }
          resolve(res);
        };
      });
    }

    function toSheetDate(dStr) { if (!dStr) return ""; const [y, m, d] = dStr.split('-'); return `${d}/${m}/${y}`; }
    function getDirectImageUrl(url) { if (!url) return ""; if (url.includes('drive.google.com')) { const fileId = url.split('/d/')[1]?.split('/')[0] || url.split('id=')[1]?.split('&')[0]; return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`; } return url; }
    function closeModal() { document.getElementById('modalOverlay').style.display = 'none'; bootstrapDataRegistriesPipeline(); }

    function initReportsEngine() {
      const pipeline = [
        callApi('getApartments', {}).then(r => cache.apts = r || []), 
        callApi('getAssets', {}).then(r => cache.assets = r || []), 
        callApi('getMaintenance', {}).then(r => cache.tickets = r || []), 
        callApi('getWorkOrders', {}).then(r => cache.workorders = r || []),
        callApi('getUtilities', {}).then(r => cache.utilities = r || []),
        callApi('getPayments', {}).then(r => cache.payments = r || []),
        callApi('getExpenseRequests', {}).then(r => cache.expenseRequests = r || []),
        callApi('getCashExpenses', {}).then(r => cache.cashExpenses = r || [])
      ];
      Promise.all(pipeline).then(() => { 
        if(cache.apts) sortApartmentsCacheList();
        document.getElementById('rep-profile-selector').value = ""; 
        document.getElementById('rep-layout-selector').innerHTML = "<option value=''>-- Choose Configurations --</option>"; 
        document.getElementById('rep-dynamic-parameters-frame').innerHTML = ""; 
        document.getElementById('report-onscreen-preview-card').style.display = "none"; 
      });
    }

    function handleReportProfileSwitch() {
      const profile = document.getElementById('rep-profile-selector').value;
      const layoutSel = document.getElementById('rep-layout-selector');
      const paramsFrame = document.getElementById('rep-dynamic-parameters-frame');
      
      layoutSel.innerHTML = "";
      paramsFrame.innerHTML = "";
      document.getElementById('report-onscreen-preview-card').style.display = "none";
    
      if (profile === "apartments") {
        layoutSel.innerHTML = `
          <option value="">-- Select Report --</option>
          <option value="occupancy_report">Apartment Occupancy Report</option>
          <option value="apt_custom_print">Apartments Manifest</option>
          <option value="detailed_profile">Detailed Apartment Profile</option>
        `; 
      } 
      else if (profile === "equipment") {
        layoutSel.innerHTML = `
          <option value="">-- Select Report --</option>
          <option value="generator_log">Generator & Diesel Consumption Log</option>
          <option value="pm_schedule">Preventive Maintenance (PM) Schedule</option>
          <option value="asset_register">Master Asset Register</option>
          <option value="ticket_report">Maintenance & Complaint Tickets</option>
        `;
      } 
      else if (profile === "financials") {
        layoutSel.innerHTML = `
          <option value="">-- Select Report --</option>
          <option value="ledger_summary">Comprehensive Financial Ledger</option>
          <option value="fin_wo">Approved Work Orders Ledger</option>
        `;
      }
      else if (profile === "executive") {
        layoutSel.innerHTML = `
          <option value="">-- Select Report --</option>
          <option value="daily_operations">Daily Operations Report</option>
          <option value="monthly_fm">Monthly FM Report</option>
          <option value="kpi_dashboard">Executive KPI Dashboard</option>
        `;
      }
    }
    
    function handleReportLayoutSwitch() {
       const layout = document.getElementById('rep-layout-selector').value;
       const paramsFrame = document.getElementById('rep-dynamic-parameters-frame');
       paramsFrame.innerHTML = ""; 
       
       if (layout === "detailed_profile") {
          paramsFrame.innerHTML = `<label>SELECT APARTMENT UNIT</label><select id="rep-param-unit" class="form-control"></select>`;
          // Assumes you have a helper to populate units, or you can inject a static list here
          if(typeof populateUnitDropdown === 'function') populateUnitDropdown('rep-param-unit');
       } 
       else if (["ledger_summary", "generator_log", "ticket_report", "fin_wo"].includes(layout)) {
          paramsFrame.innerHTML = `
            <div style="display:flex; gap:10px;">
              <div style="flex:1;"><label>START DATE</label><input type="date" id="rep_start_date" class="form-control"></div>
              <div style="flex:1;"><label>END DATE</label><input type="date" id="rep_end_date" class="form-control"></div>
            </div>
          `;
       } 
       else if (layout === "daily_operations") {
          const today = new Date().toISOString().split('T')[0];
          paramsFrame.innerHTML = `<label>REPORT DATE</label><input type="date" id="rep-param-date" value="${today}" class="form-control">`;
       } 
       else if (layout === "monthly_fm" || layout === "kpi_dashboard") {
          const thisMonth = new Date().toISOString().slice(0,7);
          paramsFrame.innerHTML = `<label>SELECT MONTH</label><input type="month" id="rep-param-month" value="${thisMonth}" class="form-control">`;
       }
    }

    function compileReportPreview() {
    const layout = document.getElementById('rep-layout-selector').value;
    const viewport = document.getElementById('report-preview-viewport');
    if (!layout) return;

    // 🚀 INTERCEPTS FOR CUSTOM STANDALONE LAYOUTS
    if (layout === "apt_custom_print") {
        generateApartmentManifestReport(); 
        return; 
    }
    if (layout === "detailed_profile") {
        const unit = document.getElementById('rep-param-unit').value;
        if (!unit) { alert("Please select a unit to generate the profile."); return; }
        generateApartmentDossierReport(unit); 
        return; 
    }

    // 1. UNIVERSAL EVERGREEN HEADER & WRAPPER
    // Upgraded to 100% width for perfect PDF scaling
    let out = `<div style="font-family: 'Helvetica', 'Inter', sans-serif; color: #000; background: #fff; box-sizing: border-box; width: 100%; max-width: 900px; margin: 0 auto; padding: 0; line-height: 1.4;">`;

    out += `
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">${appSettings.estateName || 'EVERGREEN ESTATE'}</h1>
        <p style="margin: 4px 0; font-size: 11px;">${appSettings.estateAddress || 'Plot 62, Amos Adamu Close, Parkview Estate, Ikoyi, Lagos'}</p>
        <p style="margin: 0; font-size: 11px; font-weight: bold;">Managed by: ${appSettings.fmName || 'PI PROJECTS'}</p>
      </div>
    `;

    const generateTitleBar = (titleText) => `
      <div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end;">
        <h2 style="margin: 0; font-size: 18px; font-weight: 900; text-transform: uppercase;">${titleText}</h2>
        <div style="text-align: right; font-size: 12px;">
          <p style="margin: 0; color: #555;">RUN DATE:</p>
          <p style="margin: 2px 0 0 0; font-weight: bold;">${new Date().toLocaleDateString('en-GB')}</p>
        </div>
      </div>
    `;

    // ---------------------------------------------------------
    // APARTMENT OCCUPANCY REPORT
    // ---------------------------------------------------------
    if (layout === "occupancy_report") {
        const apts = cache.apts || [];
        out += generateTitleBar('APARTMENT OCCUPANCY REPORT');

        let rows = apts.map(a => {
            const isOcc = String(a.status || '').toLowerCase() === 'occupied';
            // Added page-break-inside: avoid to TR
            return `<tr style="page-break-inside: avoid;">
              <td style="padding:6px; border:1px solid #000;">${a.unit || a.Unit || a.apt || 'N/A'}</td>
              <td style="padding:6px; border:1px solid #000;">${a.type || a.Type || 'N/A'}</td>
              <td style="padding:6px; border:1px solid #000; font-weight:bold; color:${isOcc ? '#198754' : '#DC3545'};">${(a.status || 'VACANT').toUpperCase()}</td>
              <td style="padding:6px; border:1px solid #000;">${a.tenant || a.Tenant || 'N/A'}</td>
              <td style="padding:6px; border:1px solid #000;">${a.leaseEnd || 'N/A'}</td>
            </tr>`;
        }).join('');

        out += `
          <table style="width:100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
            <thead style="display: table-header-group;"> <tr style="background-color: #f4f4f4; text-transform: uppercase; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Unit</th>
                <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Type</th>
                <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Status</th>
                <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Tenant Name</th>
                <th style="padding: 8px 6px; border: 1px solid #000; text-align:left;">Lease Expiry</th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan=\"5\" style=\"padding:10px; text-align:center;\">No data available.</td></tr>`}</tbody>
          </table>`;
    }

    // ---------------------------------------------------------
    // GENERATOR & DIESEL LOG
    // ---------------------------------------------------------
    else if (layout === "generator_log") {
        const startRaw = document.getElementById('rep_start_date').value;
        const endRaw = document.getElementById('rep_end_date').value;
        if (!startRaw || !endRaw) { alert("Please select a date range."); return; }

        const startDate = new Date(startRaw); const endDate = new Date(endRaw);
        const gens = (cache.utilities || []).filter(u => String(u.type || '').includes('Plant') || String(u.type || '').includes('Generator'));
        
        const filteredGens = gens.filter(g => {
            const gDate = g.date ? new Date(g.date) : new Date(0);
            return gDate >= startDate && gDate <= endDate;
        });

        out += generateTitleBar('GENERATOR & DIESEL LOG');
        out += `<p style="font-weight:700; font-size:12px; margin-top:-5px; margin-bottom:15px;">Period: ${startDate.toLocaleDateString('en-GB')} to ${endDate.toLocaleDateString('en-GB')}</p>`;

        let totHrs = 0; let totLiters = 0;
        let rows = filteredGens.map(g => {
            totHrs += parseFloat(g.runtime || 0); totLiters += parseFloat(g.dieselAdded || 0);
            return `<tr style="page-break-inside: avoid;">
              <td style="padding:6px; border:1px solid #000;">${g.date || 'N/A'}</td>
              <td style="padding:6px; border:1px solid #000;">${g.startHour || '-'}</td>
              <td style="padding:6px; border:1px solid #000;">${g.stopHour || '-'}</td>
              <td style="padding:6px; border:1px solid #000; text-align:center;">${g.runtime || 0}</td>
              <td style="padding:6px; border:1px solid #000; text-align:center;">${g.dieselAdded || 0}</td>
            </tr>`;
        }).join('');

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
              ${rows || `<tr><td colspan=\"5\" style=\"padding:10px; text-align:center;\">No logs for this period.</td></tr>`}
              <tr style="font-weight:900; font-size:13px; background-color: #eee; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                <td colspan="3" style="padding:8px 6px; border:1px solid #000; text-align:right;">TOTALS:</td>
                <td style="padding:8px 6px; border:1px solid #000; text-align:center;">${totHrs} Hrs</td>
                <td style="padding:8px 6px; border:1px solid #000; text-align:center;">${totLiters} L</td>
              </tr>
            </tbody>
          </table>`;
    }

    // ---------------------------------------------------------
    // PREVENTIVE MAINTENANCE SCHEDULE
    // ---------------------------------------------------------
    else if (layout === "pm_schedule") {
        const assets = (cache.assets || []).filter(a => String(a.status || '') !== 'Archived');
        out += generateTitleBar('PREVENTIVE MAINTENANCE SCHEDULE');

        let rows = assets.map(a => {
            let pmStatus = 'Active'; let color = '#000';
            if(a.nextService) {
                const diff = (new Date(a.nextService) - new Date()) / (1000 * 60 * 60 * 24);
                if(diff < 0) { pmStatus = 'Overdue'; color = '#DC3545'; }
                else if(diff <= 14) { pmStatus = 'Due Soon'; color = '#FFC107'; }
                else { pmStatus = 'Active'; color = '#198754'; }
            }
            return `<tr style="page-break-inside: avoid;">
              <td style="padding:6px; border:1px solid #000; font-weight:bold;">${a.tag || 'N/A'}</td>
              <td style="padding:6px; border:1px solid #000;">${a.type || 'N/A'}</td>
              <td style="padding:6px; border:1px solid #000;">${a.location || a.loc || 'N/A'}</td>
              <td style="padding:6px; border:1px solid #000;">${a.lastService || '-'}</td>
              <td style="padding:6px; border:1px solid #000;">${a.nextService || '-'}</td>
              <td style="padding:6px; border:1px solid #000; font-weight:bold; color:${color};">${pmStatus.toUpperCase()}</td>
            </tr>`;
        }).join('');

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
            <tbody>${rows || `<tr><td colspan=\"6\" style=\"padding:10px; text-align:center;\">No assets found.</td></tr>`}</tbody>
          </table>`;
    }

    // ---------------------------------------------------------
    // MASTER ASSET REGISTER
    // ---------------------------------------------------------
    else if (layout === "asset_register") {
        const assets = (cache.assets || []).filter(a => String(a.status || '') !== 'Archived');
        out += generateTitleBar('MASTER ASSET REGISTER');

        let rows = assets.map(a => {
            return `<tr style="page-break-inside: avoid;">
              <td style="padding:6px; border:1px solid #000; font-weight:bold;">${a.tag || 'N/A'}</td>
              <td style="padding:6px; border:1px solid #000;">${a.type || 'N/A'}<br><small style="color:#555;">${a.specs || ''}</small></td>
              <td style="padding:6px; border:1px solid #000;">${a.location || a.loc || 'N/A'}</td>
              <td style="padding:6px; border:1px solid #000;">${a.serialNumber || a.serial || 'N/A'}</td>
              <td style="padding:6px; border:1px solid #000;">${a.purchaseDate || 'N/A'}</td>
              <td style="padding:6px; border:1px solid #000; text-align:center; font-weight:bold;">${(a.status || 'OPERATIONAL').toUpperCase()}</td>
            </tr>`;
        }).join('');

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
            <tbody>${rows || `<tr><td colspan=\"6\" style=\"padding:10px; text-align:center;\">No assets found.</td></tr>`}</tbody>
          </table>`;
    }

    // ---------------------------------------------------------
    // MAINTENANCE TICKETS REPORT
    // ---------------------------------------------------------
    else if (layout === "ticket_report") {
        const startRaw = document.getElementById('rep_start_date').value;
        const endRaw = document.getElementById('rep_end_date').value;
        if (!startRaw || !endRaw) { alert("Please select a date range."); return; }

        const startDate = new Date(startRaw); const endDate = new Date(endRaw);
        const filteredTickets = (cache.tickets || []).filter(t => {
            const tDate = t.date ? new Date(t.date) : new Date(0);
            return tDate >= startDate && tDate <= endDate;
        });

        out += generateTitleBar('MAINTENANCE TICKET REPORT');
        out += `<p style="font-weight:700; font-size:12px; margin-top:-5px; margin-bottom:15px;">Period: ${startDate.toLocaleDateString('en-GB')} to ${endDate.toLocaleDateString('en-GB')}</p>`;

        let rows = filteredTickets.map(t => {
            return `<tr style="page-break-inside: avoid;">
              <td style="padding:6px; border:1px solid #000; font-weight:bold;">${t.ticketId || t.id || 'N/A'}</td>
              <td style="padding:6px; border:1px solid #000;">${t.date || 'N/A'}</td>
              <td style="padding:6px; border:1px solid #000;">${t.unit || t.apartment || 'N/A'}</td>
              <td style="padding:6px; border:1px solid #000;">${t.description || t.complaint || 'N/A'}</td>
              <td style="padding:6px; border:1px solid #000; text-align:center;">${t.priority || 'Normal'}</td>
              <td style="padding:6px; border:1px solid #000; font-weight:bold;">${(t.status || 'Pending').toUpperCase()}</td>
            </tr>`;
        }).join('');

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
            <tbody>${rows || `<tr><td colspan=\"6\" style=\"padding:10px; text-align:center;\">No tickets logged in this period.</td></tr>`}</tbody>
          </table>`;
    }

    // ---------------------------------------------------------
    // DAILY OPERATIONS & OTHER REPORTS
    // ---------------------------------------------------------
    else if (layout === "daily_operations") {
        const reportDate = document.getElementById('rep-param-date').value;
        if (!reportDate) { alert("Please select a date."); return; }

        const dailyTickets = (cache.tickets || []).filter(t => t.date === reportDate);
        const closedTickets = dailyTickets.filter(t => t.status === 'Completed');

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
    }

    else if (layout === "monthly_fm" || layout === "kpi_dashboard") {
        const monthStr = document.getElementById('rep-param-month').value; 
        if (!monthStr) { alert("Please select a month."); return; }

        const apts = cache.apts || [];
        const occupied = apts.filter(a => String(a.status || '').toLowerCase() === 'occupied').length;
        const occPercentage = apts.length > 0 ? Math.round((occupied / apts.length) * 100) : 0;

        let mInflow = 0; let mOutflow = 0;
        (cache.payments || []).filter(p => p.date && p.date.startsWith(monthStr)).forEach(p => mInflow += parseFloat(p.amount || 0));
        (cache.cashExpenses || []).filter(c => c.date && c.date.startsWith(monthStr)).forEach(c => mOutflow += parseFloat(c.amount || 0));

        out += generateTitleBar(`${layout === "monthly_fm" ? "MONTHLY FM REPORT" : "EXECUTIVE KPI DASHBOARD"} - ${monthStr}`);
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
    }

    else if (layout === "fin_wo" || layout === "ledger_summary") {
        const startRaw = document.getElementById('rep_start_date').value;
        const endRaw = document.getElementById('rep_end_date').value;
        if (!startRaw || !endRaw) { alert("Please select a date range."); return; }

        out += generateTitleBar(layout === "fin_wo" ? `APPROVED WORK ORDERS` : `LEDGER SUMMARY`);
        out += `<p style="font-weight:700; font-size:12px; margin-top:-5px; margin-bottom:15px;">Period: ${startRaw} to ${endRaw}</p>
                <div style="border: 1px solid #000; padding: 20px; text-align: center; font-style: italic;">Records successfully filtered. (Financial tables rendered below in full view).</div>`;
    }

    out = out.replace(/T\d{2}:\d{2}:\d{2}[\.a-zA-Z0-9]*/g, '');
    out += `</div>`; // Close universal wrapper

    // Set Report Filename for PDF saving
    window.currentReportFilename = layout.toUpperCase() + '_REPORT_' + new Date().getTime();
    window.currentReportAttachmentManifest = []; 

    // Output to viewport
    if(viewport) viewport.innerHTML = out;
    const printContainer = document.getElementById('report-print-container');
    if(printContainer) printContainer.innerHTML = out;
    
    const previewCard = document.getElementById('report-onscreen-preview-card');
    if(previewCard) previewCard.style.display = "block";

}

// =========================================================
// REPORT EXPORT ACTIONS
// =========================================================

function downloadCurrentReportPDF() {
  const source = document.getElementById('report-preview-viewport');
  
  if (!source || !source.innerHTML.trim()) {
      alert('Please generate a report first.');
      return;
  }
  
  const filename = window.currentReportFilename || 'Facility_Report';
  const attachments = window.currentReportAttachmentManifest || [];
  compileAndDownloadUnifiedPDF(source, attachments, filename);
}

function printCurrentReport() {
  const source = document.getElementById('report-preview-viewport');
  
  if (!source || !source.innerHTML.trim()) {
      alert('Please generate a report first.');
      return;
  }
  
  const filename = window.currentReportFilename || 'Facility_Report';
  const originalTitle = document.title;
  document.title = filename;
  window.print();
  setTimeout(() => {
      document.title = originalTitle;
  }, 1000);
}

// =========================================================
// 1. APARTMENTS MANIFEST REPORT (PDF Layout Match)
// =========================================================

function generateApartmentManifestReport() {
    const viewport = document.getElementById('report-preview-viewport');
    if (!viewport) return;

    window.currentReportFilename = 'Apartment_Manifest_' + new Date().getTime();
    window.currentReportAttachmentManifest = []; // Bypass server

    // Pull directly from the synced Settings tab
    const estateName = appSettings.estateName || "FACILITY PRO ESTATE";
    const estateAddress = appSettings.estateAddress || "Address not configured";
    const fmName = appSettings.fmName || "Facility Management";

    let html = `
    <div style="font-family: 'Arial', sans-serif; color: #000; background: #fff; padding: 20px; max-width: 800px; margin: 0 auto; line-height: 1.4;">
        
        <div style="text-align: center; margin-bottom: 30px;">
            <h2 style="font-size: 22px; font-weight: 900; margin: 0; text-transform: uppercase;">${estateName}</h2>
            <p style="font-size: 14px; margin: 4px 0 0 0;">${estateAddress}</p>
            <p style="font-size: 14px; margin: 4px 0 0 0; font-weight: bold;">Managed by: ${fmName}</p>
            <br>
            <h3 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0; text-decoration: underline;">APARTMENTS MANIFEST</h3>
        </div>
    `;

    // Filter out 'services' units
    let apartments = [...(cache.apts || [])].filter(a => String(a.type || '').toLowerCase() !== 'services');
    
    apartments.forEach(apt => {
        const unitId = getUnitNumber(apt);
        const tenant = apt.tenant || apt.Tenant || 'VACANT';
        const type = apt.type || apt.Type || 'Standard';
        const meter = apt.meterNo || apt.MeterNo || apt.meter || 'N/A'; 

        // Find associated assets
        const unitAssets = (cache.assets || []).filter(a => String(getUnitNumber(a)) === String(unitId) && String(a.status || '') !== 'Archived');

        html += `
        <div style="margin-bottom: 25px; page-break-inside: avoid;">
            <table style="width: 100%; border-collapse: collapse; border: 2px solid #000; font-size: 14px; font-weight: bold;">
                <tr>
                    <td style="border: 1px solid #000; padding: 6px; width: 15%; background: #f9f9f9;">Unit</td>
                    <td style="border: 1px solid #000; padding: 6px; width: 35%;">${unitId}</td>
                    <td style="border: 1px solid #000; padding: 6px; width: 15%; background: #f9f9f9;">Tenant</td>
                    <td style="border: 1px solid #000; padding: 6px; width: 35%; color: ${tenant.toUpperCase() === 'VACANT' ? '#DC3545' : '#198754'};">${tenant.toUpperCase()}</td>
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
            unitAssets.forEach(asset => {
                const aType = asset.type || asset.Type || 'Appliance';
                const aTag = asset.tag || asset.Tag || 'NO-TAG';
                const aSpecs = asset.specs || asset.Specs || '';
                const specString = aSpecs ? ` - ${aSpecs}` : '';
                
                html += `<li style="margin-bottom: 4px;">${aType} (${aTag})${specString}</li>`;
            });
        } else {
            html += `<li style="color: #666; font-style: italic;">No registered assets</li>`;
        }

        html += `
                </ul>
            </div>
        </div>
        `;
    });

    html += `</div>`;

    // Push layout to the screen and the hidden print container
    viewport.innerHTML = html;
    const printContainer = document.getElementById('report-print-container');
    if(printContainer) printContainer.innerHTML = html;
    
}

// =========================================================
// 2. APARTMENT DETAILED DOSSIER (PDF Layout Match)
// =========================================================

function generateApartmentDossierReport(targetUnitId) {
    const viewport = document.getElementById('report-preview-viewport');
    if (!viewport) return;

    window.currentReportFilename = `Apartment_Dossier_${targetUnitId}_` + new Date().getTime();
    window.currentReportAttachmentManifest = [];

    const apt = (cache.apts || []).find(a => String(getUnitNumber(a)) === String(targetUnitId));
    if (!apt) { alert("Apartment not found."); return; }

    const estateName = appSettings.estateName || "FACILITY PRO ESTATE";
    const estateAddress = appSettings.estateAddress || "Address not configured";
    const fmName = appSettings.fmName || "Facility Management";
    
    const type = apt.type || apt.Type || 'Standard';
    const status = apt.status || apt.Status || 'Vacant';
    const meter = apt.meterNo || apt.MeterNo || apt.meter || 'N/A';

    let html = `
    <div style="font-family: 'Arial', sans-serif; color: #000; background: #fff; padding: 20px; max-width: 800px; margin: 0 auto; line-height: 1.4;">
        
        <div style="text-align: center; margin-bottom: 25px;">
            <h2 style="font-size: 22px; font-weight: 900; margin: 0; text-transform: uppercase;">${estateName}</h2>
            <p style="font-size: 14px; margin: 4px 0 0 0;">${estateAddress}</p>
            <p style="font-size: 14px; margin: 4px 0 0 0; font-weight: bold;">Managed by: ${fmName}</p>
            <br>
            <h3 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0; text-decoration: underline;">APARTMENT DETAILED DOSSIER</h3>
        </div>

        <div style="margin-bottom: 20px;">
             <table style="width: 100%; border-collapse: collapse; border: 2px solid #000; font-size: 14px; font-weight: bold; margin-bottom: 10px;">
                <tr>
                    <td style="border: 1px solid #000; padding: 6px; width: 15%; background: #f9f9f9;">Type</td>
                    <td style="border: 1px solid #000; padding: 6px; width: 35%;">${type}</td>
                    <td style="border: 1px solid #000; padding: 6px; width: 15%; background: #f9f9f9;">Status</td>
                    <td style="border: 1px solid #000; padding: 6px; width: 35%; color: ${status.toUpperCase() === 'VACANT' ? '#DC3545' : '#198754'};">${status}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #000; padding: 6px; background: #f9f9f9;">Meter No</td>
                    <td style="border: 1px solid #000; padding: 6px;" colspan="3">${meter}</td>
                </tr>
            </table>
            
            <div style="display:flex; justify-content: space-between; font-weight: bold; font-size: 14px;">
                <span>RUN DATE: ${new Date().toLocaleDateString('en-GB')}</span>
                <span style="font-size: 20px;">${targetUnitId}</span>
            </div>
        </div>
        
        <h3 style="font-size: 14px; font-weight: bold; margin: 20px 0 10px 0; text-decoration: underline;">ASSETS:</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 2%; row-gap: 15px;">
    `;

    const unitAssets = (cache.assets || []).filter(a => String(getUnitNumber(a)) === String(targetUnitId) && String(a.status || '') !== 'Archived');
    
    if(unitAssets.length > 0) {
        unitAssets.forEach(asset => {
             let imgHtml = `<div style="height: 120px; background: #eee; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; color: #aaa; border-bottom: 1px solid #ccc; -webkit-print-color-adjust: exact; print-color-adjust: exact;">No Image</div>`;

            if (asset.photos || asset.Photos) {
                const firstPhoto = (asset.photos || asset.Photos).split(',')[0];
                if (firstPhoto) {
                    const imgUrl = typeof getDirectImageUrl === 'function' ? getDirectImageUrl(firstPhoto) : firstPhoto;
                    imgHtml = `
                    <div style="height: 120px; border-bottom: 1px solid #ccc; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fff;">
                        <img src="${imgUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                    </div>`;
                }
            }

             html += `
             <div style="width: 32%; border: 1px solid #000; border-radius: 4px; overflow: hidden; page-break-inside: avoid;">
                 ${imgHtml}
                 <div style="padding: 10px; font-size: 12px; line-height: 1.5;">
                     <div style="font-weight: 900; font-size: 13px; margin-bottom: 5px;">${asset.type || asset.Type || 'Asset'}</div>
                     <div><strong>Specs:</strong> ${asset.specs || asset.Specs || 'N/A'}</div>
                     <div><strong>Tag:</strong> ${asset.tag || asset.Tag}</div>
                     <div><strong>Loc:</strong> ${asset.loc || asset.Loc || 'N/A'}</div>
                     <div><strong>Status:</strong> ${asset.status || asset.Status || 'N/A'}</div>
                 </div>
             </div>
             `;
        });
    } else {
        html += `<div style="font-style: italic; color: #666; font-size: 13px;">No physical assets recorded for this unit.</div>`;
    }

    html += `</div></div>`;

    viewport.innerHTML = html;
    const printContainer = document.getElementById('report-print-container');
    if(printContainer) printContainer.innerHTML = html;
}
