import { getFirestoreDb } from '../_lib/firestore.js';
import { sendJson } from '../_lib/http.js';
import { requireAdmin } from '../_lib/adminAuth.js';

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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  if (!requireAdmin(req, res)) return;

  const url = new URL(req.url, 'http://localhost');
  const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 200, fallback: 50 });
  const token = String(url.searchParams.get('token') ?? '').trim();

  const firestore = getFirestoreDb();

  try {
    let query = firestore.collection('transactions');
    if (token) query = query.where('token', '==', token);
    query = query.orderBy('createdAt', 'desc').limit(limit);

    const snap = await query.get();
    const transactions = snap.docs.map((d) => {
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

    sendJson(res, 200, { ok: true, transactions });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
  }
}
