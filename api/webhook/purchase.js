import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'node:crypto';
import { getFirestoreDb } from '../_lib/firestore.js';
import { getPublicOrigin, readJsonBody, sendJson, sendRedirect } from '../_lib/http.js';
import { makeToken, normalizeEmail } from '../_lib/utils.js';
import { sendActivationEmail } from '../_lib/email.js';

async function dbProcessPurchase({ email, name, cedula, balance }) {
  const now = new Date().toISOString();
  const firestore = getFirestoreDb();
  const customerRef = firestore.collection('customers').doc(email);

  let token = '';
  let firstActivation = false;

  const txId = crypto.randomBytes(12).toString('base64url');
  const purchaseTxRef = firestore.collection('transactions').doc(txId);

  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(customerRef);
    const data = snap.exists ? snap.data() : null;
    const existingToken = data && typeof data.token === 'string' ? data.token : '';

    if (!existingToken) {
      token = makeToken();
      firstActivation = true;
      tx.set(
        customerRef,
        {
          token,
          purchases: 1,
          activatedAt: now,
          updatedAt: now
        },
        { merge: true }
      );
    } else {
      token = existingToken;
      tx.set(
        customerRef,
        {
          purchases: FieldValue.increment(1),
          updatedAt: now
        },
        { merge: true }
      );
    }

    const cardRef = firestore.collection('cards').doc(token);

    const cardSnap = await tx.get(cardRef);
    const current = cardSnap.exists ? Number(cardSnap.data()?.balance ?? 0) : 0;
    const currentSafe = Number.isFinite(current) ? current : 0;
    const credited = Math.max(0, balance - currentSafe);

    tx.set(
      cardRef,
      {
        name,
        cedula,
        balance,
        updatedAt: now
      },
      { merge: true }
    );

    // Only create a credit transaction when the balance increased.
    if (credited > 0) {
      tx.set(purchaseTxRef, {
        type: 'purchase_credit',
        status: 'success',
        token,
        points: credited,
        description: firstActivation ? 'Activación' : 'Crédito',
        balanceBefore: currentSafe,
        balanceAfter: balance,
        createdAt: FieldValue.serverTimestamp(),
        processedAt: FieldValue.serverTimestamp()
      });
    }
  });

  return { token, firstActivation };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const secret = String(process.env.WEBHOOK_SECRET ?? '').trim();
  if (secret) {
    const provided = String(req.headers['x-webhook-secret'] ?? '');
    if (provided !== secret) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }
  }

  try {
    const body = await readJsonBody(req);
    const email = normalizeEmail(body?.email);
    const name = String(body?.name ?? '').trim();
    const cedula = String(body?.cedula ?? body?.id ?? '').trim();
    const balance = Number(body?.balance ?? body?.points ?? 0);

    if (!email || !email.includes('@') || !name || !cedula || !Number.isFinite(balance)) {
      sendJson(res, 400, { error: 'Invalid body. Expected: { email, name, cedula, balance }' });
      return;
    }

    const origin = getPublicOrigin(req);
    const { token, firstActivation } = await dbProcessPurchase({ email, name, cedula, balance });

    const linkPath = `/card/${token}`;
    const link = origin + linkPath;

    let emailResult = { sent: false };
    if (firstActivation) {
      try {
        emailResult = await sendActivationEmail({ to: email, name, link });
      } catch (err) {
        console.log('[activation-email] failed:', err?.message ?? err);
        emailResult = { sent: false, reason: 'send_failed' };
      }
    }

    const url = new URL(req.url, 'http://localhost');
    const wantsRedirect = url.searchParams.get('redirect') === '1';
    if (wantsRedirect) {
      sendRedirect(res, 303, linkPath);
      return;
    }

    sendJson(res, 200, { token, linkPath, link, firstActivation, email: emailResult });
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
  }
}
