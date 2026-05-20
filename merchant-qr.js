// ── DOM References ──────────────────────────────────────────────────────────
const merchantDash       = document.getElementById("merchantDash");
const mPanelDashboard    = document.getElementById("mPanelDashboard");
const mPanelGenerator    = document.getElementById("mPanelGenerator");
const mPanelGrantPoints  = document.getElementById("mPanelGrantPoints");
const mPanelCatalog      = document.getElementById("mPanelCatalog");
const mPanelSettings     = document.getElementById("mPanelSettings");

// Sidebar nav
const mNavDashboard      = document.getElementById("mNavDashboard");
const mNavGenerator      = document.getElementById("mNavGenerator");
const mNavGrantPoints    = document.getElementById("mNavGrantPoints");
const mNavCatalog        = document.getElementById("mNavCatalog");
const mNavSettings       = document.getElementById("mNavSettings");
const merchantLogoutBtn  = document.getElementById("merchantLogoutBtn");

// Mobile nav
const mMobNavDashboard   = document.getElementById("mMobNavDashboard");
const mMobNavGenerator   = document.getElementById("mMobNavGenerator");
const mMobNavGrant       = document.getElementById("mMobNavGrant");
const mMobNavCatalog     = document.getElementById("mMobNavCatalog");
const mMobNavSettings    = document.getElementById("mMobNavSettings");
const mMobNavLogout      = document.getElementById("mMobNavLogout");

// Dashboard panel
const merchantInfoEl         = document.getElementById("merchantInfo");
const merchantDashResultEl   = document.getElementById("merchantDashResult");
const mStatStatusEl          = document.getElementById("mStatStatus");
const mStatChargesLabelEl    = document.getElementById("mStatChargesLabel");
const mStatPointsLabelEl     = document.getElementById("mStatPointsLabel");
const mStatCreditedLabelEl   = document.getElementById("mStatCreditedLabel");
const mStatTodayChargesEl    = document.getElementById("mStatTodayCharges");
const mStatTodayPointsEl     = document.getElementById("mStatTodayPoints");
const mStatTodayCreditedEl   = document.getElementById("mStatTodayCredited");
const merchantLatestChargesEl = document.getElementById("merchantLatestCharges");
const merchantLoadMoreBtn    = document.getElementById("merchantLoadMoreBtn");
const merchantRefreshBtn     = document.getElementById("merchantRefreshBtn");
const mRangeDayBtn           = document.getElementById("mRangeDay");
const mRangeWeekBtn          = document.getElementById("mRangeWeek");
const mRangeMonthBtn         = document.getElementById("mRangeMonth");

// Generator panel
const qrForm       = document.getElementById("qrForm");
const pointsEl     = document.getElementById("points");
const descriptionEl = document.getElementById("description");
const resultEl     = document.getElementById("result");

// Grant panel
const grantForm        = document.getElementById("grantForm");
const grantClientToken = document.getElementById("grantClientToken");
const grantSubmitBtn   = document.getElementById("grantSubmitBtn");
const grantResult      = document.getElementById("grantResult");

// Step 1: Identify Client selectors
const billingClientSearchWrapper = document.getElementById("billingClientSearchWrapper");
const billingClientSearchForm  = document.getElementById("billingClientSearchForm");
const billingClientQuery       = document.getElementById("billingClientQuery");
const billingClientSearchBtn   = document.getElementById("billingClientSearchBtn");
const billingClientSearchResult = document.getElementById("billingClientSearchResult");

// Step 2: Billing selectors
const billingMainLayout        = document.getElementById("billingMainLayout");
const verifiedClientBanner     = document.getElementById("verifiedClientBanner");
const verifiedClientName       = document.getElementById("verifiedClientName");
const verifiedClientId         = document.getElementById("verifiedClientId");
const changeClientBtn          = document.getElementById("changeClientBtn");

// POS Billing elements
const billingSearchInput      = document.getElementById("billingSearchInput");
const billingCatalogGrid      = document.getElementById("billingCatalogGrid");
const billingCartList         = document.getElementById("billingCartList");
const ticketCountLabel        = document.getElementById("ticketCountLabel");
const billingTotalUsd         = document.getElementById("billingTotalUsd");
const billingCashbackLabel    = document.getElementById("billingCashbackLabel");
const billingCalculatedPoints = document.getElementById("billingCalculatedPoints");

const billingModeCatalogBtn         = document.getElementById("billingModeCatalogBtn");
const billingModeManualBtn          = document.getElementById("billingModeManualBtn");
const billingCatalogSearchContainer = document.getElementById("billingCatalogSearchContainer");
const billingManualContainer        = document.getElementById("billingManualContainer");
const billingManualAmountInput      = document.getElementById("billingManualAmountInput");
const billingManualConceptInput     = document.getElementById("billingManualConceptInput");

// Catalog panel & product modal
const catalogGrid           = document.getElementById("catalogGrid");
const catalogAddBtn         = document.getElementById("catalogAddBtn");
const catalogResult         = document.getElementById("catalogResult");
const productModal          = document.getElementById("productModal");
const productModalTitle     = document.getElementById("productModalTitle");
const productModalCloseBtn  = document.getElementById("productModalCloseBtn");
const productModalBackdrop  = document.getElementById("productModalBackdrop");
const productForm           = document.getElementById("productForm");
const prodId                = document.getElementById("prodId");
const prodName              = document.getElementById("prodName");
const prodPrice             = document.getElementById("prodPrice");
const prodDesc              = document.getElementById("prodDesc");
const prodSubmitBtn         = document.getElementById("prodSubmitBtn");

// Settings panel
const settingsForm         = document.getElementById("settingsForm");
const settCashbackPercent  = document.getElementById("settCashbackPercent");
const settMinRedeemPoints  = document.getElementById("settMinRedeemPoints");
const settSubmitBtn        = document.getElementById("settSubmitBtn");
const settingsResult       = document.getElementById("settingsResult");

// Modals
const copyBtn          = document.getElementById("copyBtn");
const qrCanvas         = document.getElementById("qrCanvas");
const qrImg            = document.getElementById("qrImg");
const qroModal         = document.getElementById("qroModal");
const qroModalCloseBtn = document.getElementById("qroModalCloseBtn");
const txSuccessModal   = document.getElementById("txSuccessModal");
const txSuccessCloseBtn = document.getElementById("txSuccessCloseBtn");
const setupModal       = document.getElementById("setupModal");
const setupModalBtn    = document.getElementById("setupModalBtn");

