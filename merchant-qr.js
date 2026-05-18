// ── DOM References ──────────────────────────────────────────────────────────
const merchantDash       = document.getElementById("merchantDash");
const mPanelDashboard    = document.getElementById("mPanelDashboard");
const mPanelGenerator    = document.getElementById("mPanelGenerator");
const mPanelGrantPoints  = document.getElementById("mPanelGrantPoints");
const mPanelSettings    = document.getElementById("mPanelSettings");

// Sidebar nav
const mNavDashboard      = document.getElementById("mNavDashboard");
const mNavGenerator      = document.getElementById("mNavGenerator");
const mNavGrantPoints    = document.getElementById("mNavGrantPoints");
const mNavSettings       = document.getElementById("mNavSettings");
const merchantLogoutBtn  = document.getElementById("merchantLogoutBtn");

// Mobile nav
const mMobNavDashboard   = document.getElementById("mMobNavDashboard");
const mMobNavGenerator   = document.getElementById("mMobNavGenerator");
const mMobNavGrant       = document.getElementById("mMobNavGrant");
const mMobNavSettings    = document.getElementById("mMobNavSettings");
const mMobNavLogout      = document.getElementById("mMobNavLogout");

// Dashboard panel
const merchantInfoEl         = document.getElementById("merchantInfo");
const merchantDashResultEl   = document.getElementById("merchantDashResult");
const mStatStatusEl          = document.getElementById("mStatStatus");
const mStatChargesLabelEl    = document.getElementById("mStatChargesLabel");
const mStatPointsLabelEl     = document.getElementById("mStatPointsLabel");
const mStatTodayChargesEl    = document.getElementById("mStatTodayCharges");
const mStatTodayPointsEl     = document.getElementById("mStatTodayPoints");
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
const grantPoints      = document.getElementById("grantPoints");
const grantPassword    = document.getElementById("grantPassword");
const grantSubmitBtn   = document.getElementById("grantSubmitBtn");
const grantResult      = document.getElementById("grantResult");

// Settings panel
const settingsForm       = document.getElementById("settingsForm");
const settPointsPerDollar = document.getElementById("settPointsPerDollar");
const settMinRedeemPoints = document.getElementById("settMinRedeemPoints");
const settSubmitBtn      = document.getElementById("settSubmitBtn");
const settingsResult     = document.getElementById("settingsResult");

// Modals
const copyBtn          = document.getElementById("copyBtn");
const qrCanvas         = document.getElementById("qrCanvas");
const qrImg            = document.getElementById("qrImg");
const qroModal         = document.getElementById("qroModal");
const qroModalCloseBtn = document.getElementById("qroModalCloseBtn");
const txSuccessModal   = document.getElementById("txSuccessModal");
const txSuccessCloseBtn = document.getElementById("txSuccessCloseBtn");

