const loginForm = document.getElementById('loginForm');
const adminPasswordEl = document.getElementById('adminPassword');
const loginResultEl = document.getElementById('loginResult');

const createSection = document.getElementById('createCardSection');
const form = document.getElementById('createForm');

const toEmailEl = document.getElementById('toEmail');
const nameEl = document.getElementById('clientName');
const cedulaEl = document.getElementById('clientCedula');
const balanceEl = document.getElementById('clientBalance');

const resultEl = document.getElementById('result');
const copyBtn = document.getElementById('copyBtn');

let lastLink = '';

const setResult = (type, message) => {
  if (!resultEl) return;
  resultEl.classList.remove('adminResult--ok', 'adminResult--err', 'adminResult--info');
  resultEl.classList.add(type);
  resultEl.textContent = message;
};

const setCopyEnabled = (enabled) => {
  if (!copyBtn) return;
  copyBtn.disabled = !enabled;
};

const setLoginResult = (type, message) => {
  if (!loginResultEl) return;
  loginResultEl.classList.remove('adminResult--ok', 'adminResult--err', 'adminResult--info');
  loginResultEl.classList.add(type);
  loginResultEl.textContent = message;
};

const setAuthenticated = (authenticated) => {
  if (!createSection) return;
  createSection.hidden = !authenticated;
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

if (copyBtn) {
  copyBtn.addEventListener('click', async () => {
    if (!lastLink) return;
    const ok = await copyText(lastLink);
    setResult(ok ? 'adminResult--ok' : 'adminResult--err', ok ? 'Link copiado.' : 'No se pudo copiar el link.');
  });
}

const checkAuth = async () => {
  try {
    const res = await fetch('/api/admin/me', { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    const authed = Boolean(data?.authenticated);
    setAuthenticated(authed);
    if (authed) {
      setLoginResult('adminResult--ok', 'Sesión activa.');
    }
  } catch {
    // Ignore.
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

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    setCopyEnabled(false);
    lastLink = '';

    const to = String(toEmailEl?.value ?? '').trim();
    const name = String(nameEl?.value ?? '').trim();
    const cedula = String(cedulaEl?.value ?? '').trim();
    const balanceRaw = String(balanceEl?.value ?? '').trim();

    if (!to) {
      setResult('adminResult--err', 'Email destino es requerido.');
      return;
    }

    if (!name || !cedula || balanceRaw === '') {
      setResult('adminResult--err', 'Coloca Email, Nombre, Cédula y Saldo.');
      return;
    }

    const balance = Number(balanceRaw);
    if (!Number.isFinite(balance) || balance < 0) {
      setResult('adminResult--err', 'Saldo inválido.');
      return;
    }

    const payload = { to, name, cedula, balance };

    setResult('adminResult--info', 'Creando y enviando...');

    try {
      const res = await fetch('/api/admin/send-activation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
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

      if (data?.link) {
        lastLink = data.link;
        setCopyEnabled(true);
        const sent = data?.email?.sent ? 'Correo enviado.' : 'Correo NO enviado.';
        setResult('adminResult--ok', `${sent} Link: ${data.link}`);
      } else {
        setResult('adminResult--ok', 'Listo.');
      }
    } catch {
      setResult('adminResult--err', 'Fallo de red.');
    }
  });
}

checkAuth();