// ── State ────────────────────────────────────────────────────────────────────
let lastUrl             = "";
let pollInterval        = null;
let currentTxId         = "";
let merchantRange       = "day";
let merchantCursor      = null;
let merchantHasMore     = false;
let merchantLoadingMore = false;
let merchantConfigured  = true;
let merchantProducts    = [];
let billingCart         = [];
let merchantCashbackPercent = 5;
let billingMode         = "catalog";
let verifiedClient      = null;

// ── Helpers ──────────────────────────────────────────────────────────────────
const setLoginResult = (type, message) => {
  if (!loginResultEl) return;
  loginResultEl.className = "aResult" + (type ? ` ${type}` : "");
  loginResultEl.textContent = message;
};

const setMerchantInfo = (type, message) => {
  if (!merchantInfoEl) return;
  merchantInfoEl.className = "aResult" + (type ? ` ${type}` : "");
  merchantInfoEl.textContent = message;
};

const setResult = (type, message) => {
  if (!resultEl) return;
  resultEl.className = "aResult" + (type ? ` ${type}` : "");
  resultEl.textContent = message;
};

const setDashResult = (type, message) => {
  if (!merchantDashResultEl) return;
  merchantDashResultEl.className = "aResult" + (type ? ` ${type}` : "");
  merchantDashResultEl.textContent = message;
};

