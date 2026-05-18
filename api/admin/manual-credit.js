import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreDb } from '../_lib/firestore.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { verifySession } from '../_lib/adminAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  // 1. Verify session
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
    const token = String(body?.token || '').trim();
    const points = Number(body?.points || 0);
    const password = String(body?.password || '').trim();

    if (!token || !points || points <= 0 || !password) {
      sendJson(res, 400, { ok: false, error: 'Token, puntos y clave son requeridos.' });
      return;
    }

    // 2. Validate password
    const adminData = auth.data;
    const adminPassword = String(adminData?.password || '').trim();
    const expectedPassword = adminPassword || String(process.env.ADMIN_PASSWORD || '').trim();

    if (password !== expectedPassword) {
      sendJson(res, 403, { ok: false, error: 'Clave incorrecta. No se realizó el abono.' });
      return;
    }

    // 3. Find client
    const clientRef = firestore.collection('clientes').doc(token);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      // Try search by token field if id is not token
      const clientSnap = await firestore.collection('clientes').where('token', '==', token).limit(1).get();
      if (clientSnap.empty) {
        sendJson(res, 404, { ok: false, error: 'Cliente no encontrado.' });
        return;
      }
      // Use the doc from the snap
      const targetDoc = clientSnap.docs[0];
      await applyCredit(targetDoc.ref, targetDoc.data());
    } else {
      await applyCredit(clientRef, clientDoc.data());
    }

    async function applyCredit(ref, data) {
      const isMerchant = role === 'merchant';
      const merchantId = String(auth.adminId ?? '').trim();
      const merchantName = String(auth.data?.name ?? '').trim();
      const merchantBranch = String(auth.data?.branchName ?? '').trim();

      let currentBalance = 0;
      let newBalance = 0;
      let updateData = {};
      let txPayload = {};

      if (isMerchant) {
        if (!merchantId) {
          throw new Error('Merchant ID not found in session');
        }
        const balances = data?.merchantBalances || {};
        currentBalance = Number(balances[merchantId] ?? 0);
        newBalance = currentBalance + points;
        updateData = {
          [`merchantBalances.${merchantId}`]: newBalance,
          updatedAt: FieldValue.serverTimestamp()
        };
        txPayload = {
          type: 'manual_credit',
          status: 'completed',
          token: token,
          points: points,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          merchantId: merchantId,
          merchantName: merchantName,
          branchName: `${merchantName} - ${merchantBranch}`.slice(0, 120),
          description: 'Abono manual del comercio',
          createdAt: FieldValue.serverTimestamp(),
          processedAt: FieldValue.serverTimestamp()
        };
      } else {
        currentBalance = Number(data?.totalPoints || 0);
        newBalance = currentBalance + points;
        updateData = {
          totalPoints: newBalance,
          updatedAt: FieldValue.serverTimestamp()
        };
        txPayload = {
          type: 'manual_credit',
          status: 'completed',
          token: token,
          points: points,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          description: 'Abono manual administrativo',
          createdAt: FieldValue.serverTimestamp(),
          processedAt: FieldValue.serverTimestamp()
        };
      }

      const batch = firestore.batch();
      
      // Update client
      batch.update(ref, updateData);

      // Log transaction
      const txRef = firestore.collection('transactions').doc();
      batch.set(txRef, txPayload);

      await batch.commit();
    }

    sendJson(res, 200, { ok: true, message: `Se han acreditado ${points} puntos exitosamente.` });
  } catch (err) {
    console.error('Error in manual credit:', err);
    sendJson(res, 500, { ok: false, error: err?.message || String(err) });
  }
}
