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

    const afterDate = url.searchParams.get('afterDate');
    const afterId = url.searchParams.get('afterId');

    try {
      let transactions = [];
      try {
        let query = firestore
          .collection('transactions')
          .where('token', '==', token)
          .orderBy('createdAt', 'desc');
        
        if (afterDate) {
          // If createdAt is stored as a Timestamp in Firestore, we need to convert it.
          // However, toIso handles strings and timestamps, so we might need to check the data type.
          // Usually, startAfter works with the same type as the field.
          // I will attempt to detect if afterDate is a number or string.
          const dateVal = 
            /^\d+$/.test(afterDate) ? Number(afterDate) : 
            (isNaN(Date.parse(afterDate)) ? afterDate : new Date(afterDate));
          
          query = query.startAfter(dateVal);
        }

        const snap = await query.limit(limit).get();
        transactions = mapTxSnap(snap);
      } catch (err) {
        if (!isMissingIndexError(err)) throw err;

        // Fallback: limited in-memory pagination (not ideal but works without composite index)
        const fallbackLimit = afterDate ? 400 : 200;
        const snap = await firestore
          .collection('transactions')
          .where('token', '==', token)
          .limit(fallbackLimit)
          .get();
        transactions = mapTxSnap(snap);

        transactions.sort((a, b) => {
          const aMs = Math.max(toMs(a.processedAt), toMs(a.createdAt));
          const bMs = Math.max(toMs(b.processedAt), toMs(b.createdAt));
          return bMs - aMs;
        });

        if (afterDate) {
          const afterMs = toMs(afterDate);
          transactions = transactions.filter(t => Math.max(toMs(t.processedAt), toMs(t.createdAt)) < afterMs);
        }

        if (transactions.length > limit) transactions = transactions.slice(0, limit);
      }

      sendJson(res, 200, { ok: true, transactions });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
    }
    return;
  }

  try {
    const firestoreDb = getFirestoreDb();
    const snap = await firestoreDb.collection('clientes').where('token', '==', token).limit(1).get();
    if (snap.empty) {
      sendJson(res, 404, { error: 'Not Found' });
      return;
    }

    const doc = snap.docs[0];
    const data = doc.data();
    
    // Evalúa exactamente que no existan esos campos en la base de datos
    const isFirstOpen = (data.firstOpenedAt === undefined) && (data.lastOpenedAt === undefined);
    
    // Preparar campos a actualizar
    const updateData = {
      lastOpenedAt: new Date()
    };
    if (isFirstOpen) {
      updateData.firstOpenedAt = new Date();
    }
    
    // Al estar en un entorno continuo (Railway) y no Serverless,
    // podemos enviar la actualización en segundo plano sin el 'await' 
    // para no demorar la respuesta de la tarjeta al usuario.
    doc.ref.update(updateData).catch(err => console.error("Error updating opened stats", err));

    // Map Firestore fields to what the frontend expects
    const clientData = {
      token,
      name: data.nombre || 'Sin nombre',
      cedula: data.idNumber || '—',
      balance: data.totalPoints || 0,
      updatedAt: toIso(data.updatedAt),
      isFirstOpen,
      lastOpenedAt: toIso(data.lastOpenedAt) || null
    };

    sendJson(res, 200, clientData);
  } catch (err) {
    sendJson(res, 500, { error: err?.message ?? String(err) });
  }
}