const fmtDate = (iso) => {
  const d = new Date(String(iso || ""));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const switchPanel = (panel) => {
  if (!merchantConfigured && panel !== "settings") {
    panel = "settings";
    setSettingsResult("aResult--err", "Debes configurar tu comercio primero para continuar.");
  }

  const isDash = panel === "dashboard";
  const isGen  = panel === "generator";
  const isGrant = panel === "grant";
  const isCatalog = panel === "catalog";
  const isSett = panel === "settings";

  if (mPanelDashboard) mPanelDashboard.hidden = !isDash;
  if (mPanelGenerator) mPanelGenerator.hidden = !isGen;
  if (mPanelGrantPoints) mPanelGrantPoints.hidden = !isGrant;
  if (mPanelCatalog) mPanelCatalog.hidden = !isCatalog;
  if (mPanelSettings) mPanelSettings.hidden = !isSett;

  // Sidebar
  if (mNavDashboard) mNavDashboard.classList.toggle("is-active", isDash);
  if (mNavGenerator) mNavGenerator.classList.toggle("is-active", isGen);
  if (mNavGrantPoints) mNavGrantPoints.classList.toggle("is-active", isGrant);
  if (mNavCatalog) mNavCatalog.classList.toggle("is-active", isCatalog);
  if (mNavSettings) mNavSettings.classList.toggle("is-active", isSett);

  // Mobile nav
  if (mMobNavDashboard) mMobNavDashboard.classList.toggle("is-active", isDash);
  if (mMobNavGenerator) mMobNavGenerator.classList.toggle("is-active", isGen);
  if (mMobNavGrant) mMobNavGrant.classList.toggle("is-active", isGrant);
  if (mMobNavCatalog) mMobNavCatalog.classList.toggle("is-active", isCatalog);
  if (mMobNavSettings) mMobNavSettings.classList.toggle("is-active", isSett);

  // Load settings from backend if entering settings tab
  if (isSett) {
    loadMerchantSettings();
  }

  // Load products list if entering catalog tab or grant tab (to pick items)
  if (isCatalog) {
    loadMerchantCatalog();
  }
  if (isGrant) {
    loadMerchantCatalog({ andSetupPOS: true });
    if (!verifiedClient) {
      if (billingClientSearchWrapper) billingClientSearchWrapper.hidden = false;
      if (billingMainLayout) billingMainLayout.hidden = true;
    } else {
      if (billingClientSearchWrapper) billingClientSearchWrapper.hidden = true;
      if (billingMainLayout) billingMainLayout.hidden = false;
    }
  }

  // Scroll main to top
  const main = document.querySelector(".aDash__main");
  if (main) main.scrollTop = 0;
};

// ── Range buttons ────────────────────────────────────────────────────────────
const setRangeButtons = () => {
  const map = [
    [mRangeDayBtn, "day"],
    [mRangeWeekBtn, "week"],
    [mRangeMonthBtn, "month"]
  ];
  for (const [btn, value] of map) {
    if (!btn) continue;
    btn.classList.toggle("is-active", merchantRange === value);
  }
};

const getRangeLabel = () => {
  if (merchantRange === "week") return "Semana";
  if (merchantRange === "month") return "Mes";
  return "Hoy";
};

// ── Render charges table ─────────────────────────────────────────────────────
const renderLatestCharges = (list, append = false) => {
  if (!merchantLatestChargesEl) return;
  if (!append) merchantLatestChargesEl.innerHTML = "";

  if (!Array.isArray(list) || list.length === 0) {
    if (append) return;
    const empty = document.createElement("div");
    empty.className = "aResult aResult--info";
    empty.textContent = "Todavía no hay cobros registrados.";
    merchantLatestChargesEl.appendChild(empty);
    return;
  }

  let table = merchantLatestChargesEl.querySelector(".aTxTable");
  if (!table || !append) {
    merchantLatestChargesEl.innerHTML = "";
    table = document.createElement("div");
    table.className = "aTxTable";

    const head = document.createElement("div");
    head.className = "aTxRow aTxRow--merchant aTxRow--head";
    for (const lbl of ["Fecha", "Puntos", "Estado", "ID", "Sucursal", "Descripción"]) {
      const c = document.createElement("div");
      c.className = "aTxCell";
      c.textContent = lbl;
      head.appendChild(c);
    }
    table.appendChild(head);
    merchantLatestChargesEl.appendChild(table);
  }

  for (const tx of list) {
    const row = document.createElement("div");
    row.className = "aTxRow aTxRow--merchant";

    const addCell = (label, text, cls) => {
      const c = document.createElement("div");
      c.className = "aTxCell" + (cls ? ` ${cls}` : "");
      c.setAttribute("data-label", label);
      c.textContent = text;
      row.appendChild(c);
    };

    addCell("Fecha",       fmtDate(tx?.processedAt || tx?.createdAt) || "Sin fecha", "");
    
    const isDebit = String(tx?.type || "").toLowerCase() === "pos_charge";
    const sign = isDebit ? "-" : "+";
    const ptsClass = isDebit ? "aTxCell--strong aTxCell--debit" : "aTxCell--strong aTxCell--credit";
    addCell("Puntos",      `${sign}${Number(tx?.points || 0).toFixed(2)} pts`, ptsClass);
    
    const status = String(tx?.status || "").toLowerCase();
    const statusText = (status === "success" || status === "completed") ? "Completado" : status === "pending" ? "Pendiente" : (tx?.status || "N/A");
    addCell("Estado",      statusText, "");
    addCell("ID",          String(tx?.transactionId || tx?.id || "-").slice(0, 12), "");
    addCell("Sucursal",    String(tx?.branchName || tx?.branch || "-"), "");
    addCell("Descripción", String(tx?.description || ""), "");

    table.appendChild(row);
  }
};

// ── Load dashboard data ──────────────────────────────────────────────────────
const loadMerchantDashboard = async ({ append = false } = {}) => {
  if (merchantLoadingMore) return;
  merchantLoadingMore = true;

  setDashResult("aResult--info", append ? "Cargando más cobros..." : "Actualizando dashboard...");

  try {
    const params = new URLSearchParams();
    params.set("range", merchantRange);
    params.set("limit", "8");
    if (append && merchantCursor) params.set("cursor", String(merchantCursor));

    const res = await fetch(`/api/admin/merchant-stats?${params.toString()}`, {
      cache: "no-store",
      credentials: "include"
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setDashResult("aResult--err", data?.error || data?.message || `Error (${res.status})`);
      merchantLoadingMore = false;
      return;
    }

    const dashboard = data?.dashboard || {};
    const rangeLabel = getRangeLabel();

    if (mStatChargesLabelEl)  mStatChargesLabelEl.textContent  = `Cobros ${rangeLabel}`;
    if (mStatPointsLabelEl)   mStatPointsLabelEl.textContent   = `Puntos ${rangeLabel}`;
    if (mStatCreditedLabelEl) mStatCreditedLabelEl.textContent = `Abonado ${rangeLabel}`;
    if (mStatStatusEl)        mStatStatusEl.textContent        = String(dashboard.status || "Operativo");
    if (mStatTodayChargesEl)  mStatTodayChargesEl.textContent  = String(Number(dashboard.rangeChargesCount || 0));
    if (mStatTodayPointsEl)   mStatTodayPointsEl.textContent   = Number(dashboard.rangePointsTotal || 0).toFixed(2);
    if (mStatTodayCreditedEl) mStatTodayCreditedEl.textContent = Number(dashboard.rangePointsCredited || 0).toFixed(2);

    renderLatestCharges(Array.isArray(dashboard.recentCharges) ? dashboard.recentCharges : [], append);

    merchantHasMore = Boolean(dashboard.hasMore);
    merchantCursor  = dashboard.nextCursor || null;
    if (merchantLoadMoreBtn) merchantLoadMoreBtn.hidden = !merchantHasMore;

    const pendingCount = Number(dashboard.pendingChargesCount || 0);
    setDashResult("aResult--ok", pendingCount > 0
      ? `Tienes ${pendingCount} cobro(s) pendiente(s). Vista: ${rangeLabel}.`
      : `Dashboard actualizado. Vista: ${rangeLabel}.`);
  } catch {
    setDashResult("aResult--err", "No se pudo actualizar el dashboard.");
  } finally {
    merchantLoadingMore = false;
  }
};

// ── Auth ─────────────────────────────────────────────────────────────────────
const setAuthenticated = (authenticated) => {
  if (merchantDash) merchantDash.hidden = !authenticated;
  // If not authenticated, redirect to shared login
  if (!authenticated) window.location.replace('/login');
};

const doLogout = async (e) => {
  if (e && typeof e.preventDefault === "function") e.preventDefault();
  try {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    window.location.replace('/login');
  } catch {
    window.location.replace('/login');
  }
};

const redirectByRole = (role) => {
  const r = String(role || "").toLowerCase();
  if (r === "merchant") return;          // stay here
  if (r === "cashier")  { window.location.replace('/admin/qr'); return; }
  window.location.replace('/admin');     // admin or unknown
};

const checkAuth = async () => {
  try {
    const res  = await fetch("/api/admin/me", { cache: "no-store", credentials: "include" });
    const data = await res.json().catch(() => null);

    if (!data?.authenticated) { setAuthenticated(false); return; }

    const role = String(data?.role || "").toLowerCase();
    if (role !== "merchant") { redirectByRole(role); return; }

    setAuthenticated(true);

    const isConfigured = data?.settings?.configured === true;
    if (data?.settings?.cashbackPercent) {
      merchantCashbackPercent = Number(data.settings.cashbackPercent);
    }
    if (!isConfigured) {
      merchantConfigured = false;
      if (setupModal) {
        setupModal.classList.add("profileMenu--active");
        setupModal.setAttribute("aria-hidden", "false");
      }
      switchPanel("settings");
    } else {
      merchantConfigured = true;
      switchPanel("dashboard");
      loadMerchantDashboard();
    }

    const merchantName = String(data?.name || "").trim();
    const branchName   = String(data?.branchName || "").trim();
    setMerchantInfo("aResult--info",
      merchantName && branchName ? `${merchantName} · ${branchName}` : "Sesión activa."
    );
  } catch {
    setAuthenticated(false);
  }
};

// ── QR Modal ─────────────────────────────────────────────────────────────────
const stopPolling = () => {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
};

const closeQroModal = () => {
  if (qroModal) {
    qroModal.classList.remove("profileMenu--active");
    qroModal.setAttribute("aria-hidden", "true");
  }
  stopPolling();
};

const openQroModal = () => {
  if (qroModal) {
    qroModal.classList.add("profileMenu--active");
    qroModal.setAttribute("aria-hidden", "false");
  }
};

const openSuccessModal = () => {
  if (txSuccessModal) {
    txSuccessModal.classList.add("profileMenu--active");
    txSuccessModal.setAttribute("aria-hidden", "false");
  }
};

const closeSuccessModal = () => {
  if (txSuccessModal) {
    txSuccessModal.classList.remove("profileMenu--active");
    txSuccessModal.setAttribute("aria-hidden", "true");
  }
  if (pointsEl)      pointsEl.value = "";
  if (descriptionEl) descriptionEl.value = "";
  setResult("", "");
  switchPanel("dashboard");
  loadMerchantDashboard();
};

const startPolling = (txId) => {
  stopPolling();
  currentTxId  = txId;
  pollInterval = setInterval(async () => {
    try {
      const res  = await fetch(`/api/admin/check-tx?id=${encodeURIComponent(txId)}`);
      const data = await res.json().catch(() => null);
      if (res.ok && data?.status === "success") {
        stopPolling();
        closeQroModal();
        const txBranchWrapper = document.getElementById("txBranchWrapper");
        const txBranchName    = document.getElementById("txBranchName");
        if (data.branchName && txBranchWrapper && txBranchName) {
          txBranchName.textContent = data.branchName;
          txBranchWrapper.hidden   = false;
        } else if (txBranchWrapper) {
          txBranchWrapper.hidden = true;
        }
        openSuccessModal();
      }
    } catch { }
  }, 2000);
};

const setCopyEnabled = (enabled) => {
  if (!copyBtn) return;
  copyBtn.disabled = !enabled;
};

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta    = document.createElement("textarea");
      ta.value    = text;
      ta.style.position = "fixed";
      ta.style.opacity  = "0";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch { return false; }
  }
};

