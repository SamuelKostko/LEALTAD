import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import QRCode from 'qrcode';
import { getPublicOrigin, readJsonBody, sendJson } from '../_lib/http.js';
import { requireAdmin } from '../_lib/adminAuth.js';
import { getFirestoreDb } from '../_lib/firestore.js';

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

  if (!(await requireAdmin(req, res))) return;

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
  const desc = description.slice(0, 120);

  const firestore = getFirestoreDb();

  // Create a pending transaction tied to a unique nonce.
  // Retry a couple of times on collision (extremely unlikely).
  let nonce = '';
  let sig = '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    nonce = crypto.randomBytes(12).toString('base64url');
    const payload = `${points}|${ts}|${nonce}|${desc}`;
    sig = sign(payload, secret);

    const txRef = firestore.collection('transactions').doc(nonce);
    try {
      await txRef.create({
        type: 'pos_charge',
        status: 'pending',
        points,
        description: desc,
        ts,
        nonce,
        sig,
        createdAt: FieldValue.serverTimestamp()
      });
      break;
    } catch (err) {
      if (attempt === 2) {
        sendJson(res, 500, { error: 'Failed to create transaction' });
        return;
      }
    }
  }

  // QR contains a URL-like string; the app will append the customer token at scan time.
  const url = `/api/pos/redeem?points=${encodeURIComponent(points)}&ts=${encodeURIComponent(ts)}&nonce=${encodeURIComponent(nonce)}&desc=${encodeURIComponent(desc)}&sig=${encodeURIComponent(sig)}`;

  const origin = getPublicOrigin(req);
  const fullUrl = `${origin}${url}`;

  let qrPngDataUrl = '';
  try {
    qrPngDataUrl = await QRCode.toDataURL(fullUrl, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: 'M',
      type: 'image/png'
    });
  } catch {
    qrPngDataUrl = '';
  }

  sendJson(res, 200, { ok: true, url, transactionId: nonce, qrPngDataUrl });
}
