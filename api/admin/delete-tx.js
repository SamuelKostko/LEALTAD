import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreDb } from '../_lib/firestore.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { requireAdmin, verifySession } from '../_lib/adminAuth.js';

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
  const password = String(body?.password ?? '').trim();

  if (!transactionId) {
    sendJson(res, 400, { ok: false, error: 'transactionId required' });
    return;
  }
  if (!password) {
    sendJson(res, 400, { ok: false, error: 'Se requiere la clave de administrador.' });
    return;
  }

  const pw = await verifyAdminPassword(req, password);
  if (!pw.ok) {
    sendJson(res, pw.status, { ok: false, error: pw.error });
    return;
  }

  const firestore = getFirestoreDb();
  const txRef = firestore.collection('transactions').doc(transactionId);

  try {
    const result = await firestore.runTransaction(async (t) => {
      const snap = await t.get(txRef);
      if (!snap.exists) {
        throw new Error('Transaction not found');
      }

      const data = snap.data() || {};
      const status = String(data.status ?? '').trim();
      const type = String(data.type ?? '').trim();
      const token = String(data.token ?? '').trim();
      const points = Number(data.points || 0);

      // Only completed/successful transactions affect the balance
      if (status === 'completed' || status === 'success') {
        if (token) {
          // Find client
          const clientSnap = await t.get(firestore.collection('clientes').where('token', '==', token).limit(1));
          if (!clientSnap.empty) {
            const clientDoc = clientSnap.docs[0];
            const clientRef = clientDoc.ref;
            
            // Determine adjustment
            let adjustment = 0;
            // credit, manual_credit -> decrease balance
            // redeemed (or success pos_charge) -> increase balance
            if (type === 'credit' || type === 'manual_credit') {
              adjustment = -points;
            } else if (type === 'pos_charge' || type === 'redeemed') {
              adjustment = points;
            }

            if (adjustment !== 0) {
              t.update(clientRef, {
                totalPoints: FieldValue.increment(adjustment),
                updatedAt: FieldValue.serverTimestamp()
              });
            }
          }
        }
      }

      t.delete(txRef);
      return { ok: true };
    });

    sendJson(res, 200, { ok: true, deleted: true, transactionId });
  } catch (err) {
    console.error('Error deleting transaction:', err);
    sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
  }
}
