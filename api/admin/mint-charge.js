import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import QRCode from 'qrcode';
import { getPublicOrigin, readJsonBody, sendJson } from '../_lib/http.js';
import { verifySession } from '../_lib/adminAuth.js';
import { getFirestoreDb } from '../_lib/firestore.js';

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

  const cookies = parseCookies(req.headers.cookie);
  const auth = await verifySession(cookies['admin_session']);
  if (!auth.ok) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  const role = String(auth.data?.role ?? '').trim().toLowerCase() || 'admin';

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
  const requestedBranchName = String(body?.BranchName ?? body?.branchName ?? '').trim();

  if (!Number.isFinite(points) || points <= 0 || points > 50000) {
    sendJson(res, 400, { error: 'Puntos inválidos. Máximo permitido: 50000.' });
    return;
  }

  const ts = Date.now();
  const desc = description.slice(0, 120);

  let branchName = requestedBranchName;
  let merchantId = '';
  let merchantName = '';
  let merchantBranch = '';

  if (role === 'merchant') {
    merchantId = String(auth.adminId ?? '').trim();
    merchantName = String(auth.data?.name ?? '').trim();
    merchantBranch = String(auth.data?.branchName ?? '').trim();
    if (!merchantName || !merchantBranch) {
      sendJson(res, 500, { error: 'Merchant user is missing name/branchName' });
      return;
    }
    
    // Fetch merchant settings to know if it's a closed merchant
    const firestoreDb = getFirestoreDb();
    const merchantDoc = await firestoreDb.collection('merchants').doc(merchantId).get();
    const mData = merchantDoc.data() || {};
    const settings = mData.settings || {};
    const isClosed = settings.isClosed !== false;

    branchName = `${merchantName} - ${merchantBranch}`.slice(0, 120);
    
    // Extra fields for the transaction
    var merchantTxData = { merchantId, merchantName, merchantBranch, isClosed, settings };
  }

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
        ref: '',
        description: desc,
        branchName,
        mintedById: String(auth.adminId ?? '').trim(),
        mintedByRole: role,
        ...(merchantTxData || {}),
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
