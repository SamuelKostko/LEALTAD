import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreDb } from '../_lib/firestore.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { requireAdmin } from '../_lib/adminAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  if (!(await requireAdmin(req, res))) return;

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { ok: false, error: 'Invalid JSON body' });
    return;
  }

  const transactionId = String(body?.transactionId ?? body?.id ?? '').trim();
  if (!transactionId) {
    sendJson(res, 400, { ok: false, error: 'transactionId required' });
    return;
  }

  const firestore = getFirestoreDb();
  const txRef = firestore.collection('transactions').doc(transactionId);

  try {
    const result = await firestore.runTransaction(async (t) => {
      const snap = await t.get(txRef);
      if (!snap.exists) {
        return { ok: false, status: 404, error: 'Transaction not found' };
      }

      const data = snap.data() || {};
      const status = String(data.status ?? '').trim();
      const type = String(data.type ?? '').trim();
      const token = String(data.token ?? '').trim();

      // Safety: this endpoint is for cancelling minted QR charges before redemption.
      // Only allow deleting/cancelling pending POS charges that haven't been applied to a card.
      if (type !== 'pos_charge') {
        return { ok: false, status: 409, error: 'Only pos_charge transactions can be cancelled here' };
      }

      if (status !== 'pending') {
        return { ok: false, status: 409, error: `Transaction is not pending (status=${status || 'unknown'})` };
      }

      if (token) {
        return { ok: false, status: 409, error: 'Transaction already tied to a card token' };
      }

      // If it is truly unused, delete it from Firestore.
      t.delete(txRef);
      return { ok: true, status: 200, deleted: true };
    });

    if (!result.ok) {
      sendJson(res, result.status, { ok: false, error: result.error });
      return;
    }

    sendJson(res, 200, { ok: true, deleted: true, transactionId });
  } catch (err) {
    console.error('Error cancelling transaction:', err);
    // Fallback: if transaction delete is blocked by some rule, mark as cancelled (best effort)
    try {
      await txRef.set(
        { status: 'cancelled', processedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    } catch {
      // Ignore.
    }
    sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
  }
}
