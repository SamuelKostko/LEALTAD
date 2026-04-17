import { getFirestoreDb } from '../_lib/firestore.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { verifySession } from '../_lib/adminAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  // 1. Verify session to get the current admin's document
  const cookies = (req.headers.cookie || '').split(';').reduce((acc, c) => {
    const pair = c.split('=');
    if (pair.length === 2) acc[pair[0].trim()] = decodeURIComponent(pair[1].trim());
    return acc;
  }, {});
  
  const auth = await verifySession(cookies['admin_session']);
  if (!auth.ok) {
    sendJson(res, 401, { error: 'No autorizado.' });
    return;
  }

  const role = String(auth.data?.role ?? '').trim().toLowerCase();
  if (role === 'cashier') {
    sendJson(res, 403, { error: 'No autorizado.' });
    return;
  }

  const firestore = getFirestoreDb();

  try {
    const body = await readJsonBody(req);
    const password = String(body?.password || '').trim();

    if (!password) {
      sendJson(res, 400, { ok: false, error: 'Se requiere la clave de administrador para confirmar el reinicio.' });
      return;
    }

    // 2. Validate password
    const adminData = auth.data; // data from the config document
    const adminPassword = String(adminData?.password || '').trim();
    const expectedPassword = adminPassword || String(process.env.ADMIN_PASSWORD || '').trim();

    if (password !== expectedPassword) {
      sendJson(res, 403, { ok: false, error: 'Clave de confirmación incorrecta. No se realizaron cambios.' });
      return;
    }

    // 3. Proceed with deletion of transactions
    const txSnap = await firestore.collection('transactions').get();
    let batch = firestore.batch();
    let count = 0;

    for (const doc of txSnap.docs) {
      batch.delete(doc.ref);
      count++;
      if (count >= 450) {
        await batch.commit();
        batch = firestore.batch();
        count = 0;
      }
    }

    // 4. Reset balances in 'clientes' (but KEEP the clients)
    const clientSnap = await firestore.collection('clientes').get();
    for (const doc of clientSnap.docs) {
      batch.update(doc.ref, {
        totalPoints: 0,
        updatedAt: new Date()
      });
      count++;
      if (count >= 450) {
        await batch.commit();
        batch = firestore.batch();
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }

    console.log(`[Admin] Reset completed by ${auth.adminId}`);
    sendJson(res, 200, { ok: true, message: 'Reinicio completado: todas las transacciones fueron eliminadas y los balances están en 0.' });
  } catch (err) {
    console.error('Error resetting transactions:', err);
    sendJson(res, 500, { ok: false, error: err?.message || String(err) });
  }
}