// ── State ────────────────────────────────────────────────────────────────────
let lastUrl          = "";
let pollInterval     = null;
let currentTxId      = "";
let merchantRange    = "day";
let merchantCursor   = null;
let merchantHasMore  = false;
let merchantLoadingMore = false;

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
  const isDash = panel === "dashboard";
  const isGen  = panel === "generator";
  const isGrant = panel === "grant";
  const isSett = panel === "settings";

  if (mPanelDashboard) mPanelDashboard.hidden = !isDash;
  if (mPanelGenerator) mPanelGenerator.hidden = !isGen;
  if (mPanelGrantPoints) mPanelGrantPoints.hidden = !isGrant;
  if (mPanelSettings) mPanelSettings.hidden = !isSett;

  // Sidebar
  if (mNavDashboard) mNavDashboard.classList.toggle("is-active", isDash);
  if (mNavGenerator) mNavGenerator.classList.toggle("is-active", isGen);
  if (mNavGrantPoints) mNavGrantPoints.classList.toggle("is-active", isGrant);
  if (mNavSettings) mNavSettings.classList.toggle("is-active", isSett);

  // Mobile nav
  if (mMobNavDashboard) mMobNavDashboard.classList.toggle("is-active", isDash);
  if (mMobNavGenerator) mMobNavGenerator.classList.toggle("is-active", isGen);
  if (mMobNavGrant) mMobNavGrant.classList.toggle("is-active", isGrant);
  if (mMobNavSettings) mMobNavSettings.classList.toggle("is-active", isSett);

  // Load settings from backend if entering settings tab
  if (isSett) {
    loadMerchantSettings();
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
    addCell("Puntos",      `${Number(tx?.points || 0).toFixed(2)} pts`, "aTxCell--strong");
    const status = String(tx?.status || "").toLowerCase();
    addCell("Estado",      status === "success" ? "Completado" : status === "pending" ? "Pendiente" : (tx?.status || "N/A"), "");
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

    if (mStatChargesLabelEl) mStatChargesLabelEl.textContent = `Cobros ${rangeLabel}`;
    if (mStatPointsLabelEl)  mStatPointsLabelEl.textContent  = `Puntos ${rangeLabel}`;
    if (mStatStatusEl)       mStatStatusEl.textContent        = String(dashboard.status || "Operativo");
    if (mStatTodayChargesEl) mStatTodayChargesEl.textContent  = String(Number(dashboard.rangeChargesCount || 0));
    if (mStatTodayPointsEl)  mStatTodayPointsEl.textContent   = Number(dashboard.rangePointsTotal || 0).toFixed(2);

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
    switchPanel("dashboard");
    loadMerchantDashboard();

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
if (mNavSettings) mNavSettings.addEventListener("click", () => switchPanel("settings"));

// Mobile navigation
if (mMobNavDashboard) mMobNavDashboard.addEventListener("click", () => {
  switchPanel("dashboard");
  loadMerchantDashboard();
});
if (mMobNavGenerator) mMobNavGenerator.addEventListener("click", () => switchPanel("generator"));
if (mMobNavGrant)     mMobNavGrant.addEventListener("click", () => switchPanel("grant"));
if (mMobNavSettings)  mMobNavSettings.addEventListener("click", () => switchPanel("settings"));
if (mMobNavLogout)    mMobNavLogout.addEventListener("click", doLogout);

// Logout
if (merchantLogoutBtn) merchantLogoutBtn.addEventListener("click", doLogout);

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

// Grant Form submission
if (grantForm) {
  grantForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!grantClientToken || !grantPoints || !grantPassword) return;

    const token = String(grantClientToken.value).trim();
    const points = Number(String(grantPoints.value).trim());
    const password = String(grantPassword.value).trim();

    if (!token) {
      setGrantResult("aResult--err", "Token o Identificador del Cliente es requerido.");
      return;
    }

    if (!Number.isFinite(points) || points <= 0) {
      setGrantResult("aResult--err", "Puntos inválidos.");
      return;
    }

    if (!password) {
      setGrantResult("aResult--err", "Clave de seguridad requerida.");
      return;
    }

    setGrantResult("aResult--info", "Procesando abono...");
    if (grantSubmitBtn) grantSubmitBtn.disabled = true;

    try {
      const res = await fetch("/api/admin/manual-credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, points, password })
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

      setGrantResult("aResult--ok", data?.message || `Se han abonado ${points} puntos exitosamente.`);
      
      // Clear fields on success
      grantClientToken.value = "";
      grantPoints.value = "";
      grantPassword.value = "";

      // Refresh dashboard stats after brief delay
      setTimeout(() => {
        loadMerchantDashboard();
      }, 1000);

    } catch (err) {
      setGrantResult("aResult--err", "Fallo de red al procesar el abono.");
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
    if (settPointsPerDollar) settPointsPerDollar.value = Number(s.pointsPerDollar ?? 1);
    if (settMinRedeemPoints) settMinRedeemPoints.value = Number(s.minRedeemPoints ?? 0);

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
    if (!settPointsPerDollar || !settMinRedeemPoints) return;

    const pointsPerDollar = Number(settPointsPerDollar.value);
    const minRedeemPoints = Number(settMinRedeemPoints.value);

    if (!Number.isFinite(pointsPerDollar) || pointsPerDollar <= 0) {
      setSettingsResult("aResult--err", "Puntos por dólar debe ser mayor a cero.");
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
            pointsPerDollar,
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
    } catch (err) {
      setSettingsResult("aResult--err", "Fallo de red al guardar la configuración.");
    } finally {
      if (settSubmitBtn) settSubmitBtn.disabled = false;
    }
  });
}

// ── Init ─────────────────────────────────────────────────────────────────────
checkAuth();
