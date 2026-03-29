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
    if (!token) {
      setTimeout(() => document.body.classList.add('is-ready'), 2000);
      return;
    }

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
    } finally {
      setTimeout(() => document.body.classList.add('is-ready'), 2000);
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
    // Root domain without token → NEW admin dashboard
    document.body.classList.add('mode-admin');

    // Hide client wallet UI completely
    card.hidden = true;
    const activity = document.querySelector('.activity');
    if (activity) activity.hidden = true;
    const cta = document.querySelector('.cta');
    if (cta) cta.hidden = true;
    const profileButton = document.getElementById('profileButton');
    if (profileButton) profileButton.hidden = true;

    // ── DOM refs ─────────────────────────────────────────────
    const loginModal = document.getElementById('adminRootLogin');
    const loginForm = document.getElementById('adminRootLoginForm');
    const forgotForm = document.getElementById('adminRootForgotForm');
    const verifyForm = document.getElementById('adminRootVerifyForm');
    const resetForm = document.getElementById('adminRootResetForm');
    const emailEl = document.getElementById('adminRootEmail');
    const passwordEl = document.getElementById('adminRootPassword');
    const forgotEmailEl = document.getElementById('adminRootForgotEmail');
    const verifyCodeEl = document.getElementById('adminRootVerifyCode');
    const newPasswordEl = document.getElementById('adminRootNewPassword');
    const loginResultEl = document.getElementById('adminRootLoginResult');
    const forgotBtn = document.getElementById('adminRootForgotBtn');
    const cancelForgotBtn = document.getElementById('adminRootCancelForgotBtn');
    const cancelVerifyBtn = document.getElementById('adminRootCancelVerifyBtn');

    const dash = document.getElementById('adminDash');
    const goQrBtn = document.getElementById('adminHeaderGoQr');
    const logoutBtn = document.getElementById('adminHeaderLogout');

    // Panels
    const panelClientes = document.getElementById('aPanelClientes');
    const panelTx = document.getElementById('aPanelTx');
    const panelStats = document.getElementById('aPanelStats');
    const navClientes = document.getElementById('aNavClientes');
    const navTx = document.getElementById('aNavTx');
    const navStats = document.getElementById('aNavStats');

    // Client search
    const searchInput = document.getElementById('adminClientSearch');
    const dropdown = document.getElementById('adminSearchDropdown');
    const clientCard = document.getElementById('aClientCard');
    const clientAvatarEl = document.getElementById('aClientAvatar');
    const clientNameEl = document.getElementById('aClientName');
    const clientMetaEl = document.getElementById('aClientMeta');
    const clientBalanceEl = document.getElementById('aClientBalance');
    const clientClearBtn = document.getElementById('aClientClear');
    const clientsResult = document.getElementById('adminClientsResult');

    // Card tx
    const cardTxSection = document.getElementById('adminRootCardTx');
    const cardTxHint = document.getElementById('adminCardTxHint');
    const cardTxList = document.getElementById('adminCardTxList');
    const cardTxResult = document.getElementById('adminCardTxResult');

    // All tx
    const txRefresh = document.getElementById('adminTxRefresh');
    const txList = document.getElementById('adminTxList');
    const txResult = document.getElementById('adminTxResult');

    // ── State ────────────────────────────────────────────────
    let allCards = [];
    let selectedToken = '';
    let currentValidCode = null;

    // ── Helpers ──────────────────────────────────────────────
    const setText = (el, text) => { if (el) el.textContent = String(text ?? ''); };

    const setResult = (el, type, msg) => {
      if (!el) return;
      el.className = 'aResult' + (type ? ` aResult--${type}` : '');
      el.textContent = msg;
    };

    const apiGet = async (path) => {
      const res = await fetch(path, { cache: 'no-store', credentials: 'include' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const err = new Error(data?.error || data?.message || `Error (${res.status})`);
        err.status = res.status;
        throw err;
      }
      return data;
    };

    const formatTxDate = (tx) => {
      const iso = tx.processedAt || tx.createdAt || '';
      if (!iso) return '—';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleString('es-VE', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const renderTxTable = (container, txs, mode) => {
      if (!container) return;
      container.innerHTML = '';
      if (!txs.length) {
        const empty = document.createElement('div');
        empty.className = 'aTxEmpty';
        empty.textContent = 'Sin transacciones registradas';
        container.appendChild(empty);
        return;
      }
      const wrap = document.createElement('div');
      wrap.className = 'aTxTable';
      const headLabels = mode === 'card'
        ? ['Fecha', 'Tipo', 'Estado', 'Pts', 'Antes', 'Después', 'Descripción']
        : ['Fecha', 'Tipo', 'Estado', 'Pts', 'Cliente', 'Descripción'];
      // Desktop header row (hidden on mobile via CSS)
      const head = document.createElement('div');
      head.className = mode === 'card' ? 'aTxRow aTxRow--card aTxRow--head' : 'aTxRow aTxRow--head';
      for (const lbl of headLabels) {
        const c = document.createElement('div');
        c.className = 'aTxCell';
        c.textContent = lbl;
        head.appendChild(c);
      }
      wrap.appendChild(head);
      for (const t of txs) {
        const row = document.createElement('div');
        row.className = mode === 'card' ? 'aTxRow aTxRow--card' : 'aTxRow';
        const pts = Number.isFinite(Number(t.points)) ? Number(t.points) : 0;
        const before = Number.isFinite(Number(t.balanceBefore)) ? Number(t.balanceBefore) : null;
        const after = Number.isFinite(Number(t.balanceAfter)) ? Number(t.balanceAfter) : null;
        const addCell = (label, text, cls) => {
          const c = document.createElement('div');
          c.className = 'aTxCell' + (cls ? ` ${cls}` : '');
          c.setAttribute('data-label', label);
          c.textContent = text;
          row.appendChild(c);
        };
        addCell('Fecha', formatTxDate(t));
        addCell('Tipo', String(t.type || '—'));
        addCell('Estado', String(t.status || '—'), 'aTxCell--strong');
        addCell('Pts', String(pts), 'aTxCell--pts');
        if (mode === 'card') {
          addCell('Antes', before === null ? '—' : String(before));
          addCell('Después', after === null ? '—' : String(after));
        } else {
          addCell('Cliente', String(t?.name || t?.token || '—'));
        }
        addCell('Descripción', String(t.description || '—'));
        wrap.appendChild(row);
      }
      container.appendChild(wrap);
    };

    const showLoginStep = (step) => {
      if (loginForm) loginForm.hidden = step !== 'login';
      if (forgotForm) forgotForm.hidden = step !== 'forgot';
      if (verifyForm) verifyForm.hidden = step !== 'verify';
      if (resetForm) resetForm.hidden = step !== 'reset';
    };

    const clearRecoveryResults = () => {
      setResult(document.getElementById('adminRootForgotResult'), '', '');
      setResult(document.getElementById('adminRootVerifyResult'), '', '');
      setResult(document.getElementById('adminRootResetResult'), '', '');
    };

    const showLogin = () => {
      if (loginModal) loginModal.hidden = false;
      if (dash) dash.hidden = true;
    };

    const showDash = () => {
      if (loginModal) loginModal.hidden = true;
      if (dash) dash.hidden = false;
      // Show mobile nav only on small screens
      const mobileNav = document.getElementById('aMobileNav');
      if (mobileNav && window.innerWidth <= 640) mobileNav.style.display = 'flex';
    };

    const switchPanel = (panel) => {
      if (panelClientes) panelClientes.hidden = panel !== 'clientes';
      if (panelTx) panelTx.hidden = panel !== 'transacciones';
      if (panelStats) panelStats.hidden = panel !== 'metricas';

      // Sync sidebar nav
      if (navClientes) navClientes.classList.toggle('is-active', panel === 'clientes');
      if (navTx) navTx.classList.toggle('is-active', panel === 'transacciones');
      if (navStats) navStats.classList.toggle('is-active', panel === 'metricas');

      // Sync mobile bottom nav
      const mobClientes = document.getElementById('aMobNavClientes');
      const mobTx = document.getElementById('aMobNavTx');
      const mobStats = document.getElementById('aMobNavStats');
      if (mobClientes) mobClientes.classList.toggle('is-active', panel === 'clientes');
      if (mobTx) mobTx.classList.toggle('is-active', panel === 'transacciones');
      if (mobStats) mobStats.classList.toggle('is-active', panel === 'metricas');

      // Scroll content to top on panel switch (mobile)
      const main = document.querySelector('.aDash__main');
      if (main) main.scrollTop = 0;
    };
    if (navClientes) navClientes.addEventListener('click', () => switchPanel('clientes'));
    if (navTx) navTx.addEventListener('click', () => { switchPanel('transacciones'); loadAllTransactions(); });
    if (navStats) navStats.addEventListener('click', () => { switchPanel('metricas'); loadAdminStats(); });

    // Mobile bottom nav events
    const mobNavClientes = document.getElementById('aMobNavClientes');
    const mobNavTx = document.getElementById('aMobNavTx');
    const mobNavStats = document.getElementById('aMobNavStats');
    const mobNavLogout = document.getElementById('aMobNavLogout');
    if (mobNavClientes) mobNavClientes.addEventListener('click', () => switchPanel('clientes'));
    if (mobNavTx) mobNavTx.addEventListener('click', () => { switchPanel('transacciones'); loadAllTransactions(); });
    if (mobNavStats) mobNavStats.addEventListener('click', () => { switchPanel('metricas'); loadAdminStats(); });
    // mobNavLogout wired after doLogout is defined below

    // Responsive: show/hide mobile nav based on screen width
    const mobileNav = document.getElementById('aMobileNav');
    if (mobileNav) {
      const updateNavVisibility = () => {
        if (!dash.hidden) {
          mobileNav.style.display = window.innerWidth <= 640 ? 'flex' : 'none';
        }
      };
      window.addEventListener('resize', updateNavVisibility);
    }

    if (goQrBtn) goQrBtn.addEventListener('click', () => { window.location.href = '/admin/qr'; });

    const doLogout = async (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      try {
        await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
        // Force fully clean reload
        window.location.href = '/admin';
      } catch (err) {
        window.location.reload();
      }
    };
    if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
    // Wire mobile nav logout now that doLogout is defined
    if (mobNavLogout) mobNavLogout.addEventListener('click', (e) => doLogout(e));

    const getInitials = (name) => {
      const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
      return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';
    };

    const clearClient = () => {
      selectedToken = '';
      if (clientCard) clientCard.hidden = true;
      if (cardTxSection) cardTxSection.hidden = true;
      if (searchInput) searchInput.value = '';
      if (dropdown) { dropdown.hidden = true; dropdown.innerHTML = ''; }
    };

    const selectClient = (c) => {
      selectedToken = c.token;
      if (searchInput) searchInput.value = '';
      if (dropdown) { dropdown.hidden = true; dropdown.innerHTML = ''; }
      if (clientAvatarEl) clientAvatarEl.textContent = getInitials(c.name);
      if (clientNameEl) clientNameEl.textContent = c.name || '—';
      if (clientMetaEl) clientMetaEl.textContent = c.cedula ? `CI: ${c.cedula}` : 'Sin cédula';
      if (clientBalanceEl) clientBalanceEl.textContent = String(c.balance ?? 0);
      if (clientCard) clientCard.hidden = false;
      if (cardTxSection) { cardTxSection.hidden = false; }
      if (cardTxHint) cardTxHint.textContent = `Transacciones · ${c.name || '—'}`;
      loadCardTransactions(c.token);
    };

    if (clientClearBtn) clientClearBtn.addEventListener('click', clearClient);

    const buildDropdown = (query) => {
      if (!dropdown || !searchInput) return;
      const q = query.trim().toLowerCase();
      if (!q) { dropdown.hidden = true; dropdown.innerHTML = ''; return; }
      const matches = allCards.filter(c => c.name.toLowerCase().includes(q) || c.cedula.includes(q)).slice(0, 8);
      dropdown.innerHTML = '';
      if (!matches.length) {
        const el = document.createElement('div');
        el.className = 'aDropdown__empty';
        el.textContent = 'Sin resultados';
        dropdown.appendChild(el);
        dropdown.hidden = false;
        return;
      }
      for (const c of matches) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'aDropdown__item';
        btn.innerHTML = `<span class="aDropdown__name">${c.name || '—'}</span><span class="aDropdown__cedula">${c.cedula || ''}</span><span class="aDropdown__pts">${c.balance} pts</span>`;
        btn.addEventListener('click', () => selectClient(c));
        dropdown.appendChild(btn);
      }
      dropdown.hidden = false;
    };

    if (searchInput) {
      searchInput.addEventListener('input', () => buildDropdown(searchInput.value));
      searchInput.addEventListener('focus', () => { if (searchInput.value) buildDropdown(searchInput.value); });
      document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown?.contains(e.target)) { if (dropdown) { dropdown.hidden = true; } }
      });
    }

    const loadClients = async () => {
      setResult(clientsResult, 'info', 'Cargando clientes…');
      try {
        const data = await apiGet('/api/admin/cards?limit=200');
        allCards = (Array.isArray(data?.cards) ? data.cards : []).map(c => ({
          token: String(c?.token ?? '').trim(),
          name: String(c?.name ?? '').trim(),
          cedula: String(c?.cedula ?? '').trim(),
          balance: Number.isFinite(Number(c?.balance)) ? Number(c.balance) : 0,
        })).filter(c => c.token);
        setResult(clientsResult, '', '');
      } catch (err) {
        if (err?.status === 401) { doLogout(); return; }
        setResult(clientsResult, 'err', err?.message ?? 'Error al cargar clientes');
      }
    };

    const loadAllTransactions = async () => {
      if (!txList) return;
      setResult(txResult, 'info', 'Cargando…');
      try {
        const data = await apiGet('/api/admin/transactions?limit=80');
        const txs = Array.isArray(data?.transactions) ? data.transactions : [];
        renderTxTable(txList, txs, 'all');
        setResult(txResult, '', '');
      } catch (err) {
        if (err?.status === 401) { doLogout(); return; }
        setResult(txResult, 'err', err?.message ?? 'Error');
      }
    };

    const loadCardTransactions = async (token) => {
      if (!cardTxList) return;
      setResult(cardTxResult, 'info', 'Cargando…');
      try {
        const data = await apiGet(`/api/admin/transactions?token=${encodeURIComponent(token)}&limit=80`);
        const txs = Array.isArray(data?.transactions) ? data.transactions : [];
        renderTxTable(cardTxList, txs, 'card');
        setResult(cardTxResult, '', '');
      } catch (err) {
        if (err?.status === 401) { doLogout(); return; }
        setResult(cardTxResult, 'err', err?.message ?? 'Error');
      }
    };

    if (txRefresh) txRefresh.addEventListener('click', loadAllTransactions);

    // -- Dashboard Stats Logic --
    let currentStatsRange = 'day';
    const loadAdminStats = async (range = currentStatsRange) => {
      const loader = document.getElementById('adminStatsLoader');
      if (loader) loader.hidden = false;

      try {
        const data = await apiGet(`/api/admin/stats?range=${encodeURIComponent(range)}`);

        const elUsers = document.getElementById('stUsers');
        const elEarned = document.getElementById('stPtsEarned');
        const elRedeemed = document.getElementById('stPtsRedeemed');
        const elUsersSub = document.getElementById('stUsersSub');

        if (elUsers) {
          elUsers.textContent = String(data.newUsers || 0);
          if (elUsersSub) elUsersSub.textContent = `Registrados en el periodo (Histórico: ${data.totalUsers || 0})`;
        }
        if (elEarned) elEarned.textContent = String(data.pointsEarned || 0);
        if (elRedeemed) elRedeemed.textContent = String(data.pointsRedeemed || 0);

      } catch (err) {
        if (err?.status === 401) { doLogout(); return; }
      } finally {
        if (loader) loader.hidden = true;
      }
    };

    const filterBtns = document.querySelectorAll('.aFilterBtn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const r = e.target.getAttribute('data-range') || 'all';
        currentStatsRange = r;
        filterBtns.forEach(b => b.classList.remove('is-active'));
        e.target.classList.add('is-active');
        loadAdminStats(r);
      });
    });

    const initAuthed = () => { showDash(); switchPanel('clientes'); loadClients(); };

    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = (document.getElementById('adminRootEmail')?.value || '').trim();
        const password = (document.getElementById('adminRootPassword')?.value || '').trim();

        if (!email || !password) {
          setResult(loginResultEl, 'err', 'Correo y contraseña requeridos.');
          return;
        }

        setResult(loginResultEl, 'info', 'Entrando…');
        try {
          const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
          });

          const data = await res.json().catch(() => null);
          if (!res.ok) {
            setResult(loginResultEl, 'err', data?.error || data?.message || `Error (${res.status})`);
            return;
          }

          setResult(loginResultEl, 'ok', 'Acceso concedido.');
          if (emailEl) emailEl.value = '';
          if (passwordEl) passwordEl.value = '';
          initAuthed();
        } catch (err) {
          setResult(loginResultEl, 'err', 'Fallo de red.');
        }
      });
    }

    if (forgotBtn) forgotBtn.addEventListener('click', () => { clearRecoveryResults(); showLoginStep('forgot'); });
    if (cancelForgotBtn) cancelForgotBtn.addEventListener('click', () => { clearRecoveryResults(); showLoginStep('login'); setResult(loginResultEl, '', ''); });
    if (cancelVerifyBtn) cancelVerifyBtn.addEventListener('click', () => { clearRecoveryResults(); showLoginStep('login'); setResult(loginResultEl, '', ''); });

    if (forgotForm) {
      forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const resultEl = document.getElementById('adminRootForgotResult');
        const email = String(forgotEmailEl?.value ?? '').trim();
        setResult(resultEl, 'info', 'Enviando código…');
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15000);
        try {
          const res = await fetch('/api/admin/forgot-password', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }), signal: ctrl.signal
          });
          clearTimeout(t);
          const data = await res.json().catch(() => null);
          if (!res.ok) { setResult(resultEl, 'err', data?.error || 'Correo incorrecto.'); return; }
          setResult(resultEl, 'ok', 'Correo enviado. Revisa tu bandeja.');
          setTimeout(() => showLoginStep('verify'), 1500);
        } catch (err) {
          clearTimeout(t);
          setResult(resultEl, 'err', err?.name === 'AbortError' ? 'Tiempo agotado. Revisa SMTP.' : 'Error de red.');
        }
      });
    }

    if (verifyForm) {
      verifyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const resultEl = document.getElementById('adminRootVerifyResult');
        const code = String(verifyCodeEl?.value ?? '').trim();
        if (!code) { setResult(resultEl, 'err', 'Ingresa el código.'); return; }
        setResult(resultEl, 'info', 'Verificando…');
        try {
          const res = await fetch('/api/admin/verify-code', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code })
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) { setResult(resultEl, 'err', data?.error || 'Código incorrecto.'); return; }
          setResult(resultEl, 'ok', 'Código correcto.');
          currentValidCode = code;
          setTimeout(() => showLoginStep('reset'), 1000);
        } catch (err) { setResult(resultEl, 'err', 'Error de red.'); }
      });
    }

    if (resetForm) {
      resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const resultEl = document.getElementById('adminRootResetResult');
        const newPassword = String(newPasswordEl?.value ?? '').trim();
        if (!newPassword || newPassword.length < 6) { setResult(resultEl, 'err', 'Clave muy corta.'); return; }
        setResult(resultEl, 'info', 'Actualizando…');
        try {
          const res = await fetch('/api/admin/reset-password', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: currentValidCode, newPassword })
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) { setResult(resultEl, 'err', data?.error || 'Error al actualizar.'); return; }
          setResult(resultEl, 'ok', '¡Clave actualizada! Redirigiendo…');
          setTimeout(() => { showLoginStep('login'); clearRecoveryResults(); window.location.href = '/admin'; }, 2000);
        } catch (err) { setResult(resultEl, 'err', 'Error de red.'); }
      });
    }

    const checkAuth = async () => {
      try {
        const data = await apiGet('/api/admin/me');
        if (Boolean(data?.authenticated)) initAuthed();
        else showLogin();
      } catch (err) { showLogin(); }
      finally {
        document.body.classList.add('is-ready');
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
      return { show: () => { }, close: () => { } };
    }
  })();

  const confirmPopup = (() => {
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
          currentResolve = resolve;
          title.textContent = `Pagar ${points} pts`;
          subtitle.textContent = desc ? `Referencia: ${desc}` : "¿Confirmas el pago de puntos?";
          root.classList.add("scanPopup--show");
          root.setAttribute("aria-hidden", "false");
        });
      };

      btnCancel.addEventListener("click", () => close(false));
      btnAccept.addEventListener("click", () => close(true));
      backdrop.addEventListener("click", () => close(false));

      return { request };
    } catch {
      return { request: async () => true };
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

    // Pedir confirmacion al cliente antes de continuar
    const confirmed = await confirmPopup.request({
      points: params.points,
      desc: params.desc
    });
    
    if (!confirmed) {
      // El usuario canceló la transaccion
      // Devolvemos true porque sí interpretamos el QR correctamente (evita que diga "QR no válido")
      return true;
    }

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
  const mainList = document.querySelector('.activity__list:not(#historyList)');
  const historyList = document.getElementById('historyList');
  const moreBtn = document.getElementById('activityMoreBtn');
  const historyModal = document.getElementById('historyModal');
  const historyCloseBtn = document.getElementById('historyCloseBtn');
  const historyLoadMoreBtn = document.getElementById('historyLoadMoreBtn');
  const historyLoading = document.getElementById('historyLoading');

  if (!refreshBtn || !mainList) return;

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

  const clearList = (targetList) => {
    if (targetList) targetList.innerHTML = '';
  };

  const renderEmpty = (targetList, text) => {
    if (!targetList) return;
    clearList(targetList);
    const li = document.createElement('li');
    li.className = 'activity__item';
    li.innerHTML = `<div class="activity__icon"></div><div class="activity__text"><div class="activity__name">${text}</div><div class="activity__time"></div></div><div class="activity__amount"></div>`;
    targetList.appendChild(li);
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

  const createTxElement = (t) => {
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
    return li;
  };

  const render = (targetList, transactions, append = false) => {
    if (!targetList) return;
    if (!append) clearList(targetList);

    const txs = Array.isArray(transactions) ? transactions : [];
    if (!txs.length && !append) {
      renderEmpty(targetList, 'Sin actividad');
      return;
    }

    for (const t of txs) {
      targetList.appendChild(createTxElement(t));
    }
  };

  let loading = false;
  let lastVisibleTx = null; // { id, date }
  const PAGE_SIZE = 5;

  const cargarMasTransacciones = async () => {
    if (loading || !lastVisibleTx) return;
    const token = getTokenFromUrl();
    if (!token) return;

    loading = true;
    if (historyLoadMoreBtn) historyLoadMoreBtn.hidden = true;
    if (historyLoading) historyLoading.hidden = false;

    try {
      const url = `/api/card?mode=activity&token=${encodeURIComponent(token)}&limit=${PAGE_SIZE}&afterDate=${encodeURIComponent(lastVisibleTx.date)}&afterId=${encodeURIComponent(lastVisibleTx.id)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Error');

      const txs = Array.isArray(data?.transactions) ? data.transactions : [];
      if (txs.length > 0) {
        render(historyList, txs, true);
        const last = txs[txs.length - 1];
        lastVisibleTx = { id: last.id, date: last.processedAt || last.createdAt };
      }

      if (historyLoadMoreBtn) {
        historyLoadMoreBtn.hidden = txs.length < PAGE_SIZE;
      }
    } catch (err) {
      console.error('Error cargando más transacciones:', err);
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
    renderEmpty(mainList, 'Cargando...');
    if (historyList) renderEmpty(historyList, 'Cargando...');
    if (historyLoadMoreBtn) historyLoadMoreBtn.hidden = true;

    try {
      const res = await fetch(`/api/card?mode=activity&token=${encodeURIComponent(token)}&limit=${PAGE_SIZE}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        const msg = data?.error || data?.message || `Error (${res.status})`;
        renderEmpty(mainList, msg);
        if (historyList) renderEmpty(historyList, msg);
        return;
      }

      const txs = Array.isArray(data?.transactions) ? data.transactions : [];
      render(mainList, txs);
      if (historyList) render(historyList, txs);

      if (txs.length > 0) {
        const last = txs[txs.length - 1];
        lastVisibleTx = { id: last.id, date: last.processedAt || last.createdAt };
      }

      if (moreBtn) moreBtn.hidden = txs.length < PAGE_SIZE;
      if (historyLoadMoreBtn) historyLoadMoreBtn.hidden = txs.length < PAGE_SIZE;

    } catch {
      renderEmpty(mainList, 'Error de red');
      if (historyList) renderEmpty(historyList, 'Error de red');
    } finally {
      loading = false;
      refreshBtn.disabled = false;
    }
  };

  if (moreBtn && historyModal && historyCloseBtn) {
    moreBtn.addEventListener('click', () => {
      historyModal.classList.add('historyModal--active');
      historyModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    });
    historyCloseBtn.addEventListener('click', () => {
      historyModal.classList.remove('historyModal--active');
      historyModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    });
  }

  if (historyLoadMoreBtn) {
    historyLoadMoreBtn.addEventListener('click', cargarMasTransacciones);
  }

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
