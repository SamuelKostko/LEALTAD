import { getFirestoreDb } from './_lib/firestore.js';
import { sendJson } from './_lib/http.js';

function clampInt(value, { min, max, fallback }) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

function toIso(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') {
    try {
      return value.toDate().toISOString();
    } catch {
      return '';
    }
  }
  return '';
}

function isMissingIndexError(err) {
  const message = String(err?.message ?? '');
  return (
    message.includes('FAILED_PRECONDITION') ||
    message.toLowerCase().includes('requires an index') ||
    message.toLowerCase().includes('create it here')
  );
}

function toMs(iso) {
  const t = Date.parse(String(iso ?? ''));
  return Number.isFinite(t) ? t : 0;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const token = String(url.searchParams.get('token') ?? '').trim();
  const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 80, fallback: 20 });

  if (!token) {
    sendJson(res, 400, { error: 'Missing token' });
    return;
  }

  const firestore = getFirestoreDb();

  const mapSnap = (snap) =>
    snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        type: typeof data.type === 'string' ? data.type : '',
        status: typeof data.status === 'string' ? data.status : '',
        token: typeof data.token === 'string' ? data.token : '',
        points: Number.isFinite(Number(data.points)) ? Number(data.points) : 0,
        description: typeof data.description === 'string' ? data.description : '',
        createdAt: toIso(data.createdAt),
        processedAt: toIso(data.processedAt),
        balanceBefore: Number.isFinite(Number(data.balanceBefore)) ? Number(data.balanceBefore) : null,
        balanceAfter: Number.isFinite(Number(data.balanceAfter)) ? Number(data.balanceAfter) : null
      };
    });

  try {
    let transactions = [];
    try {
      const snap = await firestore
        .collection('transactions')
        .where('token', '==', token)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      transactions = mapSnap(snap);
    } catch (err) {
      if (!isMissingIndexError(err)) throw err;

      const fallbackLimit = Math.max(limit, 200);
      const snap = await firestore
        .collection('transactions')
        .where('token', '==', token)
        .limit(fallbackLimit)
        .get();
      transactions = mapSnap(snap);

      transactions.sort((a, b) => {
        const aMs = Math.max(toMs(a.processedAt), toMs(a.createdAt));
        const bMs = Math.max(toMs(b.processedAt), toMs(b.createdAt));
        return bMs - aMs;
      });

      if (transactions.length > limit) transactions = transactions.slice(0, limit);
    }

    sendJson(res, 200, { ok: true, transactions });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
  }
}
