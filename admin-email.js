const form = document.getElementById('emailForm');
const adminKeyEl = document.getElementById('adminKey');
const toEmailEl = document.getElementById('toEmail');
const nameEl = document.getElementById('clientName');
const cedulaEl = document.getElementById('clientCedula');
const balanceEl = document.getElementById('clientBalance');
const tokenEl = document.getElementById('cardToken');

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

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    setCopyEnabled(false);
    lastLink = '';

    const adminKey = String(adminKeyEl?.value ?? '').trim();
    const to = String(toEmailEl?.value ?? '').trim();
    const token = String(tokenEl?.value ?? '').trim();
    const name = String(nameEl?.value ?? '').trim();
    const cedula = String(cedulaEl?.value ?? '').trim();
    const balanceRaw = String(balanceEl?.value ?? '').trim();

    if (!adminKey) {
      setResult('adminResult--err', 'ADMIN_KEY es requerido.');
      return;
    }
    if (!to) {
      setResult('adminResult--err', 'Email destino es requerido.');
      return;
    }

    const payload = { to };
    if (token) {
      payload.token = token;
      if (name) payload.name = name;
    } else {
      if (!name || !cedula || balanceRaw === '') {
        setResult('adminResult--err', 'Sin token: coloca Nombre, Cédula y Saldo.');
        return;
      }
      const balance = Number(balanceRaw);
      if (!Number.isFinite(balance) || balance < 0) {
        setResult('adminResult--err', 'Saldo inválido.');
        return;
      }
      payload.name = name;
      payload.cedula = cedula;
      payload.balance = balance;
    }

    setResult('adminResult--info', 'Enviando...');

    try {
      const res = await fetch('/api/admin/send-activation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.error || data?.message || `Error (${res.status})`;
        setResult('adminResult--err', msg);
        return;
      }

      if (data?.link) {
        lastLink = data.link;
        setCopyEnabled(true);
        const created = data.created ? ' (tarjeta creada)' : '';
        const sent = data?.email?.sent ? 'Correo enviado.' : 'Correo NO enviado.';
        setResult('adminResult--ok', `${sent}${created} Link: ${data.link}`);
        if (!token && data?.token) tokenEl.value = data.token;
      } else {
        setResult('adminResult--ok', 'Listo.');
      }
    } catch {
      setResult('adminResult--err', 'Fallo de red. Revisa que el server esté corriendo.');
    }
  });
}
