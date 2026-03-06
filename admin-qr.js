const loginForm = document.getElementById('loginForm');
const adminPasswordEl = document.getElementById('adminPassword');
const loginResultEl = document.getElementById('loginResult');

const qrSection = document.getElementById('qrSection');
const qrForm = document.getElementById('qrForm');
const pointsEl = document.getElementById('points');
const descriptionEl = document.getElementById('description');
const resultEl = document.getElementById('result');

const copyBtn = document.getElementById('copyBtn');
const qrCanvas = document.getElementById('qrCanvas');

let lastUrl = '';

const setLoginResult = (type, message) => {
  if (!loginResultEl) return;
  loginResultEl.classList.remove('adminResult--ok', 'adminResult--err', 'adminResult--info');
  loginResultEl.classList.add(type);
  loginResultEl.textContent = message;
};

const setResult = (type, message) => {
  if (!resultEl) return;
  resultEl.classList.remove('adminResult--ok', 'adminResult--err', 'adminResult--info');
  resultEl.classList.add(type);
  resultEl.textContent = message;
};

const setAuthenticated = (authenticated) => {
  if (!qrSection) return;
  qrSection.hidden = !authenticated;
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
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
};

const checkAuth = async () => {
  try {
    const res = await fetch('/api/admin/me', { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    const authed = Boolean(data?.authenticated);
    setAuthenticated(authed);
    if (authed) setLoginResult('adminResult--ok', 'Sesión activa.');
  } catch {
    // ignore
  }
};

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = String(adminPasswordEl?.value ?? '').trim();
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
        setAuthenticated(false);
        return;
      }

      setLoginResult('adminResult--ok', 'Listo.');
      setAuthenticated(true);
      if (adminPasswordEl) adminPasswordEl.value = '';
    } catch {
      setLoginResult('adminResult--err', 'Fallo de red.');
    }
  });
}

if (copyBtn) {
  copyBtn.addEventListener('click', async () => {
    if (!lastUrl) return;
    const ok = await copyText(lastUrl);
    setResult(ok ? 'adminResult--ok' : 'adminResult--err', ok ? 'Link copiado.' : 'No se pudo copiar el link.');
  });
}

if (qrForm) {
  qrForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    setCopyEnabled(false);
    lastUrl = '';

    const points = Number(String(pointsEl?.value ?? '').trim());
    const description = String(descriptionEl?.value ?? '').trim();

    if (!Number.isFinite(points) || points <= 0) {
      setResult('adminResult--err', 'Puntos inválidos.');
      return;
    }

    setResult('adminResult--info', 'Generando...');

    try {
      const res = await fetch('/api/admin/mint-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points, description })
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401) {
          setAuthenticated(false);
          setLoginResult('adminResult--err', 'Sesión expirada. Inicia sesión de nuevo.');
        }
        const msg = data?.error || data?.message || `Error (${res.status})`;
        setResult('adminResult--err', msg);
        return;
      }

      const urlPath = String(data?.url ?? '').trim();
      if (!urlPath) {
        setResult('adminResult--err', 'No se pudo generar.');
        return;
      }

      const fullUrl = `${window.location.origin}${urlPath}`;
      lastUrl = fullUrl;

      if (qrCanvas && window.QRCode && typeof window.QRCode.toCanvas === 'function') {
        qrCanvas.style.display = 'block';
        await window.QRCode.toCanvas(qrCanvas, fullUrl, {
          width: 220,
          margin: 1,
          errorCorrectionLevel: 'M'
        });
      }

      setCopyEnabled(true);
      setResult('adminResult--ok', `QR listo. Link: ${fullUrl}`);
    } catch {
      setResult('adminResult--err', 'Fallo de red.');
    }
  });
}

checkAuth();
