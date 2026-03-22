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
  const mode = String(url.searchParams.get('mode') ?? '').trim();
  if (!token) {
    sendJson(res, 400, { error: 'Missing token' });
    return;
  }

  // mode=activity returns transaction history for the wallet.
  if (mode === 'activity') {
    const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 80, fallback: 20 });
    const debugMode = String(url.searchParams.get('debug') || '') === '1';
    const firestore = getFirestoreDb();

    const mapTxSnap = (snap) =>
      snap.docs.map((d) => {
        const data = d.data() || {};
        return {
          id: d.id,
          type: typeof data.type === 'string' && data.type ? data.type : '',
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

    const mapCreditSnap = (snap) =>
      snap.docs.map((d) => {
        const data = d.data() || {};
        const points = Number.isFinite(Number(data.points))
          ? Number(data.points)
          : (Number.isFinite(Number(data.puntosGanados)) ? Number(data.puntosGanados) : 0);
        const fallbackDesc = `Compra (Ref: ${data.refSaint || 'N/A'}, Monto: ${data.montoCompra || 0})`;
        const created = toIso(data.createdAt) || toIso(data.fecha);
        const status = String(data.status || 'completed').trim().toLowerCase();
        return {
          id: d.id,
          type: typeof data.type === 'string' && data.type ? data.type : 'credit',
          status,
          token: String(data.cedula ?? data.idNumber ?? '').trim(),
          points,
          description: typeof data.description === 'string' && data.description.trim() ? data.description : fallbackDesc,
          createdAt: created,
          processedAt: created,
          balanceBefore: null,
          balanceAfter: null
        };
      });

    try {
      // 1. Obtener la tarjeta primero para sacar la cedula (ya que transactions_credito se vincula por cedula)
      const cardSnap = await firestore.collection('cards').doc(token).get();
      if (!cardSnap.exists) {
        return sendJson(res, 404, { error: 'Card not found' });
      }
      const cedula = String(cardSnap.data().cedula || '').trim();
      const cedulaNum = Number(cedula);
      const cedulaCandidates = [
        cedula,
        Number.isFinite(cedulaNum) ? cedulaNum : null
      ].filter((v) => v !== null && String(v).trim() !== '');

      const getTxs = async (useOrder) => {
        const queryLimit = useOrder ? limit : Math.max(limit, 200);
        
        let txQuery = firestore.collection('transactions').where('token', '==', token);
        if (useOrder) txQuery = txQuery.orderBy('createdAt', 'desc');

        const promises = [txQuery.limit(queryLimit).get()];
        const queryMeta = [];

        const creditCollections = ['transactions_credito', 'transactions_credit'];
        const creditFields = ['cedula', 'idNumber'];

        for (const col of creditCollections) {
          for (const field of creditFields) {
            for (const value of cedulaCandidates) {
              queryMeta.push({ collection: col, field, value: String(value) });
              promises.push(
                firestore.collection(col).where(field, '==', value).limit(queryLimit).get()
              );
            }
          }
        }

        const results = await Promise.all(promises);
        const txSnap = results[0];
        const creditSnaps = results.slice(1);

        const allItems = [...mapTxSnap(txSnap)];
        const creditQueryCounts = [];
        for (let i = 0; i < creditSnaps.length; i += 1) {
          const snap = creditSnaps[i];
          allItems.push(...mapCreditSnap(snap));
          if (debugMode) {
            const meta = queryMeta[i] || { collection: '?', field: '?', value: '?' };
            creditQueryCounts.push({ ...meta, count: snap.size });
          }
        }

        // Deduplicate records that can come from multiple equivalent queries.
        const deduped = [];
        const seen = new Set();
        for (const item of allItems) {
          const key = `${item.id}|${item.createdAt}|${item.points}|${item.type}`;
          if (seen.has(key)) continue;
          seen.add(key);
          deduped.push(item);
        }
        
        deduped.sort((a, b) => {
          const aMs = Math.max(toMs(a.processedAt), toMs(a.createdAt));
          const bMs = Math.max(toMs(b.processedAt), toMs(b.createdAt));
          return bMs - aMs;
        });

        const txs = deduped.length > limit ? deduped.slice(0, limit) : deduped;
        if (debugMode) {
          return {
            transactions: txs,
            debug: {
              token,
              cedula,
              queryLimit,
              txCount: txSnap.size,
              creditQueries: creditQueryCounts
            }
          };
        }
        return { transactions: txs, debug: null };
      };

      let transactions = [];
      let debug = null;
      try {
        const result = await getTxs(true);
        transactions = result.transactions;
        debug = result.debug;
      } catch (err) {
        if (!isMissingIndexError(err)) throw err;
        const result = await getTxs(false);
        transactions = result.transactions;
        debug = result.debug;
      }

      sendJson(res, 200, { ok: true, transactions, ...(debug ? { debug } : {}) });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
    }
    return;
  }

  try {
    const snap = await getFirestoreDb().collection('cards').doc(token).get();
    if (!snap.exists) {
      sendJson(res, 404, { error: 'Not Found' });
      return;
    }

    sendJson(res, 200, { token, ...snap.data() });
  } catch (err) {
    sendJson(res, 500, { error: err?.message ?? String(err) });
  }
}
