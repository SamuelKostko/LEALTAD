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

async function attachCardNames(firestore, transactions) {
  const uniqueTokens = Array.from(
    new Set(
      transactions
        .map((t) => String(t?.token ?? '').trim())
        .filter(Boolean)
    )
  ).slice(0, 30); // Firestore 'in' query limit is 30

  if (!uniqueTokens.length) return transactions;

  const snaps = await firestore.collection('clientes')
    .where('token', 'in', uniqueTokens)
    .get();

  const tokenToName = new Map();
  for (const snap of snaps.docs) {
    const data = snap.data() || {};
    const name = typeof data.nombre === 'string' ? data.nombre.trim() : '';
    const token = typeof data.token === 'string' ? data.token.trim() : '';
    if (token) {
      tokenToName.set(token, name);
    }
  }

  return transactions.map((t) => ({
    ...t,
    name: tokenToName.get(String(t.token || '').trim()) || ''
  }));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  if (!(await requireAdmin(req, res))) return;

  const url = new URL(req.url, 'http://localhost');
  const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 200, fallback: 50 });
  const token = String(url.searchParams.get('token') ?? '').trim();
  const branch = String(url.searchParams.get('branch') ?? '').trim();

  const firestore = getFirestoreDb();

  try {
    const mapSnap = (snap) =>
      snap.docs.map((d) => {
        const data = d.data() || {};
        let type = typeof data.type === 'string' ? data.type : '';
        const points = Number.isFinite(Number(data.points)) ? Number(data.points) : 0;
        if (!type && points > 0) {
          type = 'credit';
        }
        return {
          id: d.id,
          type,
          status: typeof data.status === 'string' ? data.status : '',
          token: typeof data.token === 'string' ? data.token : '',
          points,
          description: typeof data.description === 'string' ? data.description : '',
          createdAt: toIso(data.createdAt),
          processedAt: toIso(data.processedAt),
          balanceBefore: Number.isFinite(Number(data.balanceBefore)) ? Number(data.balanceBefore) : null,
          balanceAfter: Number.isFinite(Number(data.balanceAfter)) ? Number(data.balanceAfter) : null,
          branchName: typeof data.branchName === 'string' ? data.branchName : '',
          merchantId: typeof data.merchantId === 'string' ? data.merchantId : ''
        };
      });

    let transactions = [];

    if (branch) {
      try {
        const snap = await firestore
          .collection('transactions')
          .where('branchName', '==', branch)
          .orderBy('createdAt', 'desc')
          .limit(limit)
          .get();
        transactions = mapSnap(snap);
      } catch (err) {
        if (!isMissingIndexError(err)) throw err;
        const snap = await firestore
          .collection('transactions')
          .where('branchName', '==', branch)
          .limit(Math.max(limit, 200))
          .get();
        transactions = mapSnap(snap);
        transactions.sort((a, b) => {
          const aMs = Math.max(toMs(a.processedAt), toMs(a.createdAt));
          const bMs = Math.max(toMs(b.processedAt), toMs(b.createdAt));
          return bMs - aMs;
        });
        if (transactions.length > limit) transactions = transactions.slice(0, limit);
      }
    } else if (!token) {
      // General list (superadmin transactions)
      // Fetch a larger batch to account for filtered-out merchant transactions
      const fallbackLimit = Math.max(limit * 5, 200);
      const [snap, merchantsSnap] = await Promise.all([
        firestore
          .collection('transactions')
          .orderBy('createdAt', 'desc')
          .limit(fallbackLimit)
          .get(),
        firestore.collection('merchants').get()
      ]);

      const closedMerchantIds = new Set();
      for (const doc of merchantsSnap.docs) {
        const data = doc.data() || {};
        if (data.settings?.isClosed === true) {
          closedMerchantIds.add(doc.id);
        }
      }

      transactions = mapSnap(snap);
      // Filter out transactions of closed merchants
      transactions = transactions.filter(t => !t.merchantId || !closedMerchantIds.has(t.merchantId));
      if (transactions.length > limit) {
        transactions = transactions.slice(0, limit);
      }
    } else {
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

        // Fallback to avoid requiring a composite index. We fetch a bit more and sort in memory.
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
    }

    transactions = await attachCardNames(firestore, transactions);

    sendJson(res, 200, { ok: true, transactions });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
  }
}