// ── Event Listeners ──────────────────────────────────────────────────────────

// Sidebar navigation
if (mNavDashboard) mNavDashboard.addEventListener("click", () => {
  switchPanel("dashboard");
  loadMerchantDashboard();
});
if (mNavGenerator) mNavGenerator.addEventListener("click", () => switchPanel("generator"));
if (mNavGrantPoints) mNavGrantPoints.addEventListener("click", () => switchPanel("grant"));
if (mNavCatalog) mNavCatalog.addEventListener("click", () => switchPanel("catalog"));
if (mNavSettings) mNavSettings.addEventListener("click", () => switchPanel("settings"));

// Mobile navigation
if (mMobNavDashboard) mMobNavDashboard.addEventListener("click", () => {
  switchPanel("dashboard");
  loadMerchantDashboard();
});
if (mMobNavGenerator) mMobNavGenerator.addEventListener("click", () => switchPanel("generator"));
if (mMobNavGrant)     mMobNavGrant.addEventListener("click", () => switchPanel("grant"));
if (mMobNavCatalog)   mMobNavCatalog.addEventListener("click", () => switchPanel("catalog"));
if (mMobNavSettings)  mMobNavSettings.addEventListener("click", () => switchPanel("settings"));
if (mMobNavLogout)    mMobNavLogout.addEventListener("click", doLogout);

// Logout
if (merchantLogoutBtn) merchantLogoutBtn.addEventListener("click", doLogout);

// Setup required modal
if (setupModalBtn) {
  setupModalBtn.addEventListener("click", () => {
    if (setupModal) {
      setupModal.classList.remove("profileMenu--active");
      setupModal.setAttribute("aria-hidden", "true");
    }
    switchPanel("settings");
  });
}

// Step 1: Client search result helper
const setClientSearchResult = (type, message) => {
  if (!billingClientSearchResult) return;
  billingClientSearchResult.className = "aResult" + (type ? ` ${type}` : "");
  billingClientSearchResult.textContent = message;
};

// Step 1: Client search form listener
if (billingClientSearchForm) {
  billingClientSearchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!billingClientQuery) return;

    const query = String(billingClientQuery.value).trim();
    if (!query) {
      setClientSearchResult("aResult--err", "Por favor ingresa una cédula o tarjeta.");
      return;
    }

    setClientSearchResult("aResult--info", "Buscando cliente...");
    if (billingClientSearchBtn) billingClientSearchBtn.disabled = true;

    try {
      const res = await fetch(`/api/admin/cards?q=${encodeURIComponent(query)}&limit=1`, {
        cache: "no-store",
        credentials: "include"
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setClientSearchResult("aResult--err", data?.error || "Error al buscar cliente.");
        return;
      }

      const cards = data?.cards || [];
      if (cards.length === 0) {
        setClientSearchResult("aResult--err", "Cliente no encontrado. Asegúrate de ingresar una cédula o token de tarjeta registrada.");
        return;
      }

      // Found customer!
      verifiedClient = cards[0];
      
      // Update form hidden token
      if (grantClientToken) grantClientToken.value = verifiedClient.token;

      // Update Digital Receipt Banner
      if (verifiedClientName) verifiedClientName.textContent = verifiedClient.name || "Cliente sin nombre";
      if (verifiedClientId) {
        verifiedClientId.textContent = verifiedClient.cedula 
          ? `Cédula: ${verifiedClient.cedula}` 
          : `Tarjeta: ${verifiedClient.token}`;
      }

      // Switch screens
      setClientSearchResult("", "");
      if (billingClientQuery) billingClientQuery.value = "";
      if (billingClientSearchWrapper) billingClientSearchWrapper.hidden = true;
      if (billingMainLayout) billingMainLayout.hidden = false;

      // Reset billing cart & mode
      billingCart = [];
      if (billingManualAmountInput) billingManualAmountInput.value = "";
      if (billingManualConceptInput) billingManualConceptInput.value = "";
      updateCartUI();

    } catch (err) {
      setClientSearchResult("aResult--err", "Fallo de red al buscar el cliente.");
    } finally {
      if (billingClientSearchBtn) billingClientSearchBtn.disabled = false;
    }
  });
}

// Step 2: "Cambiar" Client button
if (changeClientBtn) {
  changeClientBtn.addEventListener("click", () => {
    verifiedClient = null;
    if (grantClientToken) grantClientToken.value = "";
    if (billingClientSearchWrapper) billingClientSearchWrapper.hidden = false;
    if (billingMainLayout) billingMainLayout.hidden = true;

    // Reset fields
    billingCart = [];
    if (billingManualAmountInput) billingManualAmountInput.value = "";
    if (billingManualConceptInput) billingManualConceptInput.value = "";
    updateCartUI();
  });
}

