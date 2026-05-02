const loginForm = document.getElementById("loginForm");
const adminEmailEl = document.getElementById("adminEmail");
const adminPasswordEl = document.getElementById("adminPassword");
const loginResultEl = document.getElementById("loginResult");
const qrSection = document.getElementById("qrSection");
const qrForm = document.getElementById("qrForm");
const pointsEl = document.getElementById("points");
const descriptionEl = document.getElementById("description");
const resultEl = document.getElementById("result");
const copyBtn = document.getElementById("copyBtn");
const qrCanvas = document.getElementById("qrCanvas");
const qrImg = document.getElementById("qrImg");
const qroModal = document.getElementById("qroModal");
const qroModalCloseBtn = document.getElementById("qroModalCloseBtn");
const txSuccessModal = document.getElementById("txSuccessModal");
const txSuccessCloseBtn = document.getElementById("txSuccessCloseBtn");
let lastUrl = "";
let pollInterval = null;
let currentTxId = "";
const setLoginResult = (type, message) => {
  if (!loginResultEl) return;
  loginResultEl.classList.remove("adminResult--ok", "adminResult--err", "adminResult--info");
  loginResultEl.classList.add(type);
  loginResultEl.textContent = message;
};
const setResult = (type, message) => {
  if (!resultEl) return;
  resultEl.classList.remove("adminResult--ok", "adminResult--err", "adminResult--info");
  resultEl.classList.add(type);
  resultEl.textContent = message;
};
const setAuthenticated = (authenticated) => {
  const loginCard = document.getElementById("loginCard");
  if (loginCard) loginCard.hidden = authenticated;
  if (!qrSection) return;
  qrSection.hidden = !authenticated;
};
const setCopyEnabled = (enabled) => {
  if (!copyBtn) return;
  copyBtn.disabled = !enabled;
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
  if (pointsEl) pointsEl.value = "";
  if (descriptionEl) descriptionEl.value = "";
  setResult("", "");
};
const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
};
const startPolling = (txId) => {
  stopPolling();
  currentTxId = txId;
  pollInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/admin/check-tx?id=${encodeURIComponent(txId)}`);
      const data = await res.json().catch(() => null);
      if (res.ok && (data == null ? void 0 : data.status) === "success") {
        stopPolling();
        closeQroModal();
        const txBranchWrapper = document.getElementById("txBranchWrapper");
        const txBranchName = document.getElementById("txBranchName");
        if (data.branchName && txBranchWrapper && txBranchName) {
            txBranchName.textContent = data.branchName;
            txBranchWrapper.hidden = false;
        } else if (txBranchWrapper) {
            txBranchWrapper.hidden = true;
        }
        openSuccessModal();
      }
    } catch {
    }
  }, 2e3);
};
if (qroModalCloseBtn) {
  qroModalCloseBtn.addEventListener("click", async () => {
    if (currentTxId) {
      // Update UI immediately so the admin sees feedback
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
      } catch {
        // Even if the request fails, close the modal
      }

      qroModalCloseBtn.disabled = false;
      if (loaderText) loaderText.textContent = "Esperando escaneo...";
    }
    closeQroModal();
  });
}

if (txSuccessCloseBtn) txSuccessCloseBtn.addEventListener("click", closeSuccessModal);
const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
};
const checkAuth = async () => {
  try {
    const res = await fetch("/api/admin/me", { cache: "no-store", credentials: "include" });
    const data = await res.json().catch(() => null);
    const authed = Boolean(data == null ? void 0 : data.authenticated);
    setAuthenticated(authed);
    if (authed) setLoginResult("adminResult--ok", "Sesi\xF3n activa.");
  } catch {
  }
};
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    var _a;
    e.preventDefault();
    const email = String((adminEmailEl == null ? void 0 : adminEmailEl.value) || "").trim();
    const password = (((_a = document.getElementById("adminPassword")) == null ? void 0 : _a.value) || "").trim();
    if (!email || !password) {
      setLoginResult("adminResult--err", "Correo y contraseña requeridos.");
      return;
    }
    setLoginResult("adminResult--info", "Entrando...");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = (data == null ? void 0 : data.error) || (data == null ? void 0 : data.message) || `Error (${res.status})`;
        setLoginResult("adminResult--err", msg);
        setAuthenticated(false);
        return;
      }
      setLoginResult("adminResult--ok", "Listo.");
      setAuthenticated(true);
      if (adminEmailEl) adminEmailEl.value = "";
      if (adminPasswordEl) adminPasswordEl.value = "";
    } catch {
      setLoginResult("adminResult--err", "Fallo de red.");
    }
  });
}
if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    if (!lastUrl) return;
    const ok = await copyText(lastUrl);
    setResult(ok ? "adminResult--ok" : "adminResult--err", ok ? "Link copiado." : "No se pudo copiar el link.");
  });
}
if (qrForm) {
  qrForm.addEventListener("submit", async (e) => {
    var _a, _b, _c, _d, _e;
    e.preventDefault();
    setCopyEnabled(false);
    lastUrl = "";
    const wrap = document.getElementById("qrWrap");
    if (wrap) wrap.hidden = true;
    if (qrCanvas) qrCanvas.hidden = true;
    if (qrImg) {
      qrImg.src = "";
      qrImg.hidden = true;
    }
    const points = Number(String((_a = pointsEl == null ? void 0 : pointsEl.value) != null ? _a : "").trim());
    const description = String((_b = descriptionEl == null ? void 0 : descriptionEl.value) != null ? _b : "").trim();
    if (!Number.isFinite(points) || points <= 0) {
      setResult("adminResult--err", "Puntos inv\xE1lidos.");
      return;
    }
    setResult("adminResult--info", "Generando...");
    try {
      const res = await fetch("/api/admin/mint-charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ points, description })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401) {
          setAuthenticated(false);
          setLoginResult("adminResult--err", "Sesi\xF3n expirada. Inicia sesi\xF3n de nuevo.");
        }
        const msg = (data == null ? void 0 : data.error) || (data == null ? void 0 : data.message) || `Error (${res.status})`;
        setResult("adminResult--err", msg);
        return;
      }
      const urlPath = String((_c = data == null ? void 0 : data.url) != null ? _c : "").trim();
      if (!urlPath) {
        setResult("adminResult--err", "No se pudo generar.");
        return;
      }
      const transactionId = String((_d = data == null ? void 0 : data.transactionId) != null ? _d : "").trim();
      const fullUrl = `${window.location.origin}${urlPath}`;
      lastUrl = fullUrl;
      const qrPngDataUrl = String((_e = data == null ? void 0 : data.qrPngDataUrl) != null ? _e : "").trim();
      if (qrImg && qrPngDataUrl.startsWith("data:image/")) {
        qrImg.src = qrPngDataUrl;
        qrImg.hidden = false;
        qrImg.style.display = "block";
        if (wrap) {
          wrap.hidden = false;
          wrap.style.display = "flex";
        }
      }
      setCopyEnabled(true);
      setResult("adminResult--ok", "QR listo, esperando escaneo...");
      openQroModal();
      if (transactionId) {
        startPolling(transactionId);
      }
    } catch {
      setResult("adminResult--err", "Fallo de red al generar.");
    }
  });
}
checkAuth();
