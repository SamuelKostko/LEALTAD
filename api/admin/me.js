import { sendJson } from '../_lib/http.js';
import { verifySession } from '../_lib/adminAuth.js';

function parseCookies(header) {
  const raw = String(header ?? '');
  if (!raw) return {};
  const out = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(val);
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const auth = await verifySession(cookies['admin_session']);
  if (!auth.ok) {
    sendJson(res, 200, { ok: true, authenticated: false });
    return;
  }

  const role = String(auth.data?.role ?? '').trim().toLowerCase() || 'admin';
  const payload = { ok: true, authenticated: true, role };
  
  if (auth.data?.name) payload.name = String(auth.data.name).trim();
  if (auth.data?.username) payload.username = String(auth.data.username).trim();
  if (auth.data?.branchName) payload.branchName = String(auth.data.branchName).trim();

  sendJson(res, 200, payload);
}