// Dashboard controls
if (merchantRefreshBtn) merchantRefreshBtn.addEventListener("click", () => loadMerchantDashboard({ append: false }));
if (merchantLoadMoreBtn) merchantLoadMoreBtn.addEventListener("click", () => {
  if (!merchantHasMore) return;
  loadMerchantDashboard({ append: true });
});

// Range filter
if (mRangeDayBtn) mRangeDayBtn.addEventListener("click", () => {
  merchantRange = "day"; setRangeButtons(); loadMerchantDashboard({ append: false });
});
if (mRangeWeekBtn) mRangeWeekBtn.addEventListener("click", () => {
  merchantRange = "week"; setRangeButtons(); loadMerchantDashboard({ append: false });
});
if (mRangeMonthBtn) mRangeMonthBtn.addEventListener("click", () => {
  merchantRange = "month"; setRangeButtons(); loadMerchantDashboard({ append: false });
});
setRangeButtons();

// QR modal
if (qroModalCloseBtn) {
  qroModalCloseBtn.addEventListener("click", async () => {
    if (currentTxId) {
      const loaderText = document.getElementById("qroLoaderText");
      if (loaderText) loaderText.textContent = "Cancelando cobro...";
      qroModalCloseBtn.disabled = true;
      try {
        await fetch("/api/admin/cancel-tx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ transactionId: currentTxId })
        });
      } catch { }
      qroModalCloseBtn.disabled = false;
      if (loaderText) loaderText.textContent = "Esperando escaneo...";
    }
    closeQroModal();
  });
}

if (txSuccessCloseBtn) txSuccessCloseBtn.addEventListener("click", closeSuccessModal);

if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    if (!lastUrl) return;
    const ok = await copyText(lastUrl);
    setResult(ok ? "aResult--ok" : "aResult--err", ok ? "Link copiado." : "No se pudo copiar el link.");
  });
}

// QR Form submission
if (qrForm) {
  qrForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setCopyEnabled(false);
    lastUrl = "";

    const wrap = document.getElementById("qrWrap");
    if (wrap)    wrap.hidden = true;
    if (qrCanvas) qrCanvas.hidden = true;
    if (qrImg)  { qrImg.src = ""; qrImg.hidden = true; }

    const points      = Number(String(pointsEl?.value ?? "").trim());
    const description = String(descriptionEl?.value ?? "").trim();

    if (!Number.isFinite(points) || points <= 0) {
      setResult("aResult--err", "Puntos inválidos.");
      return;
    }

    setResult("aResult--info", "Generando...");

    try {
      const res  = await fetch("/api/admin/mint-charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ points, description })
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          setAuthenticated(false);
          setLoginResult("aResult--err", "Sesión expirada. Inicia sesión de nuevo.");
        }
        setResult("aResult--err", data?.error || data?.message || `Error (${res.status})`);
        return;
      }

      const urlPath      = String(data?.url ?? "").trim();
      if (!urlPath) { setResult("aResult--err", "No se pudo generar."); return; }

      const transactionId  = String(data?.transactionId ?? "").trim();
      const fullUrl        = `${window.location.origin}${urlPath}`;
      lastUrl              = fullUrl;

      const qrPngDataUrl = String(data?.qrPngDataUrl ?? "").trim();
      if (qrImg && qrPngDataUrl.startsWith("data:image/")) {
        qrImg.src          = qrPngDataUrl;
        qrImg.hidden       = false;
        qrImg.style.display = "block";
        if (wrap) { wrap.hidden = false; wrap.style.display = "flex"; }
      }

      setCopyEnabled(true);
      setResult("aResult--ok", "QR listo, esperando escaneo...");
      openQroModal();
      if (transactionId) startPolling(transactionId);
    } catch {
      setResult("aResult--err", "Fallo de red.");
    }
  });
}

const setGrantResult = (type, message) => {
  if (!grantResult) return;
  grantResult.className = "aResult" + (type ? ` ${type}` : "");
  grantResult.textContent = message;
};

// Grant Form submission (POS Billing Checkout - Support Catalog & Manual)
if (grantForm) {
  grantForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!grantClientToken) return;

    const token = String(grantClientToken.value).trim();

    if (!token) {
      setGrantResult("aResult--err", "Token o Tarjeta del Cliente es requerido.");
      return;
    }

    let totalUsdVal = 0;
    let itemsPayload = [];

    if (billingMode === "manual") {
      totalUsdVal = Number(billingManualAmountInput?.value || 0);
      if (totalUsdVal <= 0 || Number.isNaN(totalUsdVal)) {
        setGrantResult("aResult--err", "Ingresa un monto de venta manual válido.");
        return;
      }
      const concept = (billingManualConceptInput?.value || "").trim() || "Consumo General";
      itemsPayload = [{
        name: concept,
        price: totalUsdVal,
        quantity: 1
      }];
    } else {
      if (billingCart.length === 0) {
        setGrantResult("aResult--err", "El ticket de venta está vacío. Selecciona productos.");
        return;
      }
      billingCart.forEach(it => {
        totalUsdVal += it.price * it.quantity;
      });
      itemsPayload = billingCart;
    }

    const calculatedPoints = Math.round(totalUsdVal * merchantCashbackPercent);

    if (calculatedPoints <= 0) {
      setGrantResult("aResult--err", "El monto de la venta es insuficiente para otorgar puntos.");
      return;
    }

    setGrantResult("aResult--info", "Procesando venta y cashback...");
    if (grantSubmitBtn) grantSubmitBtn.disabled = true;

    try {
      const res = await fetch("/api/admin/manual-credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          token, 
          points: calculatedPoints, 
          items: itemsPayload,
          totalUsd: totalUsdVal
        })
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          setAuthenticated(false);
          setLoginResult("aResult--err", "Sesión expirada. Inicia sesión de nuevo.");
        }
        setGrantResult("aResult--err", data?.error || data?.message || `Error (${res.status})`);
        return;
      }

      setGrantResult("aResult--ok", data?.message || `Venta registrada y ${calculatedPoints} puntos otorgados exitosamente.`);
      
      // Clear fields on success
      grantClientToken.value = "";
      verifiedClient = null;
      if (billingClientSearchWrapper) billingClientSearchWrapper.hidden = false;
      if (billingMainLayout) billingMainLayout.hidden = true;
      
      if (billingMode === "manual") {
        if (billingManualAmountInput) billingManualAmountInput.value = "";
        if (billingManualConceptInput) billingManualConceptInput.value = "";
      } else {
        billingCart = [];
      }
      
      updateCartUI();

      // Refresh dashboard stats after brief delay
      setTimeout(() => {
        loadMerchantDashboard();
      }, 1000);

    } catch (err) {
      setGrantResult("aResult--err", "Fallo de red al registrar la venta.");
    } finally {
      if (grantSubmitBtn) grantSubmitBtn.disabled = false;
    }
  });
}

