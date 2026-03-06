/* PWA: SW register */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // Use absolute path so it works for deep links like /card/<token>
    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // Intentionally silent: avoid noisy UI for a design-only PWA.
    });
  });
}

/* Stable viewport height for PWA/mobile (prevents bottom CTA from falling off-screen) */
(() => {
  const setAppHeightVar = () => {
    document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
  };

  setAppHeightVar();
  window.addEventListener("resize", setAppHeightVar);
  window.addEventListener("orientationchange", setAppHeightVar);
})();

/* PWA install prompt capture (Chrome/Edge/Android/desktop) */
let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

/* CTA glow on tap/click (works reliably on iOS) */
const qrButton = document.getElementById("qrButton");
if (qrButton) {
  const pulse = () => {
    qrButton.classList.remove("is-glowing");
    // Force reflow so repeated taps retrigger the transition.
    void qrButton.offsetWidth;
    qrButton.classList.add("is-glowing");
    window.setTimeout(() => qrButton.classList.remove("is-glowing"), 320);
  };

  qrButton.addEventListener("click", pulse);
  qrButton.addEventListener("touchend", pulse, { passive: true });
}

/* Client card details reveal (tap card to show name/id/balance) */
(() => {
  const card = document.getElementById("clientCard");
  if (!card) return;

  const details = document.getElementById("cardDetails");
  const pointsEl = document.getElementById("points");
  const balanceEl = document.getElementById("clientBalance");
  const nameEl = document.getElementById("clientName");
  const idEl = document.getElementById("clientId");
  const greetingNameEl = document.getElementById("greetingName");
  const avatarInitialsEl = document.getElementById("avatarInitials");
  const updatedEl = document.getElementById("cardUpdated");

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
      // Ignore.
    }
    return "";
  };

  const getGreetingNameFromFullName = (fullName) => {
    const parts = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
    return parts[0] || "";
  };

  const getInitialsFromFullName = (fullName) => {
    const parts = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
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

    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

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
    pointsEl.textContent = String(n);
  };

  const loadCardData = async () => {
    const token = getTokenFromUrl();
    if (!token) return;

    try {
      const res = await fetch(`/api/card?token=${encodeURIComponent(token)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
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
      }
    } catch {
      // Ignore network/parse errors.
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
      }, 5000);
    }
  };

  const syncBalance = () => {
    if (!balanceEl) return;
    const raw = pointsEl?.textContent ?? "0";
    balanceEl.textContent = raw.replace(/\s+/g, "").trim() || "0";
  };

  const initialToken = getTokenFromUrl();

  if (initialToken) {
    // Avoid flashing hardcoded user details when we're going to load from DB.
    if (nameEl) nameEl.textContent = "Cargando...";
    if (idEl) idEl.textContent = "—";
    if (greetingNameEl) greetingNameEl.textContent = "...";
    if (avatarInitialsEl) avatarInitialsEl.textContent = "...";
    if (updatedEl) updatedEl.textContent = "Actualizando...";
    setPoints(0);
  } else {
    // Root domain without token shows admin panel (password required).
    if (greetingNameEl) greetingNameEl.textContent = "Admin";
    if (avatarInitialsEl) avatarInitialsEl.textContent = "AD";
    if (updatedEl) updatedEl.textContent = "";
    setPoints(0);

    const headerLabel = document.getElementById('headerLabel');
    if (headerLabel) headerLabel.textContent = "Panel administrador";

    // Hide client wallet UI.
    card.hidden = true;
    const activity = document.querySelector('.activity');
    if (activity) activity.hidden = true;
    const cta = document.querySelector('.cta');
    if (cta) cta.hidden = true;

    const loginCard = document.getElementById('adminRootLogin');
    const loginForm = document.getElementById('adminRootLoginForm');
    const passwordEl = document.getElementById('adminRootPassword');
    const loginResultEl = document.getElementById('adminRootLoginResult');

    const panelCard = document.getElementById('adminRootPanel');
    const clientsCard = document.getElementById('adminRootClients');
    const cardTxCard = document.getElementById('adminRootCardTx');
    const allTxCard = document.getElementById('adminRootAllTx');

    const goCards = document.getElementById('adminRootGoCards');
    const goQr = document.getElementById('adminRootGoQr');
    const txRefresh = document.getElementById('adminTxRefresh');

    const clientsList = document.getElementById('adminClientsList');
    const clientsResult = document.getElementById('adminClientsResult');
    const cardTxHint = document.getElementById('adminCardTxHint');
    const cardTxList = document.getElementById('adminCardTxList');
    const cardTxResult = document.getElementById('adminCardTxResult');
    const txList = document.getElementById('adminTxList');
    const txResult = document.getElementById('adminTxResult');

    const setLoginResult = (type, message) => {
      if (!loginResultEl) return;
      loginResultEl.classList.remove('adminResult--ok', 'adminResult--err', 'adminResult--info');
      loginResultEl.classList.add(type);
      loginResultEl.textContent = message;
    };

    const setText = (el, text) => {
      if (!el) return;
      el.textContent = String(text ?? '');
    };

    const setAuthenticatedUi = (authed) => {
      if (loginCard) loginCard.hidden = authed;
      if (panelCard) panelCard.hidden = !authed;
      if (clientsCard) clientsCard.hidden = !authed;
      if (cardTxCard) cardTxCard.hidden = !authed;
      if (allTxCard) allTxCard.hidden = !authed;
    };

    const renderButtonsList = (container, items) => {
      if (!container) return;
      container.innerHTML = '';
      for (const item of items) {
        container.appendChild(item);
      }
      if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'adminResult';
        empty.textContent = 'Sin resultados';
        container.appendChild(empty);
      }
    };

    const renderTxList = (container, transactions) => {
      if (!container) return;
      container.innerHTML = '';
      for (const t of transactions) {
        const row = document.createElement('div');
        row.className = 'adminResult';
        const status = t.status || '—';
        const pts = Number.isFinite(Number(t.points)) ? Number(t.points) : 0;
        const token = t.token ? ` · ${t.token}` : '';
        const desc = t.description ? ` · ${t.description}` : '';
        row.textContent = `${status} · ${pts}${token}${desc}`;
        container.appendChild(row);
      }
      if (!transactions.length) {
        const empty = document.createElement('div');
        empty.className = 'adminResult';
        empty.textContent = 'Sin transacciones';
        container.appendChild(empty);
      }
    };

    const apiGet = async (path) => {
      const res = await fetch(path, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.error || data?.message || `Error (${res.status})`;
        const err = new Error(msg);
        err.status = res.status;
        throw err;
      }
      return data;
    };

    const loadClients = async () => {
      setText(clientsResult, 'Cargando...');
      try {
        const data = await apiGet('/api/admin/cards?limit=80');
        const cards = Array.isArray(data?.cards) ? data.cards : [];

        const els = cards.map((c) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'adminButton adminButton--ghost';
          b.style.width = '100%';
          b.style.textAlign = 'left';
          const name = String(c?.name ?? '').trim() || '—';
          const cedula = String(c?.cedula ?? '').trim();
          const bal = Number.isFinite(Number(c?.balance)) ? Number(c.balance) : 0;
          const token = String(c?.token ?? '').trim();
          b.textContent = `${name}${cedula ? ` · ${cedula}` : ''} · ${bal} pts`;
          b.addEventListener('click', () => {
            if (cardTxHint) cardTxHint.textContent = `Token: ${token}`;
            loadCardTransactions(token);
          });
          return b;
        });

        renderButtonsList(clientsList, els);
        setText(clientsResult, '');
      } catch (err) {
        if (err?.status === 401) {
          setAuthenticatedUi(false);
          setLoginResult('adminResult--err', 'Sesión expirada.');
          return;
        }
        setText(clientsResult, err?.message ?? 'Error');
      }
    };

    const loadAllTransactions = async () => {
      setText(txResult, 'Cargando...');
      try {
        const data = await apiGet('/api/admin/transactions?limit=80');
        const txs = Array.isArray(data?.transactions) ? data.transactions : [];
        renderTxList(txList, txs);
        setText(txResult, '');
      } catch (err) {
        if (err?.status === 401) {
          setAuthenticatedUi(false);
          setLoginResult('adminResult--err', 'Sesión expirada.');
          return;
        }
        setText(txResult, err?.message ?? 'Error');
      }
    };

    const loadCardTransactions = async (token) => {
      setText(cardTxResult, 'Cargando...');
      try {
        const data = await apiGet(`/api/admin/transactions?token=${encodeURIComponent(token)}&limit=80`);
        const txs = Array.isArray(data?.transactions) ? data.transactions : [];
        renderTxList(cardTxList, txs);
        setText(cardTxResult, '');
      } catch (err) {
        if (err?.status === 401) {
          setAuthenticatedUi(false);
          setLoginResult('adminResult--err', 'Sesión expirada.');
          return;
        }
        setText(cardTxResult, err?.message ?? 'Error');
      }
    };

    const initAuthed = () => {
      setAuthenticatedUi(true);
      if (goCards) goCards.addEventListener('click', () => { window.location.href = '/admin'; });
      if (goQr) goQr.addEventListener('click', () => { window.location.href = '/admin/qr'; });
      if (txRefresh) txRefresh.addEventListener('click', () => { loadClients(); loadAllTransactions(); });

      loadClients();
      loadAllTransactions();
      if (cardTxHint) cardTxHint.textContent = 'Selecciona un cliente.';
      if (cardTxList) cardTxList.innerHTML = '';
      if (cardTxResult) cardTxResult.textContent = '';
    };

    const checkAuth = async () => {
      try {
        const data = await apiGet('/api/admin/me');
        const authed = Boolean(data?.authenticated);
        if (authed) {
          initAuthed();
        } else {
          setAuthenticatedUi(false);
        }
      } catch {
        setAuthenticatedUi(false);
      }
    };

    // Show login by default until we know session state.
    setAuthenticatedUi(false);

    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = String(passwordEl?.value ?? '').trim();
        if (!password) {
          setLoginResult('adminResult--err', 'Password requerido.');
          return;
        }

        setLoginResult('adminResult--info', 'Entrando...');
        try {
          const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            const msg = data?.error || data?.message || `Error (${res.status})`;
            setLoginResult('adminResult--err', msg);
            return;
          }

          setLoginResult('adminResult--ok', 'Listo.');
          if (passwordEl) passwordEl.value = '';
          initAuthed();
        } catch {
          setLoginResult('adminResult--err', 'Fallo de red.');
        }
      });
    }

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

  // Prevent long-press context menu (e.g., save image) and drag behaviors.
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
    // Fallback
    card.addEventListener("click", toggle);
  }
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  });
})();

/* Profile menu modal + install recommendation */
(() => {
  const profileButton = document.getElementById("profileButton");
  const menu = document.getElementById("profileMenu");
  const closeBtn = document.getElementById("profileClose");
  const installBtn = document.getElementById("installPwa");
  const hint = document.getElementById("installHint");

  if (!profileButton || !menu) return;

  const isStandalone = () => {
    // iOS Safari uses navigator.standalone
    const iosStandalone = typeof navigator.standalone === "boolean" && navigator.standalone;
    const displayModeStandalone =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches;
    return Boolean(iosStandalone || displayModeStandalone);
  };

  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

  const INSTALL_NUDGE_KEY = "wallet.installNudgeSeen";
  const hasSeenInstallNudge = () => {
    try {
      return localStorage.getItem(INSTALL_NUDGE_KEY) === "1";
    } catch {
      return false;
    }
  };

  const markInstallNudgeSeen = () => {
    try {
      localStorage.setItem(INSTALL_NUDGE_KEY, "1");
    } catch {
      // Ignore.
    }
  };

  let lastFocus = null;

  const setOpen = (open) => {
    menu.classList.toggle("profileMenu--active", open);
    menu.setAttribute("aria-hidden", open ? "false" : "true");
    profileButton.setAttribute("aria-expanded", open ? "true" : "false");

    if (open) {
      lastFocus = document.activeElement;
      if (hint) hint.textContent = "";
      window.setTimeout(() => (closeBtn ?? installBtn ?? profileButton).focus(), 0);
    } else {
      const target = lastFocus instanceof HTMLElement ? lastFocus : profileButton;
      window.setTimeout(() => target.focus(), 0);
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

  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (isStandalone()) {
        if (hint) hint.textContent = "Ya estás usando la app instalada.";
        return;
      }

      if (deferredInstallPrompt) {
        try {
          deferredInstallPrompt.prompt();
          await deferredInstallPrompt.userChoice;
        } catch {
          // Ignore.
        } finally {
          deferredInstallPrompt = null;
          close();
        }
        return;
      }

      // No native prompt available (common on iOS).
      if (!hint) return;
      if (isIOS()) {
        hint.textContent = "En iPhone/iPad: Compartir → “Añadir a pantalla de inicio”.";
      } else {
        hint.textContent = "En Chrome/Edge: menú del navegador → “Instalar app”.";
      }
    });
  }

  // First-visit nudge: show only the native install confirmation when possible.
  // Browsers require a user gesture to show the install prompt.
  const onFirstUserGesture = async () => {
    if (hasSeenInstallNudge() || isStandalone()) return;
    markInstallNudgeSeen();

    if (deferredInstallPrompt) {
      try {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
      } catch {
        // Ignore.
      } finally {
        deferredInstallPrompt = null;
      }
      return;
    }

    // No native prompt available (common on iOS): show instructions in our modal.
    open();
    if (hint) {
      hint.textContent = isIOS()
        ? "En iPhone/iPad: Compartir → “Añadir a pantalla de inicio”."
        : "En Chrome/Edge: menú del navegador → “Instalar app”.";
    }
  };

  // Use pointerup so it feels like a normal click/tap.
  window.addEventListener(
    "pointerup",
    () => {
      onFirstUserGesture();
    },
    { once: true }
  );
})();

/* QR Scanner: open camera and decode QR codes */
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

  // Temporary popup feedback (toast)
  const toast = (() => {
    try {
      const root = document.createElement("div");
      root.className = "toast";
      const frame = document.createElement("div");
      frame.className = "toast__frame";
      frame.setAttribute("role", "status");
      frame.setAttribute("aria-live", "polite");
      root.appendChild(frame);
      document.body.appendChild(root);

      let timer = null;
      const show = (message) => {
        frame.textContent = String(message ?? "");
        root.classList.add("toast--show");
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          root.classList.remove("toast--show");
        }, 2400);
      };

      return { show };
    } catch {
      return { show: () => {} };
    }
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
      // Ignore.
    }
    return "";
  };

  const syncDisplayedBalance = (balance) => {
    const pointsEl = document.getElementById("points");
    const balanceEl = document.getElementById("clientBalance");
    const n = Number(balance);
    if (!Number.isFinite(n)) return;
    if (pointsEl) pointsEl.textContent = String(n);
    if (balanceEl) balanceEl.textContent = String(n);
  };

  const tryParseScannedUrl = (raw) => {
    const text = String(raw ?? "").trim();
    if (!text) return null;
    try {
      if (text.startsWith("http://") || text.startsWith("https://")) {
        return new URL(text);
      }
      // Common: domain/path without scheme (e.g. lealtad-three.vercel.app/api/pos/redeem?...)
      if (/^[a-z0-9-]+\.[a-z]{2,}(\/|\?|$)/i.test(text)) {
        return new URL(`https://${text}`);
      }
      if (text.startsWith("/")) {
        return new URL(text, window.location.origin);
      }
      // Common: querystring only
      if (text.startsWith("?") && text.includes("points=") && text.includes("sig=")) {
        return new URL(`/api/pos/redeem${text}`, window.location.origin);
      }
      // Last resort: treat as a relative path
      return new URL(`/${text}`, window.location.origin);
    } catch {
      return null;
    }
  };

  const extractRedeemParams = (raw) => {
    const url = tryParseScannedUrl(raw);
    const text = String(raw ?? "").trim();

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

    // Fallback: sometimes scanners give only the path portion
    if (text.includes("/api/pos/redeem")) {
      try {
        const idx = text.indexOf("/api/pos/redeem");
        const tail = text.slice(idx);
        const u = new URL(tail.startsWith("/") ? tail : `/${tail}`, window.location.origin);
        const p = fromUrl(u);
        if (p) return { ...p, parsedFrom: "tail" };
      } catch {
        // Ignore.
      }
    }

    return null;
  };

  const redeemIfChargeUrl = async (raw) => {
    const params = extractRedeemParams(raw);
    if (!params) return false;

    // Always redeem against the current origin to avoid cross-domain/CORS issues.
    const redeemUrl = new URL("/api/pos/redeem", window.location.origin);
    redeemUrl.searchParams.set("points", params.points);
    redeemUrl.searchParams.set("ts", params.ts);
    redeemUrl.searchParams.set("nonce", params.nonce);
    if (params.desc) redeemUrl.searchParams.set("desc", params.desc);
    redeemUrl.searchParams.set("sig", params.sig);

    const token = getTokenFromUrl();
    if (!token) {
      hint.textContent = "Token requerido";
      resultEl.textContent = "";
      toast.show("Token requerido");
      return true;
    }

    redeemUrl.searchParams.set("token", token);

    hint.textContent = "Procesando cobro...";
    resultEl.textContent = "";

    try {
      const res = await fetch(redeemUrl.toString(), { cache: "no-store" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        const msg = data?.error || data?.message || `Error (${res.status})`;
        hint.textContent = "Cobro no aplicado";
        resultEl.textContent = msg;

        const normalized = String(msg).toLowerCase();
        if (normalized.includes("insufficient balance") || normalized.includes("saldo")) {
          toast.show("Saldo insuficiente");
        } else if (normalized.includes("expired")) {
          toast.show("QR vencido");
        } else if (normalized.includes("not pending") || normalized.includes("used")) {
          toast.show("QR ya usado");
        } else {
          toast.show("Error al cobrar");
        }
        return true;
      }

      if (typeof data.balance !== "undefined") {
        syncDisplayedBalance(data.balance);
      }

      hint.textContent = "Cobro aplicado";
      resultEl.textContent = `Nuevo saldo: ${data.balance}`;
      toast.show(`Transacción exitosa. Nuevo saldo: ${data.balance}`);
      return true;
    } catch {
      hint.textContent = "Cobro no aplicado";
      resultEl.textContent = "Fallo de red";
      toast.show("Error de red");
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
              const handled = await redeemIfChargeUrl(qr.data);
              if (!handled) {
                const raw = String(qr.data ?? "").trim();
                const preview = raw.length > 160 ? `${raw.slice(0, 160)}…` : raw;
                resultEl.textContent = preview || "QR no válido";
                hint.textContent = "No se pudo procesar";
                toast.show("QR no válido");
              }

              // Cerrar automáticamente tras un breve momento
              window.setTimeout(closeScanner, 1400);
              return;
            }
          }
        } catch {
          // Ignorar errores de lectura de frame
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
      window.alert("Tu navegador no permite usar la cámara para escanear.");
      return;
    }

    hint.textContent = "Apunta al código QR para escanear";
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
        window.alert("No se ha concedido permiso para usar la cámara.");
      } else {
        window.alert("No se ha podido iniciar la cámara.");
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

/* Activity refresh button */
(() => {
  const refreshBtn = document.getElementById("activityRefresh");
  if (!refreshBtn) return;
  refreshBtn.addEventListener("click", () => {
    window.location.reload();
  });
})();

/* Match system light/dark and keep theme-color in sync */
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
