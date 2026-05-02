import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreDb } from '../_lib/firestore.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { requireAdmin, verifySession } from '../_lib/adminAuth.js';

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

function parseCookies(header) {
  const raw = String(header ?? '');
  if (!raw) return {};
  const out = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(val);
  }
  return out;
}

async function findClientRefByToken(firestore, token) {
  // Primary: token field (this is the canonical identifier used by /card/<token> and transactions)
  const snap = await firestore.collection('clientes').where('token', '==', token).limit(1).get();
  if (!snap.empty) return snap.docs[0].ref;

  // Fallback: docId equals token (legacy/local)
  const docRef = firestore.collection('clientes').doc(token);
  const doc = await docRef.get();
  if (doc.exists) return docRef;

  return null;
}

async function verifyAdminPassword(req, password) {
  const cookies = parseCookies(req.headers.cookie);
  const auth = await verifySession(cookies['admin_session']);
  if (!auth.ok) return { ok: false, status: 401, error: 'No autorizado.' };

  const adminData = auth.data;
  const adminPassword = String(adminData?.password || '').trim();
  const expectedPassword = adminPassword || String(process.env.ADMIN_PASSWORD || '').trim();

  if (!expectedPassword) return { ok: false, status: 500, error: 'Admin no configurado correctamente.' };
  if (String(password || '').trim() !== expectedPassword) {
    return { ok: false, status: 403, error: 'Clave incorrecta.' };
  }

  return { ok: true };
}

export default async function handler(req, res) {
  // All methods require an active admin session
  if (!(await requireAdmin(req, res))) return;

  const firestore = getFirestoreDb();

  if (req.method === 'PATCH') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    const token = String(body?.token ?? '').trim();
    const name = String(body?.name ?? '').trim();
    const cedula = String(body?.cedula ?? '').trim();

    if (!token) {
      sendJson(res, 400, { error: 'Token requerido.' });
      return;
    }
    if (!name || name.length > 120) {
      sendJson(res, 400, { error: 'Nombre inválido.' });
      return;
    }
    if (!cedula || cedula.length > 40) {
      sendJson(res, 400, { error: 'Cédula inválida.' });
      return;
    }

    try {
      const ref = await findClientRefByToken(firestore, token);
      if (!ref) {
        sendJson(res, 404, { error: 'Cliente no encontrado.' });
        return;
      }

      await ref.set(
        {
          nombre: name,
          idNumber: cedula,
          cedula,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
    }
    return;
  }

  if (req.method === 'DELETE') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    const token = String(body?.token ?? '').trim();
    const password = String(body?.password ?? '').trim();
    const deleteTransactions = body?.deleteTransactions === true;

    if (!token) {
      sendJson(res, 400, { error: 'Token requerido.' });
      return;
    }
    if (!password) {
      sendJson(res, 400, { error: 'Se requiere la clave de administrador para confirmar.' });
      return;
    }

    const pw = await verifyAdminPassword(req, password);
    if (!pw.ok) {
      sendJson(res, pw.status, { ok: false, error: pw.error });
      return;
    }

    try {
      const ref = await findClientRefByToken(firestore, token);
      if (!ref) {
        sendJson(res, 404, { error: 'Cliente no encontrado.' });
        return;
      }

      await ref.delete();

      if (deleteTransactions) {
        const txSnap = await firestore.collection('transactions').where('token', '==', token).get();
        let batch = firestore.batch();
        let count = 0;

        for (const d of txSnap.docs) {
          batch.delete(d.ref);
          count += 1;
          if (count >= 450) {
            await batch.commit();
            batch = firestore.batch();
            count = 0;
          }
        }
        if (count > 0) await batch.commit();
      }

      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
    }
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 200, fallback: 50 });

  try {
    const snap = await firestore.collection('clientes').orderBy('updatedAt', 'desc').limit(limit).get();
    const cards = snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        token: typeof data.token === 'string' ? data.token : d.id, // Fallback to doc ID if token field is missing
        name: typeof data.nombre === 'string' ? data.nombre : '',
        cedula:
          typeof data.idNumber === 'string'
            ? data.idNumber
            : (typeof data.cedula === 'string' ? data.cedula : ''),
        balance: Number.isFinite(Number(data.totalPoints)) ? Number(data.totalPoints) : 0,
        sedes: typeof data.sedes === 'string' ? data.sedes : 'Sin sede',
        updatedAt: toIso(data.updatedAt)
      };
    });

    sendJson(res, 200, { ok: true, cards });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
  }
}
