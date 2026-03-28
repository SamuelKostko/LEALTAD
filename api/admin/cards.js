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

  const firestore = getFirestoreDb();

  try {
    const snap = await firestore.collection('clientes').orderBy('updatedAt', 'desc').limit(limit).get();
    const cards = snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        token: typeof data.token === 'string' ? data.token : d.id, // Fallback to doc ID if token field is missing
        name: typeof data.nombre === 'string' ? data.nombre : '',
        cedula: typeof data.idNumber === 'string' ? data.idNumber : '',
        balance: Number.isFinite(Number(data.totalPoints)) ? Number(data.totalPoints) : 0,
        updatedAt: toIso(data.updatedAt)
      };
    });

    sendJson(res, 200, { ok: true, cards });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
  }
}
