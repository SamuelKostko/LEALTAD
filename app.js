if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").then(reg => {
      // Standard Service Worker update logic: refresh UI if a new worker is installed
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Guard against reload loops if the browser keeps detecting an update.
            try {
              const key = 'wallet.swAutoReloaded';
              if (sessionStorage.getItem(key) === '1') return;
              sessionStorage.setItem(key, '1');
            } catch {
              // Ignore storage errors.
            }
            console.log("PWA: Nueva versión detectada, recargando...");
            window.location.reload();
          }
        });
      });
    }).catch(() => { });
  });
}
(() => {
  const setAppHeightVar = () => {
    document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
  };
  setAppHeightVar();
  window.addEventListener("resize", setAppHeightVar);
  window.addEventListener("orientationchange", setAppHeightVar);
})();
(() => {
  const banner = document.getElementById("installBanner");
  const btn = document.getElementById("installBannerBtn");
  const closeBtn = document.getElementById("installBannerClose");
  const desc = document.getElementById("installBannerDesc");
  if (!banner || !btn || !closeBtn || !desc) return;

  const BANNER_CLOSED_KEY = "wallet.installBannerClosed";
  
  const isStandalone = () => {
    return (typeof navigator.standalone === "boolean" && navigator.standalone) ||
      (window.matchMedia && (
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: minimal-ui)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches
      ));
  };

  if (isStandalone()) {
    console.log("PWA: Ya est\xE1 en modo standalone.");
    return;
  }

  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isInApp = () => {
    const ua = navigator.userAgent || "";
    return /FBAN|FBAV|Instagram|Gmail|GSA|Outlook|Messenger|YaBrowser/i.test(ua);
  };

  const showBanner = () => {
    if (localStorage.getItem(BANNER_CLOSED_KEY) === "1") {
      console.log("PWA: El banner est\xE1 bloqueado por el usuario (localStorage).");
      return; 
    }
    setTimeout(() => {
      banner.classList.add("installBanner--show");
      banner.setAttribute("aria-hidden", "false");
    }, 400);
  };

  const hideBanner = () => {
    banner.classList.remove("installBanner--show");
    banner.setAttribute("aria-hidden", "true");
    try { localStorage.setItem(BANNER_CLOSED_KEY, "1"); } catch (e) { }
  };

  closeBtn.addEventListener("click", hideBanner);

  let promptFired = false;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    console.log("PWA: Evento beforeinstallprompt detectado.");
    promptFired = true;
    window.deferredInstallPrompt = e;

    btn.textContent = "Instalar";
    desc.textContent = "Acceso r\xE1pido y mejor experiencia.";
    btn.onclick = async () => {
      hideBanner();
      if (!window.deferredInstallPrompt) return;
      try {
        window.deferredInstallPrompt.prompt();
        await window.deferredInstallPrompt.userChoice;
      } catch (err) { }
      window.deferredInstallPrompt = null;
    };
    showBanner();
  });

  // Failsafe: Si en 4s no ha saltado el prompt automático y es móvil, mostrar instrucciones
  setTimeout(() => {
    const ios = isIOS();
    const inApp = isInApp();
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    console.log("PWA Debug:", { mobile, ios, inApp, promptFired });

    if (promptFired || isStandalone()) return;
    if (!mobile) return;

    if (inApp) {
      console.log("PWA: Navegador interno detectado.");
      if (ios) {
        desc.textContent = "Para instalar, toca el icono de br\xFAjula o compartir y elige 'Abrir en Safari'.";
      } else {
        desc.textContent = "Para instalar, toca los tres puntos y elige 'Abrir en Chrome' o 'Navegador'.";
      }
    } else if (ios) {
      console.log("PWA: iOS detectado.");
      const tutorial = document.getElementById("installBannerTutorial");
      if (tutorial) tutorial.hidden = false;
      desc.textContent = "Toca Compartir y luego 'A\xF1adir a la pantalla de inicio'.";
    } else {
      console.log("PWA: Android/Otro detectado (Manual).");
      desc.textContent = "Toca el men\xFA del navegador y selecciona 'Instalar App' o 'A\xF1adir a inicio'.";
    }
    
    btn.textContent = "Entendido";
    btn.onclick = hideBanner;
    showBanner();
  }, 4000);

  // Botón persistente en el menú de perfil
  const profileBtn = document.getElementById("profileInstallBtn");
  if (profileBtn) {
    profileBtn.hidden = false;
    profileBtn.onclick = () => {
      // Cerrar el menú de perfil
      const menu = document.getElementById("profileMenu");
      if (menu) {
        menu.classList.remove("profileMenu--active");
        menu.setAttribute("aria-hidden", "true");
        const profileTrigger = document.getElementById("profileButton");
        if (profileTrigger) profileTrigger.setAttribute("aria-expanded", "false");
      }

      // Olvidar que el banner se cerró para forzar su aparición
      localStorage.removeItem(BANNER_CLOSED_KEY);

      // Si hay un prompt nativo pendiente, lo usamos
      if (promptFired && window.deferredInstallPrompt) {
        btn.click(); 
      } else {
        // Si no, mostramos el banner con instrucciones manuales
        showBanner();
      }
    };
  }
})();
const qrButton = document.getElementById("qrButton");
if (qrButton) {
  const pulse = () => {
    qrButton.classList.remove("is-glowing");
    void qrButton.offsetWidth;
    qrButton.classList.add("is-glowing");
    window.setTimeout(() => qrButton.classList.remove("is-glowing"), 320);
  };
  qrButton.addEventListener("click", pulse);
  qrButton.addEventListener("touchend", pulse, { passive: true });
}
(() => {
  const card = document.getElementById("clientCard");
  if (!card) return;
  const details = document.getElementById("cardDetails");
  const pointsEl = document.getElementById("points");
  const pointsCashEl = document.getElementById("pointsCash");
  const balanceEl = document.getElementById("clientBalance");
  const clientBalanceCashEl = document.getElementById("clientBalanceCash");
  const nameEl = document.getElementById("clientName");
  const idEl = document.getElementById("clientId");
  const greetingNameEl = document.getElementById("greetingName");
  const avatarInitialsEl = document.getElementById("avatarInitials");
  const updatedEl = document.getElementById("cardUpdated");
  const floatingPointsEl = document.getElementById("floatingPoints");
  const getTokenFromUrl = () => {
    try {
      const url = new URL(window.location.href);
      const qp = (url.searchParams.get("token") || url.searchParams.get("t") || "").trim();
      if (qp) return qp;
      const path = url.pathname || "";
      if (path.startsWith("/card/")) {
        return decodeURIComponent(path.slice("/card/".length)).trim();
      }
    } catch {
    }
    return "";
  };
  const getGreetingNameFromFullName = (fullName) => {
    const parts = String(fullName != null ? fullName : "").trim().split(/\s+/).filter(Boolean);
    return parts[0] || "";
  };
  const getInitialsFromFullName = (fullName) => {
    const parts = String(fullName != null ? fullName : "").trim().split(/\s+/).filter(Boolean);
    const letters = parts.slice(0, 2).map((p) => p[0]).join("");
    return letters.toUpperCase() || "";
  };
  const setUpdatedText = (updatedAtIso) => {
    if (!updatedEl) return;
    if (!updatedAtIso) {
      updatedEl.textContent = "Actualizado";
      return;
    }
    const d = new Date(updatedAtIso);
    if (Number.isNaN(d.getTime())) {
      updatedEl.textContent = "Actualizado";
      return;
    }
    const now = /* @__PURE__ */ new Date();
    const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    if (sameDay) {
      updatedEl.textContent = "Actualizado hoy";
      return;
    }
    const dateStr = d.toLocaleDateString("es-VE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    updatedEl.textContent = `Actualizado ${dateStr}`;
  };
  const setPoints = (value) => {
    const n = Number(value);
    if (!pointsEl) return;
    if (!Number.isFinite(n)) return;
    pointsEl.textContent = n.toFixed(2);
    if (floatingPointsEl) floatingPointsEl.textContent = n.toFixed(2);
    if (pointsCashEl) pointsCashEl.textContent = `\u2248 ${(n / 100).toFixed(2)} $`;
  };
  const loadCardData = window.loadCardData = async () => {
    const token = getTokenFromUrl();
    if (!token) {
      setTimeout(() => document.body.classList.add("is-ready"), 2e3);
      return;
    }
    try {
      const res = await fetch(
        `/api/card?token=${encodeURIComponent(token)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        if (nameEl) nameEl.textContent = "Tarjeta no v\xE1lida";
        if (greetingNameEl) greetingNameEl.textContent = "Usuario";
        document.body.classList.add("is-ready");
        return;
      }
      const data = await res.json();
      if (data && typeof data === "object") {
        if (nameEl && typeof data.name === "string") nameEl.textContent = data.name;
        if (idEl && typeof data.cedula === "string") idEl.textContent = data.cedula;
        if (typeof data.balance !== "undefined") setPoints(data.balance);
        syncBalance();
        if (greetingNameEl && typeof data.name === "string") {
          const greetingName = getGreetingNameFromFullName(data.name);
          if (greetingName) greetingNameEl.textContent = greetingName;
        }
        if (avatarInitialsEl && typeof data.name === "string") {
          const initials = getInitialsFromFullName(data.name);
          if (initials) avatarInitialsEl.textContent = initials;
        }
        if (typeof data.updatedAt === "string") setUpdatedText(data.updatedAt);
        
        // Control del Modal de Primera Vez
        if (data.isFirstOpen) {
          const firstModal = document.getElementById("firstOpenModal");
          if (firstModal) {
            firstModal.classList.add("firstOpenModal--active");
            firstModal.setAttribute("aria-hidden", "false");

            const hideFirstModal = () => {
              firstModal.classList.remove("firstOpenModal--active");
              firstModal.setAttribute("aria-hidden", "true");
            };

            const installBtn = document.getElementById("firstOpenInstallBtn");
            if (installBtn) {
              installBtn.onclick = async () => {
                try {
                  const prompt = window.deferredInstallPrompt;
                  if (prompt && typeof prompt.prompt === "function") {
                    prompt.prompt();
                    try {
                      await prompt.userChoice;
                    } catch {
                    }
                    window.deferredInstallPrompt = null;
                    hideFirstModal();
                    return;
                  }

                  // Fallback: mostrar el banner de instalación (con instrucciones según el navegador)
                  const banner = document.getElementById("installBanner");
                  if (banner) {
                    banner.classList.add("installBanner--show");
                    banner.setAttribute("aria-hidden", "false");
                  }
                } catch {
                }
              };
            }
            
            const btnClose = document.getElementById("firstOpenCloseBtn");
            if (btnClose) {
              btnClose.onclick = () => {
                hideFirstModal();
              };
            }
          }
        }
      }
    } catch {
    } finally {
      setTimeout(() => document.body.classList.add("is-ready"), 2e3);
    }
  };
  let autoCloseTimer = null;
  const setExpanded = (expanded) => {
    if (autoCloseTimer) {
      window.clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
    card.classList.toggle("is-details", expanded);
    card.setAttribute("aria-expanded", expanded ? "true" : "false");
    if (details) details.setAttribute("aria-hidden", expanded ? "false" : "true");
    if (expanded) {
      autoCloseTimer = window.setTimeout(() => {
        setExpanded(false);
      }, 5e3);
    }
  };
  const syncBalance = () => {
    var _a;
    if (!balanceEl) return;
    const raw = (_a = pointsEl == null ? void 0 : pointsEl.textContent) != null ? _a : "0";
    const val = raw.replace(/\s+/g, "").trim() || "0";
    balanceEl.textContent = val;
    if (clientBalanceCashEl) {
      const n = Number(val);
      clientBalanceCashEl.textContent = `\u2248 ${(Number.isFinite(n) ? n / 100 : 0).toFixed(2)} $`;
    }
  };
  const initialToken = getTokenFromUrl();
  if (initialToken) {
    if (nameEl) nameEl.textContent = "Cargando...";
    if (idEl) idEl.textContent = "\u2014";
    if (greetingNameEl) greetingNameEl.textContent = "...";
    if (avatarInitialsEl) avatarInitialsEl.textContent = "...";
    if (updatedEl) updatedEl.textContent = "Actualizando...";
    setPoints(0);
  } else {
    document.body.classList.add("mode-admin");
    card.hidden = true;
    const activity = document.querySelector(".activity");
    if (activity) activity.hidden = true;
    const cta = document.querySelector(".cta");
    if (cta) cta.hidden = true;
    const profileButton = document.getElementById("profileButton");
    if (profileButton) profileButton.hidden = true;
    const loginModal = document.getElementById("adminRootLogin");
    const loginForm = document.getElementById("adminRootLoginForm");
    const forgotForm = document.getElementById("adminRootForgotForm");
    const verifyForm = document.getElementById("adminRootVerifyForm");
    const resetForm = document.getElementById("adminRootResetForm");
    const emailEl = document.getElementById("adminRootEmail");
    const passwordEl = document.getElementById("adminRootPassword");
    const forgotEmailEl = document.getElementById("adminRootForgotEmail");
    const verifyCodeEl = document.getElementById("adminRootVerifyCode");
    const newPasswordEl = document.getElementById("adminRootNewPassword");
    const loginResultEl = document.getElementById("adminRootLoginResult");
    const forgotBtn = document.getElementById("adminRootForgotBtn");
    const cancelForgotBtn = document.getElementById("adminRootCancelForgotBtn");
    const cancelVerifyBtn = document.getElementById("adminRootCancelVerifyBtn");
    const dash = document.getElementById("adminDash");
    const goQrBtn = document.getElementById("adminHeaderGoQr");
    const logoutBtn = document.getElementById("adminHeaderLogout");
    const adminLogoutBtn = document.getElementById("adminLogout");
    const adminResetTxsBtn = document.getElementById("adminResetTxsBtnSidebar");
    const adminCreditPointsBtn = document.getElementById("adminCreditPointsBtn");
    const adminCreateCashierBtn = document.getElementById("adminCreateCashierBtn");
    const panelClientes = document.getElementById("aPanelClientes");
    const panelTx = document.getElementById("aPanelTx");
    const panelStats = document.getElementById("aPanelStats");
    const navClientes = document.getElementById("aNavClientes");
    const navTx = document.getElementById("aNavTx");
    const navStats = document.getElementById("aNavStats");
    const searchInput = document.getElementById("adminClientSearch");
    const dropdown = document.getElementById("adminSearchDropdown");
    const clientCard = document.getElementById("aClientCard");
    const clientAvatarEl = document.getElementById("aClientAvatar");
    const clientNameEl = document.getElementById("aClientName");
    const clientMetaEl = document.getElementById("aClientMeta");
    const clientBalanceEl = document.getElementById("aClientBalance");
    const clientClearBtn = document.getElementById("aClientClear");
    const clientEditBtn = document.getElementById("adminClientEditBtn");
    const clientDeleteBtn = document.getElementById("adminClientDeleteBtn");
    const clientsResult = document.getElementById("adminClientsResult");
    const cardTxSection = document.getElementById("adminRootCardTx");
    const cardTxHint = document.getElementById("adminCardTxHint");
    const cardTxList = document.getElementById("adminCardTxList");
    const cardTxResult = document.getElementById("adminCardTxResult");
    const txRefresh = document.getElementById("adminTxRefresh");
    const txList = document.getElementById("adminTxList");
    const txResult = document.getElementById("adminTxResult");
    let allCards = [];
    let selectedToken = "";
    let currentValidCode = null;
    const setText = (el, text) => {
      if (el) el.textContent = String(text != null ? text : "");
    };
    const setResult = (el, type, msg) => {
      if (!el) return;
      el.className = "aResult" + (type ? ` aResult--${type}` : "");
      el.textContent = msg;
    };
    const apiGet = async (path) => {
      const res = await fetch(path, { cache: "no-store", credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const err = new Error((data == null ? void 0 : data.error) || (data == null ? void 0 : data.message) || `Error (${res.status})`);
        err.status = res.status;
        throw err;
      }
      return data;
    };
    const formatTxDate = (tx) => {
      const iso = tx.processedAt || tx.createdAt || "";
      if (!iso) return "\u2014";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "\u2014";
      return d.toLocaleString("es-VE", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    };
    const renderTxTable = (container, txs, mode) => {
      if (!container) return;
      container.innerHTML = "";
      if (!txs.length) {
        const empty = document.createElement("div");
        empty.className = "aTxEmpty";
        empty.textContent = "Sin transacciones registradas";
        container.appendChild(empty);
        return;
      }
      const wrap = document.createElement("div");
      wrap.className = "aTxTable";
      const headLabels = mode === "card" ? ["Fecha", "Tipo", "Estado", "Pts", "Antes", "Despu\xE9s", "Descripci\xF3n"] : ["Fecha", "Tipo", "Estado", "Pts", "Cliente", "Descripci\xF3n"];
      const head = document.createElement("div");
      head.className = mode === "card" ? "aTxRow aTxRow--card aTxRow--head" : "aTxRow aTxRow--head";
      for (const lbl of headLabels) {
        const c = document.createElement("div");
        c.className = "aTxCell";
        c.textContent = lbl;
        head.appendChild(c);
      }
      wrap.appendChild(head);
      for (const t of txs) {
        const row = document.createElement("div");
        row.className = mode === "card" ? "aTxRow aTxRow--card" : "aTxRow";
        const pts = Number.isFinite(Number(t.points)) ? Number(t.points) : 0;
        const before = Number.isFinite(Number(t.balanceBefore)) ? Number(t.balanceBefore) : null;
        const after = Number.isFinite(Number(t.balanceAfter)) ? Number(t.balanceAfter) : null;
        const addCell = (label, text, cls) => {
          const c = document.createElement("div");
          c.className = "aTxCell" + (cls ? ` ${cls}` : "");
          c.setAttribute("data-label", label);
          c.textContent = text;
          row.appendChild(c);
        };
        addCell("Fecha", formatTxDate(t));
        addCell("Tipo", String(t.type || "\u2014"));
        addCell("Estado", String(t.status || "\u2014"), "aTxCell--strong");
        addCell("Pts", pts.toFixed(2), "aTxCell--pts");
        if (mode === "card") {
          addCell("Antes", before === null ? "\u2014" : before.toFixed(2));
          addCell("Despu\xE9s", after === null ? "\u2014" : after.toFixed(2));
        } else {
          addCell("Cliente", String((t == null ? void 0 : t.name) || (t == null ? void 0 : t.token) || "\u2014"));
        }
        addCell("Descripci\xF3n", String(t.description || "\u2014"));
        wrap.appendChild(row);
      }
      container.appendChild(wrap);
    };
    const showLoginStep = (step) => {
      if (loginForm) loginForm.hidden = step !== "login";
      if (forgotForm) forgotForm.hidden = step !== "forgot";
      if (verifyForm) verifyForm.hidden = step !== "verify";
      if (resetForm) resetForm.hidden = step !== "reset";
    };
    const clearRecoveryResults = () => {
      setResult(document.getElementById("adminRootForgotResult"), "", "");
      setResult(document.getElementById("adminRootVerifyResult"), "", "");
      setResult(document.getElementById("adminRootResetResult"), "", "");
    };
    const showLogin = () => {
      if (loginModal) loginModal.hidden = false;
      if (dash) dash.hidden = true;
    };
    const showDash = () => {
      if (loginModal) loginModal.hidden = true;
      if (dash) dash.hidden = false;
      const mobileNav2 = document.getElementById("aMobileNav");
      if (mobileNav2 && window.innerWidth <= 640) mobileNav2.style.display = "flex";
    };
    const switchPanel = (panel) => {
      if (panelClientes) panelClientes.hidden = panel !== "clientes";
      if (panelTx) panelTx.hidden = panel !== "transacciones";
      if (panelStats) panelStats.hidden = panel !== "metricas";
      if (navClientes) navClientes.classList.toggle("is-active", panel === "clientes");
      if (navTx) navTx.classList.toggle("is-active", panel === "transacciones");
      if (navStats) navStats.classList.toggle("is-active", panel === "metricas");
      const mobClientes = document.getElementById("aMobNavClientes");
      const mobTx = document.getElementById("aMobNavTx");
      const mobStats = document.getElementById("aMobNavStats");
      if (mobClientes) mobClientes.classList.toggle("is-active", panel === "clientes");
      if (mobTx) mobTx.classList.toggle("is-active", panel === "transacciones");
      if (mobStats) mobStats.classList.toggle("is-active", panel === "metricas");
      const main = document.querySelector(".aDash__main");
      if (main) main.scrollTop = 0;
    };
    if (navClientes) navClientes.addEventListener("click", () => switchPanel("clientes"));
    if (navTx) navTx.addEventListener("click", () => {
      switchPanel("transacciones");
      loadAllTransactions();
    });
    if (navStats) navStats.addEventListener("click", () => {
      switchPanel("metricas");
      loadAdminStats();
    });
    const mobNavClientes = document.getElementById("aMobNavClientes");
    const mobNavTx = document.getElementById("aMobNavTx");
    const mobNavStats = document.getElementById("aMobNavStats");
    const mobNavLogout = document.getElementById("aMobNavLogout");
    if (mobNavClientes) mobNavClientes.addEventListener("click", () => switchPanel("clientes"));
    if (mobNavTx) mobNavTx.addEventListener("click", () => {
      switchPanel("transacciones");
      loadAllTransactions();
    });
    if (mobNavStats) mobNavStats.addEventListener("click", () => {
      switchPanel("metricas");
      loadAdminStats();
    });
    const mobileNav = document.getElementById("aMobileNav");
    if (mobileNav) {
      const updateNavVisibility = () => {
        if (!dash.hidden) {
          mobileNav.style.display = window.innerWidth <= 640 ? "flex" : "none";
        }
      };
      window.addEventListener("resize", updateNavVisibility);
    }
    if (goQrBtn) goQrBtn.addEventListener("click", () => {
      window.location.href = "/admin/qr";
    });
    const doLogout = async (e) => {
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      try {
        await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
        window.location.href = "/admin";
      } catch (err) {
        window.location.reload();
      }
    };
    if (logoutBtn) logoutBtn.addEventListener("click", doLogout);
    if (mobNavLogout) mobNavLogout.addEventListener("click", (e) => doLogout(e));
    if (adminLogoutBtn) adminLogoutBtn.addEventListener("click", doLogout);

    const doResetTransactions = async () => {
      const password = window.prompt("\xBFEst\xE1s seguro de que deseas reiniciar todas las transacciones?\n\nEsta acci\xF3n eliminar\xE1 el historial completo y dejar\xE1 los saldos en 0.\n\nPOR FAVOR, INGRESA TU CLAVE PARA CONFIRMAR:");
      
      if (password === null) return; // Cancelled
      if (!password.trim()) {
        alert("Se requiere la clave para proceder.");
        return;
      }

      try {
        const res = await fetch("/api/admin/reset-transactions", { 
          method: "POST", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: password.trim() }),
          credentials: "include" 
        });
        const data = await res.json().catch(() => null);
        
        if (!res.ok || !(data == null ? void 0 : data.ok)) {
          alert("Error al reiniciar: " + ((data == null ? void 0 : data.error) || "Desconocido"));
          return;
        }
        
        alert("Reinicio completado con \xE9xito. Todos los balances est\xE1n en 0.");
        
        // Recargar el panel actual para reflejar los cambios
        if (panelClientes && !panelClientes.hidden) loadClients();
        if (panelTx && !panelTx.hidden) loadAllTransactions();
        if (panelStats && !panelStats.hidden) loadAdminStats();
        
        // Cerrar el menú de perfil si está abierto
        const menu = document.getElementById("profileMenu");
        if (menu) {
          menu.classList.remove("profileMenu--active");
          menu.setAttribute("aria-hidden", "true");
        }
      } catch (err) {
        alert("Error de red al intentar reiniciar transacciones.");
      }
    };

    if (adminResetTxsBtn) {
      adminResetTxsBtn.addEventListener("click", doResetTransactions);
    }

    const doManualCredit = async () => {
      if (!selectedToken) {
        alert("Por favor, selecciona un cliente primero buscando por nombre o c\xE9dula.");
        return;
      }

      const pointsStr = window.prompt(`Ingresa la cantidad de puntos a ABONAR a ${clientNameEl ? clientNameEl.textContent : 'este cliente'}:`);
      if (pointsStr === null) return;
      const points = Number(pointsStr);
      if (isNaN(points) || points <= 0) {
        alert("Cantidad de puntos inv\xE1lida.");
        return;
      }

      const password = window.prompt("Introduce tu CLAVE DE ADMINISTRADOR para confirmar el abono manual:");
      if (password === null) return;
      if (!password.trim()) {
        alert("Se requiere la clave para continuar.");
        return;
      }

      try {
        const res = await fetch("/api/admin/manual-credit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: selectedToken,
            points: points,
            password: password.trim()
          }),
          credentials: "include"
        });
        const data = await res.json().catch(() => null);

        if (!res.ok || !(data == null ? void 0 : data.ok)) {
          alert("Error: " + ((data == null ? void 0 : data.error) || "Desconocido"));
          return;
        }

        alert(data.message || "Puntos acreditados correctamente.");
        
        // Recargar datos para ver el nuevo balance
        loadClients();
        if (selectedToken) loadCardTransactions(selectedToken);
        loadAdminStats();
      } catch (err) {
        alert("Error de red al intentar acreditar puntos.");
      }
    };

    if (adminCreditPointsBtn) {
      adminCreditPointsBtn.addEventListener("click", doManualCredit);
    }

    const doCreateCashier = async () => {
      const email = String(window.prompt("Correo del cajero:") ?? "").trim().toLowerCase();
      if (!email) return;

      const password = String(window.prompt("Contraseña del cajero (mínimo 6 caracteres):") ?? "").trim();
      if (!password) return;

      if (password.length < 6) {
        alert("La contraseña es muy corta.");
        return;
      }

      const name = String(window.prompt("Nombre del cajero (opcional):") ?? "").trim();

      try {
        const res = await fetch("/api/admin/cashiers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password, name })
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          if (res.status === 401) {
            doLogout();
            return;
          }
          alert(String((data == null ? void 0 : data.error) || (data == null ? void 0 : data.message) || `Error (${res.status})`));
          return;
        }

        alert("Cajero creado correctamente.");
      } catch {
        alert("Error de red al crear el cajero.");
      }
    };

    if (adminCreateCashierBtn) {
      adminCreateCashierBtn.addEventListener("click", doCreateCashier);
    }

    const doEditClient = async () => {
      if (!selectedToken) {
        alert("Por favor, selecciona un cliente primero.");
        return;
      }

      const current = allCards.find((c) => c.token === selectedToken) || { name: "", cedula: "" };
      const name = String(window.prompt("Nombre del cliente:", current.name || "") ?? "").trim();
      if (!name) return;

      const cedula = String(window.prompt("Cédula del cliente:", current.cedula || "") ?? "").trim();
      if (!cedula) return;

      setResult(clientsResult, "info", "Actualizando cliente…");
      try {
        const res = await fetch("/api/admin/cards", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token: selectedToken, name, cedula })
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          if (res.status === 401) {
            doLogout();
            return;
          }
          setResult(clientsResult, "err", (data == null ? void 0 : data.error) || `Error (${res.status})`);
          return;
        }

        await loadClients();
        const updated = allCards.find((c) => c.token === selectedToken);
        if (updated) selectClient(updated);
        setResult(clientsResult, "ok", "Datos actualizados.");
      } catch {
        setResult(clientsResult, "err", "Error de red al actualizar.");
      }
    };

    const doDeleteClient = async () => {
      if (!selectedToken) {
        alert("Por favor, selecciona un cliente primero.");
        return;
      }

      const current = allCards.find((c) => c.token === selectedToken) || { name: "", cedula: "" };
      const ok = window.confirm(
        `¿Eliminar al cliente${current.name ? ` "${current.name}"` : ""}${current.cedula ? ` (CI: ${current.cedula})` : ""}?

Esto eliminará también sus transacciones.`
      );
      if (!ok) return;

      const password = String(window.prompt("Introduce tu CLAVE DE ADMINISTRADOR para confirmar la eliminación:") ?? "").trim();
      if (!password) {
        alert("Se requiere la clave para continuar.");
        return;
      }

      setResult(clientsResult, "info", "Eliminando cliente…");
      try {
        const res = await fetch("/api/admin/cards", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token: selectedToken, password, deleteTransactions: true })
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          if (res.status === 401) {
            doLogout();
            return;
          }
          setResult(clientsResult, "err", (data == null ? void 0 : data.error) || `Error (${res.status})`);
          return;
        }

        clearClient();
        await loadClients();
        if (panelTx && !panelTx.hidden) loadAllTransactions();
        if (panelStats && !panelStats.hidden) loadAdminStats();
        setResult(clientsResult, "ok", "Cliente eliminado.");
      } catch {
        setResult(clientsResult, "err", "Error de red al eliminar.");
      }
    };

    if (clientEditBtn) clientEditBtn.addEventListener("click", doEditClient);
    if (clientDeleteBtn) clientDeleteBtn.addEventListener("click", doDeleteClient);

    const getInitials = (name) => {
      const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
      return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
    };
    const clearClient = () => {
      selectedToken = "";
      if (clientCard) clientCard.hidden = true;
      if (cardTxSection) cardTxSection.hidden = true;
      if (clientEditBtn) clientEditBtn.disabled = true;
      if (clientDeleteBtn) clientDeleteBtn.disabled = true;
      if (searchInput) searchInput.value = "";
      if (dropdown) {
        dropdown.hidden = true;
        dropdown.innerHTML = "";
      }
    };
    const selectClient = (c) => {
      var _a, _b;
      selectedToken = c.token;
      if (clientEditBtn) clientEditBtn.disabled = false;
      if (clientDeleteBtn) clientDeleteBtn.disabled = false;
      if (searchInput) searchInput.value = "";
      if (dropdown) {
        dropdown.hidden = true;
        dropdown.innerHTML = "";
      }
      if (clientAvatarEl) clientAvatarEl.textContent = getInitials(c.name);
      if (clientNameEl) clientNameEl.textContent = c.name || "\u2014";
      if (clientMetaEl) clientMetaEl.textContent = c.cedula ? `CI: ${c.cedula}` : "Sin c\xE9dula";
      if (clientBalanceEl) clientBalanceEl.textContent = Number((_a = c.balance) != null ? _a : 0).toFixed(2);
      const cashEl = document.getElementById("aClientBalanceCash");
      if (cashEl) cashEl.textContent = `\u2248 ${(Number((_b = c.balance) != null ? _b : 0) / 100).toFixed(2)} $`;
      if (clientCard) clientCard.hidden = false;
      if (cardTxSection) {
        cardTxSection.hidden = false;
      }
      if (cardTxHint) cardTxHint.textContent = `Transacciones \xB7 ${c.name || "\u2014"}`;
      loadCardTransactions(c.token);
    };
    if (clientClearBtn) clientClearBtn.addEventListener("click", clearClient);
    const buildDropdown = (query) => {
      if (!dropdown || !searchInput) return;
      const q = query.trim().toLowerCase();
      if (!q) {
        dropdown.hidden = true;
        dropdown.innerHTML = "";
        return;
      }
      const matches = allCards.filter((c) => c.name.toLowerCase().includes(q) || c.cedula.includes(q)).slice(0, 8);
      dropdown.innerHTML = "";
      if (!matches.length) {
        const el = document.createElement("div");
        el.className = "aDropdown__empty";
        el.textContent = "Sin resultados";
        dropdown.appendChild(el);
        dropdown.hidden = false;
        return;
      }
      for (const c of matches) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "aDropdown__item";
        btn.innerHTML = `<span class="aDropdown__name">${c.name || "\u2014"}</span><span class="aDropdown__cedula">${c.cedula || ""}</span><span class="aDropdown__pts">${Number(c.balance).toFixed(2)} pts</span>`;
        btn.addEventListener("click", () => selectClient(c));
        dropdown.appendChild(btn);
      }
      dropdown.hidden = false;
    };
    if (searchInput) {
      searchInput.addEventListener("input", () => buildDropdown(searchInput.value));
      searchInput.addEventListener("focus", () => {
        if (searchInput.value) buildDropdown(searchInput.value);
      });
      document.addEventListener("click", (e) => {
        if (!searchInput.contains(e.target) && !(dropdown == null ? void 0 : dropdown.contains(e.target))) {
          if (dropdown) {
            dropdown.hidden = true;
          }
        }
      });
    }
    const loadClients = async () => {
      var _a;
      setResult(clientsResult, "info", "Cargando clientes\u2026");
      try {
        const data = await apiGet("/api/admin/cards?limit=200");
        allCards = (Array.isArray(data == null ? void 0 : data.cards) ? data.cards : []).map((c) => {
          var _a2, _b, _c;
          return {
            token: String((_a2 = c == null ? void 0 : c.token) != null ? _a2 : "").trim(),
            name: String((_b = c == null ? void 0 : c.name) != null ? _b : "").trim(),
            cedula: String((_c = c == null ? void 0 : c.cedula) != null ? _c : "").trim(),
            balance: Number.isFinite(Number(c == null ? void 0 : c.balance)) ? Number(c.balance) : 0
          };
        }).filter((c) => c.token);
        setResult(clientsResult, "", "");
      } catch (err) {
        if ((err == null ? void 0 : err.status) === 401) {
          doLogout();
          return;
        }
        setResult(clientsResult, "err", (_a = err == null ? void 0 : err.message) != null ? _a : "Error al cargar clientes");
      }
    };
    const loadAllTransactions = async () => {
      var _a;
      if (!txList) return;
      setResult(txResult, "info", "Cargando\u2026");
      try {
        const data = await apiGet("/api/admin/transactions?limit=80");
        const txs = Array.isArray(data == null ? void 0 : data.transactions) ? data.transactions : [];
        renderTxTable(txList, txs, "all");
        setResult(txResult, "", "");
      } catch (err) {
        if ((err == null ? void 0 : err.status) === 401) {
          doLogout();
          return;
        }
        setResult(txResult, "err", (_a = err == null ? void 0 : err.message) != null ? _a : "Error");
      }
    };
    const loadCardTransactions = async (token) => {
      var _a;
      if (!cardTxList) return;
      setResult(cardTxResult, "info", "Cargando\u2026");
      try {
        const data = await apiGet(`/api/admin/transactions?token=${encodeURIComponent(token)}&limit=80`);
        const txs = Array.isArray(data == null ? void 0 : data.transactions) ? data.transactions : [];
        renderTxTable(cardTxList, txs, "card");
        setResult(cardTxResult, "", "");
      } catch (err) {
        if ((err == null ? void 0 : err.status) === 401) {
          doLogout();
          return;
        }
        setResult(cardTxResult, "err", (_a = err == null ? void 0 : err.message) != null ? _a : "Error");
      }
    };
    if (txRefresh) txRefresh.addEventListener("click", loadAllTransactions);
    let currentStatsRange = "day";
    const loadAdminStats = async (range = currentStatsRange) => {
      const loader = document.getElementById("adminStatsLoader");
      if (loader) loader.hidden = false;
      try {
        const data = await apiGet(`/api/admin/stats?range=${encodeURIComponent(range)}`);
        const elUsers = document.getElementById("stUsers");
        const elEarned = document.getElementById("stPtsEarned");
        const elRedeemed = document.getElementById("stPtsRedeemed");
        const elUsersSub = document.getElementById("stUsersSub");
        if (elUsers) {
          elUsers.textContent = String(data.newUsers || 0);
          if (elUsersSub) elUsersSub.textContent = `Registrados en el periodo (Hist\xF3rico: ${data.totalUsers || 0})`;
        }
        if (elEarned) elEarned.textContent = Number(data.pointsEarned || 0).toFixed(2);
        if (elRedeemed) elRedeemed.textContent = Number(data.pointsRedeemed || 0).toFixed(2);
      } catch (err) {
        if ((err == null ? void 0 : err.status) === 401) {
          doLogout();
          return;
        }
      } finally {
        if (loader) loader.hidden = true;
      }
    };
    const filterBtns = document.querySelectorAll(".aFilterBtn");
    filterBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const r = e.target.getAttribute("data-range") || "all";
        currentStatsRange = r;
        filterBtns.forEach((b) => b.classList.remove("is-active"));
        e.target.classList.add("is-active");
        loadAdminStats(r);
      });
    });
    const initAuthed = () => {
      showDash();
      switchPanel("clientes");
      loadClients();
      
      // Mostrar botones de admin en el sidebar (ya visibles por HTML, pero nos aseguramos)
      if (adminResetTxsBtn) adminResetTxsBtn.hidden = false;
      
      // Ocultar botón de perfil en admin mode si así se requiere
      if (profileButton) profileButton.hidden = true;
    };
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        var _a, _b;
        e.preventDefault();
        const email = (((_a = document.getElementById("adminRootEmail")) == null ? void 0 : _a.value) || "").trim();
        const password = (((_b = document.getElementById("adminRootPassword")) == null ? void 0 : _b.value) || "").trim();
        if (!email || !password) {
          setResult(loginResultEl, "err", "Correo y contrase\xF1a requeridos.");
          return;
        }
        setResult(loginResultEl, "info", "Entrando\u2026");
        try {
          const res = await fetch("/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, password })
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            setResult(loginResultEl, "err", (data == null ? void 0 : data.error) || (data == null ? void 0 : data.message) || `Error (${res.status})`);
            return;
          }
          setResult(loginResultEl, "ok", "Acceso concedido.");
          if (emailEl) emailEl.value = "";
          if (passwordEl) passwordEl.value = "";
          try {
            const me = await apiGet("/api/admin/me");
            const role = String((me == null ? void 0 : me.role) || "admin").toLowerCase();
            if (role === "cashier") {
              window.location.href = "/admin/qr";
              return;
            }
          } catch {
          }
          initAuthed();
        } catch (err) {
          setResult(loginResultEl, "err", "Fallo de red.");
        }
      });
    }
    if (forgotBtn) forgotBtn.addEventListener("click", () => {
      clearRecoveryResults();
      showLoginStep("forgot");
    });
    if (cancelForgotBtn) cancelForgotBtn.addEventListener("click", () => {
      clearRecoveryResults();
      showLoginStep("login");
      setResult(loginResultEl, "", "");
    });
    if (cancelVerifyBtn) cancelVerifyBtn.addEventListener("click", () => {
      clearRecoveryResults();
      showLoginStep("login");
      setResult(loginResultEl, "", "");
    });
    if (forgotForm) {
      forgotForm.addEventListener("submit", async (e) => {
        var _a;
        e.preventDefault();
        const resultEl = document.getElementById("adminRootForgotResult");
        const email = String((_a = forgotEmailEl == null ? void 0 : forgotEmailEl.value) != null ? _a : "").trim();
        setResult(resultEl, "info", "Enviando c\xF3digo\u2026");
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15e3);
        try {
          const res = await fetch("/api/admin/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
            signal: ctrl.signal
          });
          clearTimeout(t);
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            setResult(resultEl, "err", (data == null ? void 0 : data.error) || "Correo incorrecto.");
            return;
          }
          setResult(resultEl, "ok", "Correo enviado. Revisa tu bandeja.");
          setTimeout(() => showLoginStep("verify"), 1500);
        } catch (err) {
          clearTimeout(t);
          setResult(resultEl, "err", (err == null ? void 0 : err.name) === "AbortError" ? "Tiempo agotado. Revisa SMTP." : "Error de red.");
        }
      });
    }
    if (verifyForm) {
      verifyForm.addEventListener("submit", async (e) => {
        var _a;
        e.preventDefault();
        const resultEl = document.getElementById("adminRootVerifyResult");
        const code = String((_a = verifyCodeEl == null ? void 0 : verifyCodeEl.value) != null ? _a : "").trim();
        if (!code) {
          setResult(resultEl, "err", "Ingresa el c\xF3digo.");
          return;
        }
        setResult(resultEl, "info", "Verificando\u2026");
        try {
          const res = await fetch("/api/admin/verify-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code })
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            setResult(resultEl, "err", (data == null ? void 0 : data.error) || "C\xF3digo incorrecto.");
            return;
          }
          setResult(resultEl, "ok", "C\xF3digo correcto.");
          currentValidCode = code;
          setTimeout(() => showLoginStep("reset"), 1e3);
        } catch (err) {
          setResult(resultEl, "err", "Error de red.");
        }
      });
    }
    if (resetForm) {
      resetForm.addEventListener("submit", async (e) => {
        var _a;
        e.preventDefault();
        const resultEl = document.getElementById("adminRootResetResult");
        const newPassword = String((_a = newPasswordEl == null ? void 0 : newPasswordEl.value) != null ? _a : "").trim();
        if (!newPassword || newPassword.length < 6) {
          setResult(resultEl, "err", "Clave muy corta.");
          return;
        }
        setResult(resultEl, "info", "Actualizando\u2026");
        try {
          const res = await fetch("/api/admin/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: currentValidCode, newPassword })
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            setResult(resultEl, "err", (data == null ? void 0 : data.error) || "Error al actualizar.");
            return;
          }
          setResult(resultEl, "ok", "\xA1Clave actualizada! Redirigiendo\u2026");
          setTimeout(() => {
            showLoginStep("login");
            clearRecoveryResults();
            window.location.href = "/admin";
          }, 2e3);
        } catch (err) {
          setResult(resultEl, "err", "Error de red.");
        }
      });
    }
    const checkAuth = async () => {
      try {
        const data = await apiGet("/api/admin/me");
        if (Boolean(data == null ? void 0 : data.authenticated)) {
          const role = String((data == null ? void 0 : data.role) || "admin").toLowerCase();
          if (role === "cashier") {
            window.location.href = "/admin/qr";
            return;
          }
          initAuthed();
        }
        else showLogin();
      } catch (err) {
        showLogin();
      } finally {
        document.body.classList.add("is-ready");
      }
    };
    checkAuth();
    return;
  }
  syncBalance();
  loadCardData();
  const toggle = () => {
    syncBalance();
    const expanded = card.getAttribute("aria-expanded") === "true";
    setExpanded(!expanded);
  };
  card.addEventListener("contextmenu", (e) => e.preventDefault());
  card.addEventListener("dragstart", (e) => e.preventDefault());
  if ("PointerEvent" in window) {
    const MOVE_PX = 10;
    let pointerDown = false;
    let startX = 0;
    let startY = 0;
    let moved = false;
    let activePointerId = null;
    card.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pointerDown = true;
      moved = false;
      activePointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
    });
    card.addEventListener("pointermove", (e) => {
      if (!pointerDown || e.pointerId !== activePointerId) return;
      if (Math.abs(e.clientX - startX) > MOVE_PX || Math.abs(e.clientY - startY) > MOVE_PX) {
        moved = true;
      }
    });
    card.addEventListener("pointerup", (e) => {
      if (!pointerDown || e.pointerId !== activePointerId) return;
      pointerDown = false;
      activePointerId = null;
      if (!moved) toggle();
    });
    card.addEventListener("pointercancel", () => {
      pointerDown = false;
      activePointerId = null;
    });
  } else {
    card.addEventListener("click", toggle);
  }
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  });
})();
(() => {
  const profileButton = document.getElementById("profileButton");
  const menu = document.getElementById("profileMenu");
  const closeBtn = document.getElementById("profileClose");
  if (!profileButton || !menu) return;
  const setOpen = (open2) => {
    menu.classList.toggle("profileMenu--active", open2);
    menu.setAttribute("aria-hidden", open2 ? "false" : "true");
    profileButton.setAttribute("aria-expanded", open2 ? "true" : "false");
    if (open2) {
      window.setTimeout(() => (closeBtn != null ? closeBtn : profileButton).focus(), 0);
    }
  };
  const close = () => setOpen(false);
  const open = () => setOpen(true);
  profileButton.addEventListener("click", () => {
    const openNow = profileButton.getAttribute("aria-expanded") === "true";
    setOpen(!openNow);
  });
  if (closeBtn) closeBtn.addEventListener("click", close);
  menu.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target instanceof HTMLElement && target.hasAttribute("data-profile-close")) {
      close();
    }
  });
  window.addEventListener("keydown", (e) => {
    if (menu.getAttribute("aria-hidden") === "true") return;
    if (e.key === "Escape") close();
  });
})();
(() => {
  const scanner = document.getElementById("qrScanner");
  const video = document.getElementById("qrVideo");
  const canvas = document.getElementById("qrCanvas");
  const closeBtn = document.getElementById("qrClose");
  const hint = document.getElementById("qrHint");
  const resultEl = document.getElementById("qrResult");
  if (!scanner || !video || !canvas || !qrButton) return;
  let stream = null;
  let scanning = false;
  const ctx = canvas.getContext("2d");
  const scanPopup = (() => {
    try {
      const root = document.createElement("div");
      root.className = "scanPopup";
      root.setAttribute("aria-hidden", "true");
      const backdrop = document.createElement("div");
      backdrop.className = "scanPopup__backdrop";
      const frame = document.createElement("div");
      frame.className = "scanPopup__frame";
      frame.setAttribute("role", "dialog");
      frame.setAttribute("aria-modal", "true");
      frame.setAttribute("aria-label", "Resultado del cobro");
      const icon = document.createElement("div");
      icon.className = "scanPopup__icon";
      icon.setAttribute("aria-hidden", "true");
      const title = document.createElement("div");
      title.className = "scanPopup__title";
      const subtitle = document.createElement("div");
      subtitle.className = "scanPopup__subtitle";
      frame.appendChild(icon);
      frame.appendChild(title);
      frame.appendChild(subtitle);
      root.appendChild(backdrop);
      root.appendChild(frame);
      document.body.appendChild(root);
      const icons = {
        ok: `<svg viewBox="0 0 24 24" width="44" height="44" fill="none" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        err: `<svg viewBox="0 0 24 24" width="44" height="44" fill="none" aria-hidden="true"><path d="M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M6 6l12 12" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`
      };
      let timer = null;
      const close = () => {
        root.classList.remove("scanPopup--show");
        root.setAttribute("aria-hidden", "true");
        if (timer) window.clearTimeout(timer);
        timer = null;
      };
      const show = ({ kind, headline, detail }) => {
        const k = kind === "ok" ? "ok" : "err";
        icon.innerHTML = icons[k];
        icon.classList.toggle("scanPopup__icon--ok", k === "ok");
        icon.classList.toggle("scanPopup__icon--err", k === "err");
        title.textContent = String(headline != null ? headline : "");
        subtitle.textContent = String(detail != null ? detail : "");
        root.classList.add("scanPopup--show");
        root.setAttribute("aria-hidden", "false");
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          close();
        }, 2600);
      };
      root.addEventListener("click", close);
      return { show, close };
    } catch {
      return { show: () => {
      }, close: () => {
      } };
    }
  })();
  const confirmPopup = (() => {
    const root = document.createElement("div");
    root.className = "scanPopup";
    root.setAttribute("aria-hidden", "true");
    const backdrop = document.createElement("div");
    backdrop.className = "scanPopup__backdrop";
    const frame = document.createElement("div");
    frame.className = "scanPopup__frame";
    frame.setAttribute("role", "dialog");
    frame.setAttribute("aria-modal", "true");
    frame.setAttribute("aria-label", "Confirmar cobro");
    const icon = document.createElement("div");
    icon.className = "scanPopup__icon";
    icon.innerHTML = `<svg viewBox="0 0 24 24" width="44" height="44" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.6"/><path d="M12 8v4l3 3" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`;
    const title = document.createElement("div");
    title.className = "scanPopup__title";
    const subtitle = document.createElement("div");
    subtitle.className = "scanPopup__subtitle";
    const actions = document.createElement("div");
    actions.className = "scanPopup__actions";
    actions.style.display = "flex";
    actions.style.gap = "12px";
    actions.style.marginTop = "24px";
    actions.style.width = "100%";
    const applyBtnStyles = (btn) => {
      btn.style.flex = "1";
      btn.style.padding = "14px";
      btn.style.borderRadius = "14px";
      btn.style.border = "1px solid rgba(255,255,255,0.1)";
      btn.style.background = "rgba(255,255,255,0.05)";
      btn.style.color = "#fff";
      btn.style.fontWeight = "600";
      btn.style.fontSize = "15px";
      btn.style.cursor = "pointer";
    };
    const btnCancel = document.createElement("button");
    btnCancel.type = "button";
    btnCancel.textContent = "Cancelar";
    applyBtnStyles(btnCancel);
    const btnAccept = document.createElement("button");
    btnAccept.type = "button";
    btnAccept.textContent = "Aceptar";
    applyBtnStyles(btnAccept);
    btnAccept.style.background = "#a5b4fc";
    btnAccept.style.color = "#1e1b4b";
    btnAccept.style.borderColor = "#a5b4fc";
    actions.appendChild(btnCancel);
    actions.appendChild(btnAccept);
    frame.appendChild(icon);
    frame.appendChild(title);
    frame.appendChild(subtitle);
    frame.appendChild(actions);
    root.appendChild(backdrop);
    root.appendChild(frame);
    document.body.appendChild(root);
    let currentResolve = null;
    const close = (result = false) => {
      root.classList.remove("scanPopup--show");
      root.setAttribute("aria-hidden", "true");
      if (currentResolve) {
        currentResolve(result);
        currentResolve = null;
      }
    };
    const request = ({ points, desc }) => {
      return new Promise((resolve) => {
        console.log("[QR Scanner] Mostrando modal de confirmacion con:", points, "pts. Descripci\xF3n:", desc);
        currentResolve = resolve;
        title.textContent = `Pagar ${points} pts`;
        subtitle.textContent = desc ? `Referencia: ${desc}` : "\xBFConfirmas el pago de puntos?";
        root.classList.add("scanPopup--show");
        root.setAttribute("aria-hidden", "false");
      });
    };
    btnCancel.addEventListener("click", () => close(false));
    btnAccept.addEventListener("click", () => close(true));
    backdrop.addEventListener("click", () => close(false));
    return { request };
  })();
  const getTokenFromUrl = () => {
    try {
      const url = new URL(window.location.href);
      const qp = (url.searchParams.get("token") || url.searchParams.get("t") || "").trim();
      if (qp) return qp;
      const path = url.pathname || "";
      if (path.startsWith("/card/")) {
        return decodeURIComponent(path.slice("/card/".length)).trim();
      }
    } catch {
    }
    return "";
  };
  const syncDisplayedBalance = (balance) => {
    const pointsEl = document.getElementById("points");
    const balanceEl = document.getElementById("clientBalance");
    const n = Number(balance);
    if (!Number.isFinite(n)) return;
    if (pointsEl) pointsEl.textContent = n.toFixed(2);
    const pointsCashEl = document.getElementById("pointsCash");
    if (pointsCashEl) pointsCashEl.textContent = `\u2248 ${(n / 100).toFixed(2)} $`;
    if (balanceEl) {
      balanceEl.textContent = n.toFixed(2);
      const detailCashEl = document.getElementById("clientBalanceCash");
      if (detailCashEl) detailCashEl.textContent = `\u2248 ${(n / 100).toFixed(2)} $`;
    }
  };
  const tryParseScannedUrl = (raw) => {
    const text = String(raw != null ? raw : "").trim();
    if (!text) return null;
    try {
      if (text.startsWith("http://") || text.startsWith("https://")) {
        return new URL(text);
      }
      if (/^[a-z0-9-]+\.[a-z]{2,}(\/|\?|$)/i.test(text)) {
        return new URL(`https://${text}`);
      }
      if (text.startsWith("/")) {
        return new URL(text, window.location.origin);
      }
      if (text.startsWith("?") && text.includes("points=") && text.includes("sig=")) {
        return new URL(`/api/pos/redeem${text}`, window.location.origin);
      }
      return new URL(`/${text}`, window.location.origin);
    } catch {
      return null;
    }
  };
  const extractRedeemParams = (raw) => {
    const url = tryParseScannedUrl(raw);
    const text = String(raw != null ? raw : "").trim();
    const fromUrl = (u) => {
      if (!u) return null;
      const pathname = u.pathname || "";
      if (!pathname.endsWith("/api/pos/redeem")) return null;
      const points = u.searchParams.get("points") || "";
      const ts = u.searchParams.get("ts") || "";
      const nonce = u.searchParams.get("nonce") || "";
      const desc = u.searchParams.get("desc") || "";
      const sig = u.searchParams.get("sig") || "";
      if (!points || !ts || !nonce || !sig) return null;
      return { points, ts, nonce, desc, sig, parsedFrom: "url" };
    };
    const direct = fromUrl(url);
    if (direct) return direct;
    if (text.includes("/api/pos/redeem")) {
      try {
        const idx = text.indexOf("/api/pos/redeem");
        const tail = text.slice(idx);
        const u = new URL(tail.startsWith("/") ? tail : `/${tail}`, window.location.origin);
        const p = fromUrl(u);
        if (p) return { ...p, parsedFrom: "tail" };
      } catch {
      }
    }
    return null;
  };
  const redeemIfChargeUrl = async (raw) => {
    const params = extractRedeemParams(raw);
    if (!params) return false;
    const confirmed = await confirmPopup.request({
      points: params.points,
      desc: params.desc
    });
    if (!confirmed) {
      return true;
    }
    const redeemUrl = new URL("/api/pos/redeem", window.location.origin);
    redeemUrl.searchParams.set("points", params.points);
    redeemUrl.searchParams.set("ts", params.ts);
    redeemUrl.searchParams.set("nonce", params.nonce);
    if (params.desc) redeemUrl.searchParams.set("desc", params.desc);
    redeemUrl.searchParams.set("sig", params.sig);
    const token = getTokenFromUrl();
    if (!token) {
      scanPopup.show({ kind: "err", headline: "Rechazada", detail: "Token requerido" });
      return true;
    }
    redeemUrl.searchParams.set("token", token);
    try {
      const res = await fetch(redeemUrl.toString(), { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !(data == null ? void 0 : data.ok)) {
        const msg = (data == null ? void 0 : data.error) || (data == null ? void 0 : data.message) || `Error (${res.status})`;
        const normalized = String(msg).toLowerCase();
        if (normalized.includes("insufficient balance") || normalized.includes("saldo")) {
          scanPopup.show({ kind: "err", headline: "Rechazada", detail: "Saldo insuficiente" });
        } else if (normalized.includes("expired")) {
          scanPopup.show({ kind: "err", headline: "Rechazada", detail: "QR vencido" });
        } else if (normalized.includes("not pending") || normalized.includes("used")) {
          scanPopup.show({ kind: "err", headline: "Rechazada", detail: "QR ya usado" });
        } else {
          scanPopup.show({ kind: "err", headline: "Rechazada", detail: "Error al cobrar" });
        }
        return true;
      }
      if (typeof data.balance !== "undefined") {
        syncDisplayedBalance(data.balance);
      }
      scanPopup.show({
        kind: "ok",
        headline: "Exitosa",
        detail: `Nuevo saldo: ${typeof data.balance !== "undefined" ? Number(data.balance).toFixed(2) : "\u2014"}`
      });
      try {
        window.dispatchEvent(new Event("wallet:activity-refresh"));
      } catch {
      }
      return true;
    } catch {
      scanPopup.show({ kind: "err", headline: "Rechazada", detail: "Error de red" });
      return true;
    }
  };
  const stopStream = () => {
    scanning = false;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  };
  const closeScanner = () => {
    stopStream();
    scanner.classList.remove("scanner--active");
    scanner.setAttribute("aria-hidden", "true");
  };
  const startScanLoop = async () => {
    if (!scanning) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (width && height) {
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(video, 0, 0, width, height);
        try {
          const imageData = ctx.getImageData(0, 0, width, height);
          if (window.jsQR) {
            const qr = window.jsQR(imageData.data, width, height);
            if (qr && qr.data) {
              scanning = false;
              stopStream();
              closeScanner();
              const handled = await redeemIfChargeUrl(qr.data);
              if (!handled) {
                scanPopup.show({ kind: "err", headline: "Rechazada", detail: "QR no v\xE1lido" });
              }
              return;
            }
          }
        } catch {
        }
      }
    }
    if (scanning) {
      window.requestAnimationFrame(() => {
        startScanLoop();
      });
    }
  };
  const openScanner = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      window.alert("Tu navegador no permite usar la c\xE1mara para escanear.");
      return;
    }
    hint.textContent = "Apunta al c\xF3digo QR para escanear";
    resultEl.textContent = "";
    scanner.classList.add("scanner--active");
    scanner.setAttribute("aria-hidden", "false");
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" }
        }
      });
      video.srcObject = stream;
      await video.play();
      scanning = true;
      window.requestAnimationFrame(startScanLoop);
    } catch (err) {
      closeScanner();
      if (err && err.name === "NotAllowedError") {
        window.alert("No se ha concedido permiso para usar la c\xE1mara.");
      } else {
        window.alert("No se ha podido iniciar la c\xE1mara.");
      }
    }
  };
  qrButton.addEventListener("click", () => {
    openScanner();
  });
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      closeScanner();
    });
  }
})();
(() => {
  const refreshBtn = document.getElementById("activityRefresh");
  const mainList = document.querySelector(".activity__list:not(#historyList)");
  const historyList = document.getElementById("historyList");
  const moreBtn = document.getElementById("activityMoreBtn");
  const historyModal = document.getElementById("historyModal");
  const historyCloseBtn = document.getElementById("historyCloseBtn");
  const historyLoadMoreBtn = document.getElementById("historyLoadMoreBtn");
  const historyLoading = document.getElementById("historyLoading");
  if (!refreshBtn || !mainList) return;
  const getTokenFromUrl = () => {
    try {
      const url = new URL(window.location.href);
      const qp = (url.searchParams.get("token") || url.searchParams.get("t") || "").trim();
      if (qp) return qp;
      const path = url.pathname || "";
      if (path.startsWith("/card/")) {
        return decodeURIComponent(path.slice("/card/".length)).trim();
      }
    } catch {
    }
    return "";
  };
  const iconSvg = {
    credit: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M12 5v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    debit: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
  };
  const formatTime = (iso) => {
    if (!iso) return "\u2014";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "\u2014";
    return d.toLocaleString("es-VE", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };
  const clearList = (targetList) => {
    if (targetList) targetList.innerHTML = "";
  };
  const renderEmpty = (targetList, text) => {
    if (!targetList) return;
    clearList(targetList);
    const li = document.createElement("li");
    li.className = "activity__item";
    li.innerHTML = `<div class="activity__icon"></div><div class="activity__text"><div class="activity__name">${text}</div><div class="activity__time"></div></div><div class="activity__amount"></div>`;
    targetList.appendChild(li);
  };
  const computeDelta = (t) => {
    const before = Number.isFinite(Number(t.balanceBefore)) ? Number(t.balanceBefore) : null;
    const after = Number.isFinite(Number(t.balanceAfter)) ? Number(t.balanceAfter) : null;
    if (before !== null && after !== null) return after - before;
    const pts = Number.isFinite(Number(t.points)) ? Number(t.points) : 0;
    if (String(t.type || "") === "pos_charge") return -Math.abs(pts);
    if (String(t.type || "").includes("credit")) return Math.abs(pts);
    return pts;
  };
  const getTitle = (t, delta) => {
    const desc = String(t.description || "").trim();
    if (desc) return desc;
    const type = String(t.type || "").trim();
    if (type === "pos_charge") return "Pago";
    if (type.includes("credit")) return "Cr\xE9dito";
    if (delta < 0) return "Pago";
    if (delta > 0) return "Cr\xE9dito";
    return "Movimiento";
  };
  const createTxElement = (t) => {
    const delta = computeDelta(t);
    const isNeg = delta < 0;
    const li = document.createElement("li");
    li.className = "activity__item";
    const icon = document.createElement("div");
    icon.className = "activity__icon";
    icon.innerHTML = isNeg ? iconSvg.debit : iconSvg.credit;
    const text = document.createElement("div");
    text.className = "activity__text";
    const name = document.createElement("div");
    name.className = "activity__name";
    name.textContent = getTitle(t, delta);
    const time = document.createElement("div");
    time.className = "activity__time";
    time.textContent = formatTime(t.processedAt || t.createdAt);
    text.appendChild(name);
    text.appendChild(time);
    const amount = document.createElement("div");
    amount.className = `activity__amount${isNeg ? " activity__amount--neg" : ""}`;
    const abs = Math.abs(Number(delta) || 0);
    amount.textContent = `${isNeg ? "-" : "+"}${abs.toFixed(2)}`;
    li.appendChild(icon);
    li.appendChild(text);
    li.appendChild(amount);
    return li;
  };
  const render = (targetList, transactions, append = false) => {
    if (!targetList) return;
    if (!append) clearList(targetList);
    const txs = Array.isArray(transactions) ? transactions : [];
    if (!txs.length && !append) {
      renderEmpty(targetList, "Sin actividad");
      return;
    }
    for (const t of txs) {
      targetList.appendChild(createTxElement(t));
    }
  };
  let loading = false;
  let lastVisibleTx = null;
  const PAGE_SIZE = 2;
  const cargarMasTransacciones = async () => {
    if (loading || !lastVisibleTx) return;
    const token = getTokenFromUrl();
    if (!token) return;
    loading = true;
    if (historyLoadMoreBtn) historyLoadMoreBtn.hidden = true;
    if (historyLoading) historyLoading.hidden = false;
    try {
      const url = `/api/card?mode=activity&token=${encodeURIComponent(token)}&limit=${PAGE_SIZE}&afterDate=${encodeURIComponent(lastVisibleTx.date)}&afterId=${encodeURIComponent(lastVisibleTx.id)}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !(data == null ? void 0 : data.ok)) throw new Error((data == null ? void 0 : data.error) || "Error");
      const txs = Array.isArray(data == null ? void 0 : data.transactions) ? data.transactions : [];
      if (txs.length > 0) {
        render(historyList, txs, true);
        const last = txs[txs.length - 1];
        lastVisibleTx = { id: last.id, date: last.processedAt || last.createdAt };
      }
      if (historyLoadMoreBtn) {
        historyLoadMoreBtn.hidden = txs.length < PAGE_SIZE;
      }
    } catch (err) {
      console.error("Error cargando m\xE1s transacciones:", err);
    } finally {
      loading = false;
      if (historyLoading) historyLoading.hidden = true;
    }
  };
  const loadActivity = async () => {
    if (loading) return;
    const token = getTokenFromUrl();
    if (!token) return;
    loading = true;
    lastVisibleTx = null;
    refreshBtn.disabled = true;
    renderEmpty(mainList, "Cargando...");
    if (historyList) renderEmpty(historyList, "Cargando...");
    if (historyLoadMoreBtn) historyLoadMoreBtn.hidden = true;
    try {
      const res = await fetch(`/api/card?mode=activity&token=${encodeURIComponent(token)}&limit=${PAGE_SIZE}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !(data == null ? void 0 : data.ok)) {
        const msg = (data == null ? void 0 : data.error) || (data == null ? void 0 : data.message) || `Error (${res.status})`;
        renderEmpty(mainList, msg);
        if (historyList) renderEmpty(historyList, msg);
        return;
      }
      const txs = Array.isArray(data == null ? void 0 : data.transactions) ? data.transactions : [];
      render(mainList, txs);
      if (historyList) render(historyList, txs);
      if (txs.length > 0) {
        const last = txs[txs.length - 1];
        lastVisibleTx = { id: last.id, date: last.processedAt || last.createdAt };
      }
      if (moreBtn) moreBtn.hidden = txs.length < PAGE_SIZE;
      if (historyLoadMoreBtn) historyLoadMoreBtn.hidden = txs.length < PAGE_SIZE;
    } catch {
      renderEmpty(mainList, "Error de red");
      if (historyList) renderEmpty(historyList, "Error de red");
    } finally {
      loading = false;
      refreshBtn.disabled = false;
    }
  };
  if (moreBtn && historyModal && historyCloseBtn) {
    moreBtn.addEventListener("click", () => {
      historyModal.classList.add("historyModal--active");
      historyModal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    });
    historyCloseBtn.addEventListener("click", () => {
      historyModal.classList.remove("historyModal--active");
      historyModal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    });
  }
  if (historyLoadMoreBtn) {
    historyLoadMoreBtn.addEventListener("click", cargarMasTransacciones);
  }
  refreshBtn.addEventListener("click", () => {
    loadActivity();
    if (typeof window.loadCardData === "function") {
      window.loadCardData();
    }
  });
  window.addEventListener("wallet:activity-refresh", () => {
    loadActivity();
  });
  loadActivity();
})();
const themeColorMeta = document.getElementById("themeColor");
if (themeColorMeta && window.matchMedia) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const applyThemeColor = () => {
    themeColorMeta.setAttribute("content", mq.matches ? "#000000" : "#f6f7fb");
  };
  applyThemeColor();
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", applyThemeColor);
  } else {
    mq.addListener(applyThemeColor);
  }
}