const setSettingsResult = (type, message) => {
  if (!settingsResult) return;
  settingsResult.className = "aResult" + (type ? ` ${type}` : "");
  settingsResult.textContent = message;
};

// Fetch current settings from database
const loadMerchantSettings = async () => {
  setSettingsResult("aResult--info", "Cargando configuración...");
  if (settSubmitBtn) settSubmitBtn.disabled = true;

  try {
    const res = await fetch("/api/admin/merchant-settings", {
      cache: "no-store",
      credentials: "include"
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      if (res.status === 401) {
        setAuthenticated(false);
        setLoginResult("aResult--err", "Sesión expirada. Inicia sesión de nuevo.");
      }
      setSettingsResult("aResult--err", data?.error || "Error al cargar la configuración.");
      return;
    }

    const s = data?.settings || {};
    if (settMinRedeemPoints) settMinRedeemPoints.value = Number(s.minRedeemPoints ?? 0);
    if (settCashbackPercent) {
      settCashbackPercent.value = Number(s.cashbackPercent ?? 5);
      merchantCashbackPercent = Number(s.cashbackPercent ?? 5);
    }

    setSettingsResult("", "");
  } catch (err) {
    setSettingsResult("aResult--err", "Fallo de red al cargar configuración.");
  } finally {
    if (settSubmitBtn) settSubmitBtn.disabled = false;
  }
};

// Submit settings updates
if (settingsForm) {
  settingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!settMinRedeemPoints || !settCashbackPercent) return;

    const cashbackPercent = Number(settCashbackPercent.value);
    const minRedeemPoints = Number(settMinRedeemPoints.value);

    if (!Number.isFinite(cashbackPercent) || cashbackPercent <= 0 || cashbackPercent > 100) {
      setSettingsResult("aResult--err", "El porcentaje de cashback debe estar entre 0.1% y 100%.");
      return;
    }
    if (!Number.isFinite(minRedeemPoints) || minRedeemPoints < 0) {
      setSettingsResult("aResult--err", "El mínimo de puntos debe ser igual o mayor a cero.");
      return;
    }

    setSettingsResult("aResult--info", "Guardando cambios...");
    if (settSubmitBtn) settSubmitBtn.disabled = true;

    try {
      const res = await fetch("/api/admin/merchant-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          settings: {
            cashbackPercent,
            minRedeemPoints
          }
        })
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          setAuthenticated(false);
          setLoginResult("aResult--err", "Sesión expirada. Inicia sesión de nuevo.");
        }
        setSettingsResult("aResult--err", data?.error || "Error al guardar configuración.");
        return;
      }

      setSettingsResult("aResult--ok", "¡Configuración guardada exitosamente!");
      merchantConfigured = true;
      merchantCashbackPercent = cashbackPercent;
      setTimeout(() => {
        switchPanel("dashboard");
        loadMerchantDashboard();
      }, 1200);
    } catch (err) {
      setSettingsResult("aResult--err", "Fallo de red al guardar la configuración.");
    } finally {
      if (settSubmitBtn) settSubmitBtn.disabled = false;
    }
  });
}

// ── Catalog & POS Billing Systems ───────────────────────────────────────────
const setCatalogResult = (type, message) => {
  if (!catalogResult) return;
  catalogResult.className = "aResult" + (type ? ` ${type}` : "");
  catalogResult.textContent = message;
};

