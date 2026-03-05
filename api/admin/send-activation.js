import { getFirestoreDb } from '../_lib/firestore.js';
import { getPublicOrigin, readJsonBody, sendJson } from '../_lib/http.js';
import { makeToken, normalizeEmail } from '../_lib/utils.js';
import { sendActivationEmail } from '../_lib/email.js';
import { requireAdmin } from '../_lib/adminAuth.js';

async function dbGetCard(token) {
  const snap = await getFirestoreDb().collection('cards').doc(token).get();
  return snap.exists ? snap.data() : null;
}

async function dbCreateCard({ name, cedula, balance }) {
  const token = makeToken();
  const now = new Date().toISOString();
  await getFirestoreDb().collection('cards').doc(token).set({ name, cedula, balance, updatedAt: now }, { merge: true });
  return token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  if (!requireAdmin(req, res)) return;

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  try {
    const to = normalizeEmail(body?.to);
    const tokenFromBody = String(body?.token ?? '').trim();
    const nameFromBody = String(body?.name ?? '').trim();
    const cedula = String(body?.cedula ?? body?.id ?? '').trim();
    const balance = Number(body?.balance ?? body?.points ?? 0);

    if (!to || !to.includes('@')) {
      sendJson(res, 400, { error: 'Invalid body. Expected: { to }' });
      return;
    }

    let token = tokenFromBody;
    let created = false;

    if (!token) {
      if (!nameFromBody || !cedula || !Number.isFinite(balance)) {
        sendJson(res, 400, { error: 'Missing token. Expected: { to, token } OR { to, name, cedula, balance }' });
        return;
      }

      token = await dbCreateCard({ name: nameFromBody, cedula, balance });
      created = true;

      // Optional: link customer email -> token for easier lookups later
      const now = new Date().toISOString();
      await getFirestoreDb().collection('customers').doc(to).set({ token, updatedAt: now }, { merge: true });
    }

    let resolvedName = nameFromBody;
    if (!resolvedName) {
      try {
        const card = await dbGetCard(token);
        if (card && typeof card.name === 'string') resolvedName = card.name;
      } catch {
        // ignore
      }
    }

    const origin = getPublicOrigin(req);
    const linkPath = `/card/${token}`;
    const link = origin + linkPath;

    let emailResult;
    try {
      emailResult = await sendActivationEmail({ to, name: resolvedName, link });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
      return;
    }

    sendJson(res, 200, { ok: true, created, token, linkPath, link, email: emailResult });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
  }
}
