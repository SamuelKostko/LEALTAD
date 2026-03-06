import crypto from 'node:crypto';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { requireAdmin } from '../_lib/adminAuth.js';

function getQrSecret() {
  return String(process.env.QR_SECRET ?? '').trim();
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  if (!requireAdmin(req, res)) return;

  const secret = getQrSecret();
  if (!secret) {
    sendJson(res, 500, { error: 'QR_SECRET not set on server' });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  const points = Number(body?.points ?? 0);
  const description = String(body?.description ?? '').trim();

  if (!Number.isFinite(points) || points <= 0) {
    sendJson(res, 400, { error: 'Invalid body. Expected: { points > 0, description? }' });
    return;
  }

  const ts = Date.now();
  const nonce = crypto.randomBytes(12).toString('base64url');
  const desc = description.slice(0, 120);

  const payload = `${points}|${ts}|${nonce}|${desc}`;
  const sig = sign(payload, secret);

  // QR contains a URL-like string; the app will append the customer token at scan time.
  const url = `/api/pos/redeem?points=${encodeURIComponent(points)}&ts=${encodeURIComponent(ts)}&nonce=${encodeURIComponent(nonce)}&desc=${encodeURIComponent(desc)}&sig=${encodeURIComponent(sig)}`;

  sendJson(res, 200, { ok: true, url });
}