// Fetch products from database
const loadMerchantCatalog = async (opts = {}) => {
  if (catalogResult) setCatalogResult("aResult--info", "Cargando catálogo...");
  
  try {
    const res = await fetch("/api/admin/merchant-products", {
      cache: "no-store",
      credentials: "include"
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      if (catalogResult) setCatalogResult("aResult--err", data?.error || "Error al cargar el catálogo.");
      return;
    }

    merchantProducts = data?.products || [];
    if (catalogResult) setCatalogResult("", "");
    
    // Render either the Catalog view or the POS Picker view
    if (opts.andSetupPOS) {
      renderPOSCatalog();
    } else {
      renderCatalogGrid();
    }
  } catch (err) {
    if (catalogResult) setCatalogResult("aResult--err", "Error de red al cargar catálogo.");
  }
};

// Render Products inside Catalog panel
const renderCatalogGrid = () => {
  if (!catalogGrid) return;
  
  if (merchantProducts.length === 0) {
    catalogGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px; background: rgba(255,255,255,0.02); border-radius: 16px; border: 1px dashed rgba(255,255,255,0.1);">
        <p style="color: rgba(255,255,255,0.4); margin: 0 0 16px; font-size: 15px;">Aún no tienes productos en tu catálogo.</p>
        <button class="aBtn aBtn--primary" onclick="openProductModal()" style="margin: 0; min-width: 150px;">Añadir Primero</button>
      </div>
    `;
    return;
  }

  catalogGrid.innerHTML = merchantProducts.map(p => `
    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 12px; justify-content: space-between; transition: all 0.2s;">
      <div>
        <h4 style="font-size: 16px; font-weight: 700; color: #ffffff; margin: 0 0 4px 0;">${escapeHtml(p.name)}</h4>
        <p style="font-size: 13px; color: rgba(255,255,255,0.5); line-height: 1.4; margin: 0; min-height: 36px;">${escapeHtml(p.description || "Sin descripción")}</p>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px; margin-top: 4px;">
        <span style="font-size: 18px; font-weight: 700; color: #fbbf24;">$${Number(p.price).toFixed(2)}</span>
        <div style="display: flex; gap: 8px;">
          <button class="aBtn" onclick="openProductModal('${p.id}')" style="padding: 6px 12px; font-size: 12px; margin: 0; background: rgba(255,255,255,0.05); color: #ffffff; border: 1px solid rgba(255,255,255,0.1);">
            Editar
          </button>
          <button class="aBtn" onclick="deleteCatalogProduct('${p.id}')" style="padding: 6px 12px; font-size: 12px; margin: 0; background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2);">
            Eliminar
          </button>
        </div>
      </div>
    </div>
  `).join("");
};

const escapeHtml = (str) => {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const openProductModal = (id = "") => {
  if (!productModal) return;
  
  if (productForm) productForm.reset();
  if (prodId) prodId.value = id;
  
  if (id) {
    if (productModalTitle) productModalTitle.textContent = "Editar Producto";
    const prod = merchantProducts.find(p => p.id === id);
    if (prod) {
      if (prodName) prodName.value = prod.name;
      if (prodPrice) prodPrice.value = prod.price;
      if (prodDesc) prodDesc.value = prod.description || "";
    }
  } else {
    if (productModalTitle) productModalTitle.textContent = "Añadir Producto";
  }
  
  productModal.classList.add("profileMenu--active");
  productModal.setAttribute("aria-hidden", "false");
};

const closeProductModal = () => {
  if (productModal) {
    productModal.classList.remove("profileMenu--active");
    productModal.setAttribute("aria-hidden", "true");
  }
};

if (productForm) {
  productForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!prodName || !prodPrice) return;
    
    const id = prodId?.value || "";
    const name = prodName.value.trim();
    const price = Number(prodPrice.value);
    const description = prodDesc?.value.trim() || "";
    
    if (!name || Number.isNaN(price) || price < 0) {
      alert("Por favor, ingresa un nombre y un precio válido.");
      return;
    }
    
    if (prodSubmitBtn) prodSubmitBtn.disabled = true;
    
    try {
      const url = "/api/admin/merchant-products";
      const method = id ? "PUT" : "POST";
      const payload = { name, price, description };
      if (id) payload.id = id;
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => null);
      
      if (!res.ok) {
        alert(data?.error || "Error al guardar el producto.");
        return;
      }
      
      closeProductModal();
      loadMerchantCatalog();
    } catch (err) {
      alert("Error de red al guardar el producto.");
    } finally {
      if (prodSubmitBtn) prodSubmitBtn.disabled = false;
    }
  });
}

const deleteCatalogProduct = async (id) => {
  if (!confirm("¿Estás seguro de que deseas eliminar este producto del catálogo?")) return;
  
  try {
    const res = await fetch("/api/admin/merchant-products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id })
    });
    const data = await res.json().catch(() => null);
    
    if (!res.ok) {
      alert(data?.error || "Error al eliminar el producto.");
      return;
    }
    
    loadMerchantCatalog();
  } catch (err) {
    alert("Error de red al eliminar el producto.");
  }
};

// Render products list inside POS picker
const renderPOSCatalog = (filterText = "") => {
  if (!billingCatalogGrid) return;
  
  const filtered = merchantProducts.filter(p => 
    p.name.toLowerCase().includes(filterText.toLowerCase()) ||
    (p.description || "").toLowerCase().includes(filterText.toLowerCase())
  );
  
  if (filtered.length === 0) {
    billingCatalogGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 24px; color: rgba(255,255,255,0.4); font-size: 14px;">
        No se encontraron productos.
      </div>
    `;
    return;
  }

  billingCatalogGrid.innerHTML = filtered.map(p => {
    const cartItem = billingCart.find(item => item.id === p.id);
    const qty = cartItem ? cartItem.quantity : 0;
    
    return `
      <div style="background: rgba(255,255,255,0.03); border: 1px solid ${qty > 0 ? "rgba(233,46,134,0.4)" : "rgba(255,255,255,0.06)"}; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px; justify-content: space-between; transition: all 0.2s;">
        <div>
          <h4 style="font-size: 14px; font-weight: 700; color: #ffffff; margin: 0 0 2px 0;">${escapeHtml(p.name)}</h4>
          <span style="font-size: 15px; font-weight: 700; color: #fbbf24;">$${Number(p.price).toFixed(2)}</span>
        </div>
        <div>
          ${qty > 0 ? `
            <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(233,46,134,0.1); border-radius: 8px; padding: 4px 8px; border: 1px solid rgba(233,46,134,0.2);">
              <button type="button" onclick="updateCartQuantity('${p.id}', -1)" style="background: none; border: none; color: #e92e86; font-size: 16px; font-weight: 700; cursor: pointer; padding: 0 6px;">-</button>
              <span style="font-size: 14px; font-weight: 700; color: #ffffff;">${qty}</span>
              <button type="button" onclick="updateCartQuantity('${p.id}', 1)" style="background: none; border: none; color: #e92e86; font-size: 16px; font-weight: 700; cursor: pointer; padding: 0 6px;">+</button>
            </div>
          ` : `
            <button type="button" onclick="addToCart('${p.id}')" class="aBtn" style="width: 100%; margin: 0; padding: 6px 12px; font-size: 12px; background: rgba(255,255,255,0.05); color: #ffffff; border: 1px solid rgba(255,255,255,0.1);">
              + Añadir
            </button>
          `}
        </div>
      </div>
    `;
  }).join("");
};

// Add item to shopping cart
const addToCart = (id) => {
  const prod = merchantProducts.find(p => p.id === id);
  if (!prod) return;
  
  billingCart.push({
    id: prod.id,
    name: prod.name,
    price: prod.price,
    quantity: 1
  });
  
  updateCartUI();
  renderPOSCatalog(billingSearchInput?.value || "");
};

// Update cart quantity
const updateCartQuantity = (id, delta) => {
  const item = billingCart.find(it => it.id === id);
  if (!item) return;
  
  item.quantity += delta;
  if (item.quantity <= 0) {
    billingCart = billingCart.filter(it => it.id !== id);
  }
  
  updateCartUI();
  renderPOSCatalog(billingSearchInput?.value || "");
};

// Remove item completely from cart
const removeFromCart = (id) => {
  billingCart = billingCart.filter(it => it.id !== id);
  updateCartUI();
  renderPOSCatalog(billingSearchInput?.value || "");
};

// Update Cart Receipt details (Catalog and Manual modes)
const updateCartUI = () => {
  if (!billingCartList || !ticketCountLabel || !billingTotalUsd || !billingCalculatedPoints || !billingCashbackLabel) return;
  
  billingCashbackLabel.textContent = `${merchantCashbackPercent.toFixed(1)}%`;
  
  if (billingMode === "manual") {
    const manualAmount = Number(billingManualAmountInput?.value || 0);
    const concept = (billingManualConceptInput?.value || "").trim() || "Consumo General";
    
    ticketCountLabel.textContent = "1 item";
    
    if (manualAmount <= 0 || Number.isNaN(manualAmount)) {
      billingCartList.innerHTML = `
        <div style="text-align: center; padding: 40px 0; color: rgba(255,255,255,0.3); font-size: 14px;">
          Ingresa un monto válido a la izquierda.
        </div>
      `;
      billingTotalUsd.textContent = "$0.00 USD";
      billingCalculatedPoints.textContent = "0 pts";
      if (grantSubmitBtn) grantSubmitBtn.disabled = true;
      return;
    }
    
    billingCartList.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); padding: 12px 16px; border-radius: 8px;">
        <div>
          <div style="font-size: 13px; font-weight: 700; color: #ffffff;">${escapeHtml(concept)}</div>
          <div style="font-size: 11px; color: rgba(255,255,255,0.4);">Monto facturado manualmente</div>
        </div>
        <span style="font-size: 14px; font-weight: 700; color: #fbbf24;">$${manualAmount.toFixed(2)}</span>
      </div>
    `;
    
    const calculatedPoints = Math.round(manualAmount * merchantCashbackPercent);
    billingTotalUsd.textContent = `$${manualAmount.toFixed(2)} USD`;
    billingCalculatedPoints.textContent = `${calculatedPoints} pts`;
    if (grantSubmitBtn) grantSubmitBtn.disabled = false;
    
  } else {
    ticketCountLabel.textContent = `${billingCart.reduce((acc, it) => acc + it.quantity, 0)} items`;
    
    if (billingCart.length === 0) {
      billingCartList.innerHTML = `
        <div style="text-align: center; padding: 40px 0; color: rgba(255,255,255,0.3); font-size: 14px;">
          El ticket está vacío.<br>Selecciona productos a la izquierda.
        </div>
      `;
      billingTotalUsd.textContent = "$0.00 USD";
      billingCalculatedPoints.textContent = "0 pts";
      if (grantSubmitBtn) grantSubmitBtn.disabled = true;
      return;
    }
    
    let totalUsdVal = 0;
    
    billingCartList.innerHTML = billingCart.map(it => {
      const subtotal = it.price * it.quantity;
      totalUsdVal += subtotal;
      
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); padding: 8px 12px; border-radius: 8px;">
          <div>
            <div style="font-size: 13px; font-weight: 700; color: #ffffff;">${escapeHtml(it.name)}</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.4);">${it.quantity}x $${Number(it.price).toFixed(2)}</div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 13px; font-weight: 700; color: #ffffff;">$${subtotal.toFixed(2)}</span>
            <button type="button" onclick="removeFromCart('${it.id}')" style="background: none; border: none; color: #ef4444; font-size: 14px; cursor: pointer; padding: 4px;">✕</button>
          </div>
        </div>
      `;
    }).join("");
    
    const calculatedPoints = Math.round(totalUsdVal * merchantCashbackPercent);
    
    billingTotalUsd.textContent = `$${totalUsdVal.toFixed(2)} USD`;
    billingCalculatedPoints.textContent = `${calculatedPoints} pts`;
    if (grantSubmitBtn) grantSubmitBtn.disabled = false;
  }
};

