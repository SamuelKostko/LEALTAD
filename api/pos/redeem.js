import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreDb } from '../_lib/firestore.js';
import { getPublicOrigin, sendJson } from '../_lib/http.js';
import { notifyTokenActivity } from '../_lib/push.js';

function getQrSecret() {
  return String(process.env.QR_SECRET ?? '').trim();
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function timingSafeEqualString(a, b) {
  const aa = Buffer.from(String(a ?? ''), 'utf8');
  const bb = Buffer.from(String(b ?? ''), 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const secret = getQrSecret();
  if (!secret) {
    sendJson(res, 500, { error: 'QR_SECRET not set on server' });
    return;
  }

  const url = new URL(req.url, 'http://localhost');

  const token = String(url.searchParams.get('token') ?? '').trim();
  const points = Number(url.searchParams.get('points') ?? 0);
  const ts = Number(url.searchParams.get('ts') ?? 0);
  const nonce = String(url.searchParams.get('nonce') ?? '').trim();
  const desc = String(url.searchParams.get('desc') ?? '').trim().slice(0, 120);
  const sig = String(url.searchParams.get('sig') ?? '').trim();

  if (!token) {
    sendJson(res, 400, { error: 'Missing token' });
    return;
  }

  if (!Number.isFinite(points) || points <= 0) {
    sendJson(res, 400, { error: 'Invalid points' });
    return;
  }

  if (!Number.isFinite(ts) || ts <= 0 || !nonce || !sig) {
    sendJson(res, 400, { error: 'Invalid QR parameters' });
    return;
  }

  // Basic anti-replay: only accept QRs minted recently.
  const MAX_AGE_MS = 5 * 60 * 1000;
  const age = Math.abs(Date.now() - ts);
  if (age > MAX_AGE_MS) {
    // Best-effort: mark transaction as expired if it exists and is still pending.
    try {
      const firestore = getFirestoreDb();
      const txRef = firestore.collection('transactions').doc(nonce);
      await firestore.runTransaction(async (t) => {
        const snap = await t.get(txRef);
        if (!snap.exists) return;
        const status = String(snap.data()?.status ?? '');
        if (status !== 'pending') return;
        t.set(
          txRef,
          { status: 'expired', processedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      });
    } catch {
      // Ignore.
    }

    sendJson(res, 400, { error: 'QR expired' });
    return;
  }

  const payload = `${points}|${ts}|${nonce}|${desc}`;
  const expected = sign(payload, secret);
  if (!timingSafeEqualString(sig, expected)) {
    // Helpful diagnostic: if the transaction exists and the stored signature matches
    // the QR, but the server's expected signature does not, it strongly suggests
    // QR_SECRET differs between the environment that minted the QR and this one.
    try {
      const firestore = getFirestoreDb();
      const txRef = firestore.collection('transactions').doc(nonce);
      const snap = await txRef.get();
      if (snap.exists) {
        const data = snap.data() || {};
        const status = String(data.status ?? '');
        const storedSig = String(data.sig ?? '').trim();
        if (status === 'pending' && storedSig && storedSig === sig) {
          sendJson(res, 500, {
            error: 'QR_SECRET mismatch between environments (generate and redeem must use the same deployment/env vars)'
          });
          return;
        }
      }
    } catch {
      // Ignore diagnostics failures.
    }

    sendJson(res, 403, { error: 'Invalid signature' });
    return;
  }

  const firestore = getFirestoreDb();

  // Apply redemption atomically:
  // - transaction must exist and be pending
  // - card must exist and have enough balance
  // - on success: subtract points and mark transaction success
  try {
    const result = await firestore.runTransaction(async (tx) => {
      const txRef = firestore.collection('transactions').doc(nonce);
      const cardRef = firestore.collection('cards').doc(token);

      const [txSnap, cardSnap] = await Promise.all([tx.get(txRef), tx.get(cardRef)]);

      if (!txSnap.exists) throw new Error('Transaction not found');
      const txData = txSnap.data() || {};
      const status = String(txData.status ?? '');
      if (status !== 'pending') {
        throw new Error('Transaction not pending');
      }

      // Ensure the QR params match the minted transaction.
      const mintedPoints = Number(txData.points ?? 0);
      const mintedTs = Number(txData.ts ?? 0);
      const mintedSig = String(txData.sig ?? '').trim();
      const mintedDesc = String(txData.description ?? '').trim().slice(0, 120);
      if (
        !Number.isFinite(mintedPoints) ||
        mintedPoints !== points ||
        mintedTs !== ts ||
        mintedSig !== sig ||
        mintedDesc !== desc
      ) {
        throw new Error('Invalid transaction payload');
      }

      if (!cardSnap.exists) throw new Error('Card not found');
      const cardData = cardSnap.data() || {};
      const current = Number(cardData.balance ?? 0);
      if (!Number.isFinite(current)) throw new Error('Invalid balance');

      const next = current - points;
      if (next < 0) {
        throw new Error('Insufficient balance');
      }

      tx.set(cardRef, { balance: next, updatedAt: new Date().toISOString() }, { merge: true });

      tx.set(
        txRef,
        {
          status: 'success',
          token,
          balanceBefore: current,
          balanceAfter: next,
          processedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      return { previous: current, next };
    });

    // Best-effort push notification to wallet owner.
    try {
      const origin = getPublicOrigin(req);
      await notifyTokenActivity({
        token,
        title: 'Consumo registrado',
        body: `Se descontaron ${points} puntos. Saldo actual: ${result.next}`,
        url: `${origin}/card/${encodeURIComponent(token)}`,
        tag: 'wallet-redeem',
        payload: {
          type: 'redeem',
          points,
          balanceBefore: result.previous,
          balanceAfter: result.next,
          description: desc
        }
      });
    } catch {
      // Ignore push failures.
    }

    sendJson(res, 200, {
      ok: true,
      token,
      points,
      description: desc,
      balance: result.next
    });
  } catch (err) {
    sendJson(res, 400, { error: err?.message ?? String(err) });
  }
}
