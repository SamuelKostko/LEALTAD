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
    document.body.classList.add('mode-admin');
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
    const adminLogout = document.getElementById('adminLogout');

    const clientsList = document.getElementById('adminClientsList');
    const clientSelect = document.getElementById('adminClientSelect');
    const clientsResult = document.getElementById('adminClientsResult');
    const cardTxHint = document.getElementById('adminCardTxHint');
    const cardTxList = document.getElementById('adminCardTxList');
    const cardTxResult = document.getElementById('adminCardTxResult');
    const txList = document.getElementById('adminTxList');
    const txResult = document.getElementById('adminTxResult');

    let selectedToken = '';
    let tokenToDisplayName = new Map();
    let clientSelectBound = false;

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

    const updateClientTxVisibility = () => {
      if (!cardTxCard) return;
      cardTxCard.hidden = !selectedToken;
      if (allTxCard) allTxCard.hidden = !!selectedToken;
    };

    const formatTxDate = (tx) => {
      const iso = tx.processedAt || tx.createdAt || '';
      if (!iso) return '—';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleString('es-VE', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const renderTxList = (container, transactions, mode) => {
      if (!container) return;
      container.innerHTML = '';
      container.className = `adminTable ${mode === 'card' ? 'adminTable--card' : 'adminTable--all'}`;

      if (!transactions.length) {
        const empty = document.createElement('div');
        empty.className = 'adminResult';
        empty.textContent = 'Sin transacciones';
        container.appendChild(empty);
        return;
      }

      const head = document.createElement('div');
      head.className = 'adminTableRow adminTableRow--head';
      const headCells = mode === 'card'
        ? ['Fecha', 'Tipo', 'Estado', 'Pts', 'Antes', 'Después', 'Descripción']
        : ['Fecha', 'Tipo', 'Estado', 'Pts', 'Cliente', 'Descripción'];
      for (const label of headCells) {
        const c = document.createElement('div');
        c.className = 'adminTableCell adminTableCell--muted';
        c.textContent = label;
        head.appendChild(c);
      }
      container.appendChild(head);

      for (const t of transactions) {
        const row = document.createElement('div');
        row.className = 'adminTableRow';

        const status = String(t.status || '—');
        const pts = Number.isFinite(Number(t.points)) ? Number(t.points) : 0;
        const type = String(t.type || '');
        const tokenText = String(t.token || '');
        const descText = String(t.description || '');

        const before = Number.isFinite(Number(t.balanceBefore)) ? Number(t.balanceBefore) : null;
        const after = Number.isFinite(Number(t.balanceAfter)) ? Number(t.balanceAfter) : null;

        const cells = [];

        const dateCell = document.createElement('div');
        dateCell.className = 'adminTableCell adminTableCell--muted';
        dateCell.textContent = formatTxDate(t);
        cells.push(dateCell);

        const typeCell = document.createElement('div');
        typeCell.className = 'adminTableCell adminTableCell--muted';
        typeCell.textContent = type || '—';
        cells.push(typeCell);

        const statusCell = document.createElement('div');
        statusCell.className = 'adminTableCell adminTableCell--strong';
        statusCell.textContent = status;
        cells.push(statusCell);

        const ptsCell = document.createElement('div');
        ptsCell.className = 'adminTableCell adminTableCell--strong';
        ptsCell.textContent = String(pts);
        cells.push(ptsCell);

        if (mode === 'card') {
          const beforeCell = document.createElement('div');
          beforeCell.className = 'adminTableCell adminTableCell--muted';
          beforeCell.textContent = before === null ? '—' : String(before);
          cells.push(beforeCell);

          const afterCell = document.createElement('div');
          afterCell.className = 'adminTableCell adminTableCell--muted';
          afterCell.textContent = after === null ? '—' : String(after);
          cells.push(afterCell);
        } else {
          const tokenCell = document.createElement('div');
          tokenCell.className = 'adminTableCell adminTableCell--muted';
          const nameText = String(t?.name || '').trim();
          tokenCell.textContent = nameText || tokenText || '—';
          cells.push(tokenCell);
        }

        const descCell = document.createElement('div');
        descCell.className = 'adminTableCell';
        descCell.textContent = descText || '—';
        cells.push(descCell);

        for (const c of cells) row.appendChild(c);
        container.appendChild(row);
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

        tokenToDisplayName = new Map();

        if (clientSelect) {
          clientSelect.innerHTML = '';

          const placeholder = document.createElement('option');
          placeholder.value = '';
          placeholder.textContent = 'Selecciona un cliente…';
          clientSelect.appendChild(placeholder);

          for (const c of cards) {
            const name = String(c?.name ?? '').trim() || '—';
            const cedula = String(c?.cedula ?? '').trim();
            const bal = Number.isFinite(Number(c?.balance)) ? Number(c.balance) : 0;
            const token = String(c?.token ?? '').trim();
            if (!token) continue;

            tokenToDisplayName.set(token, name);

            const opt = document.createElement('option');
            opt.value = token;
            opt.textContent = `${name}${cedula ? ` · ${cedula}` : ''} · ${bal} pts`;
            clientSelect.appendChild(opt);
          }

          clientSelect.value = selectedToken;
        }

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
        renderTxList(txList, txs, 'all');
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
        renderTxList(cardTxList, txs, 'card');
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

      // Show only the recent transactions by default.
      selectedToken = '';
      updateClientTxVisibility();
      if (cardTxHint) cardTxHint.textContent = 'Selecciona un cliente.';
      if (cardTxList) cardTxList.innerHTML = '';
      if (cardTxResult) cardTxResult.textContent = '';

      if (clientSelect) {
        if (!clientSelectBound) {
          clientSelectBound = true;
          clientSelect.addEventListener('change', () => {
            selectedToken = String(clientSelect.value || '').trim();
            updateClientTxVisibility();

            if (!selectedToken) {
              if (cardTxHint) cardTxHint.textContent = 'Selecciona un cliente.';
              if (cardTxList) cardTxList.innerHTML = '';
              if (cardTxResult) cardTxResult.textContent = '';
              return;
            }

            const displayName = tokenToDisplayName.get(selectedToken) || '—';
            if (cardTxHint) cardTxHint.textContent = `Cliente: ${displayName}`;
            loadCardTransactions(selectedToken);
          });
        }
      }

      if (goCards) goCards.addEventListener('click', () => { window.location.href = '/admin'; });
      if (goQr) goQr.addEventListener('click', () => { window.location.href = '/admin/qr'; });
      if (txRefresh) txRefresh.addEventListener('click', () => {
        loadClients();
        loadAllTransactions();
        if (selectedToken) loadCardTransactions(selectedToken);
      });

      if (adminLogout) {
        adminLogout.hidden = false;
        adminLogout.addEventListener('click', async () => {
          try {
            await fetch('/api/admin/logout', { method: 'POST' });
          } catch {
            // Ignore.
          }

          if (clientSelect) {
            clientSelect.innerHTML = '';
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Selecciona un cliente…';
            clientSelect.appendChild(placeholder);
            clientSelect.value = '';
          }
          if (cardTxList) cardTxList.innerHTML = '';
          if (txList) txList.innerHTML = '';
          if (cardTxHint) cardTxHint.textContent = 'Selecciona un cliente.';
          selectedToken = '';
          updateClientTxVisibility();
          setAuthenticatedUi(false);
          setLoginResult('adminResult--info', 'Sesión cerrada.');
        });
      }

      loadClients();
      loadAllTransactions();
    };

    const checkAuth = async () => {
      try {
        const data = await apiGet('/api/admin/me');
        const authed = Boolean(data?.authenticated);
        if (authed) {
          initAuthed();
        } else {
          setAuthenticatedUi(false);
          if (adminLogout) adminLogout.hidden = true;
        }
      } catch {
        setAuthenticatedUi(false);
        if (adminLogout) adminLogout.hidden = true;
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

  // Large scan result popup (success / rejected)
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
        title.textContent = String(headline ?? "");
        subtitle.textContent = String(detail ?? "");
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
      return { show: () => {}, close: () => {} };
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
      scanPopup.show({ kind: "err", headline: "Rechazada", detail: "Token requerido" });
      return true;
    }

    redeemUrl.searchParams.set("token", token);

    try {
      const res = await fetch(redeemUrl.toString(), { cache: "no-store" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        const msg = data?.error || data?.message || `Error (${res.status})`;
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
        detail: `Nuevo saldo: ${typeof data.balance !== "undefined" ? data.balance : "—"}`
      });

      try {
        window.dispatchEvent(new Event('wallet:activity-refresh'));
      } catch {
        // Ignore.
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
                scanPopup.show({ kind: "err", headline: "Rechazada", detail: "QR no válido" });
              }
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

/* Activity: show transaction history */
(() => {
  const refreshBtn = document.getElementById('activityRefresh');
  const list = document.querySelector('.activity__list');
  if (!refreshBtn || !list) return;

  const getTokenFromUrl = () => {
    try {
      const url = new URL(window.location.href);
      const qp = (url.searchParams.get('token') || url.searchParams.get('t') || '').trim();
      if (qp) return qp;

      const path = url.pathname || '';
      if (path.startsWith('/card/')) {
        return decodeURIComponent(path.slice('/card/'.length)).trim();
      }
    } catch {
      // Ignore.
    }
    return '';
  };

  const iconSvg = {
    credit: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M12 5v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    debit: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
  };

  const formatTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-VE', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const clearList = () => {
    list.innerHTML = '';
  };

  const renderEmpty = (text) => {
    clearList();
    const li = document.createElement('li');
    li.className = 'activity__item';
    li.innerHTML = `<div class="activity__icon"></div><div class="activity__text"><div class="activity__name">${text}</div><div class="activity__time"></div></div><div class="activity__amount"></div>`;
    list.appendChild(li);
  };

  const computeDelta = (t) => {
    const before = Number.isFinite(Number(t.balanceBefore)) ? Number(t.balanceBefore) : null;
    const after = Number.isFinite(Number(t.balanceAfter)) ? Number(t.balanceAfter) : null;
    if (before !== null && after !== null) return after - before;

    const pts = Number.isFinite(Number(t.points)) ? Number(t.points) : 0;
    if (String(t.type || '') === 'pos_charge') return -Math.abs(pts);
    if (String(t.type || '').includes('credit')) return Math.abs(pts);
    return pts;
  };

  const getTitle = (t, delta) => {
    const desc = String(t.description || '').trim();
    if (desc) return desc;

    const type = String(t.type || '').trim();
    if (type === 'pos_charge') return 'Pago';
    if (type.includes('credit')) return 'Crédito';
    if (delta < 0) return 'Pago';
    if (delta > 0) return 'Crédito';
    return 'Movimiento';
  };

  const render = (transactions) => {
    clearList();

    const txs = Array.isArray(transactions) ? transactions : [];
    if (!txs.length) {
      renderEmpty('Sin actividad');
      return;
    }

    for (const t of txs) {
      const delta = computeDelta(t);
      const isNeg = delta < 0;

      const li = document.createElement('li');
      li.className = 'activity__item';

      const icon = document.createElement('div');
      icon.className = 'activity__icon';
      icon.innerHTML = isNeg ? iconSvg.debit : iconSvg.credit;

      const text = document.createElement('div');
      text.className = 'activity__text';
      const name = document.createElement('div');
      name.className = 'activity__name';
      name.textContent = getTitle(t, delta);
      const time = document.createElement('div');
      time.className = 'activity__time';
      time.textContent = formatTime(t.processedAt || t.createdAt);
      text.appendChild(name);
      text.appendChild(time);

      const amount = document.createElement('div');
      amount.className = `activity__amount${isNeg ? ' activity__amount--neg' : ''}`;
      const abs = Math.abs(Number(delta) || 0);
      amount.textContent = `${isNeg ? '-' : '+'}${abs}`;

      li.appendChild(icon);
      li.appendChild(text);
      li.appendChild(amount);
      list.appendChild(li);
    }
  };

  let loading = false;
  const loadActivity = async () => {
    if (loading) return;
    const token = getTokenFromUrl();
    if (!token) return;

    loading = true;
    refreshBtn.disabled = true;
    renderEmpty('Cargando...');

    try {
      const res = await fetch(`/api/card?mode=activity&token=${encodeURIComponent(token)}&limit=25`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        const msg = data?.error || data?.message || `Error (${res.status})`;
        renderEmpty(msg);
        return;
      }

      const txs = Array.isArray(data?.transactions) ? data.transactions : [];
      // Only show completed history items.
      const filtered = txs.filter((t) => !t?.status || String(t.status) === 'success');
      render(filtered);
    } catch {
      renderEmpty('Error de red');
    } finally {
      loading = false;
      refreshBtn.disabled = false;
    }
  };

  refreshBtn.addEventListener('click', () => {
    loadActivity();
  });

  window.addEventListener('wallet:activity-refresh', () => {
    loadActivity();
  });

  // Initial load
  loadActivity();
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