// Mode Switcher handlers
const setBillingMode = (mode) => {
  billingMode = mode;
  
  if (mode === "manual") {
    if (billingModeCatalogBtn) {
      billingModeCatalogBtn.style.background = "none";
      billingModeCatalogBtn.style.color = "rgba(255,255,255,0.6)";
    }
    if (billingModeManualBtn) {
      billingModeManualBtn.style.background = "rgba(233,46,134,0.1)";
      billingModeManualBtn.style.color = "#e92e86";
    }
    if (billingCatalogSearchContainer) billingCatalogSearchContainer.hidden = true;
    if (billingManualContainer) billingManualContainer.hidden = false;
  } else {
    if (billingModeCatalogBtn) {
      billingModeCatalogBtn.style.background = "rgba(233,46,134,0.1)";
      billingModeCatalogBtn.style.color = "#e92e86";
    }
    if (billingModeManualBtn) {
      billingModeManualBtn.style.background = "none";
      billingModeManualBtn.style.color = "rgba(255,255,255,0.6)";
    }
    if (billingCatalogSearchContainer) billingCatalogSearchContainer.hidden = false;
    if (billingManualContainer) billingManualContainer.hidden = true;
  }
  
  updateCartUI();
};

if (billingModeCatalogBtn) {
  billingModeCatalogBtn.addEventListener("click", () => setBillingMode("catalog"));
}
if (billingModeManualBtn) {
  billingModeManualBtn.addEventListener("click", () => setBillingMode("manual"));
}

// Live calculation inputs for manual billing
if (billingManualAmountInput) {
  billingManualAmountInput.addEventListener("input", updateCartUI);
}
if (billingManualConceptInput) {
  billingManualConceptInput.addEventListener("input", updateCartUI);
}

// Bind elements
if (billingSearchInput) {
  billingSearchInput.addEventListener("input", (e) => {
    renderPOSCatalog(e.target.value);
  });
}
if (catalogAddBtn) {
  catalogAddBtn.addEventListener("click", () => openProductModal());
}
if (productModalCloseBtn) {
  productModalCloseBtn.addEventListener("click", closeProductModal);
}
if (productModalBackdrop) {
  productModalBackdrop.addEventListener("click", closeProductModal);
}

// Make them globally available
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.deleteCatalogProduct = deleteCatalogProduct;
window.addToCart = addToCart;
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;
window.setBillingMode = setBillingMode;

// ── Init ─────────────────────────────────────────────────────────────────────
checkAuth();
