import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreDb } from '../_lib/firestore.js';
import { requireAdmin, verifySession } from '../_lib/adminAuth.js';
import { readJsonBody, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  // Verify admin session
  const cookies = (req.headers.cookie || '').split(';').reduce((acc, c) => {
    const pair = c.split('=');
    if (pair.length === 2) acc[pair[0].trim()] = decodeURIComponent(pair[1].trim());
    return acc;
  }, {});
  
  const auth = await verifySession(cookies['admin_session']);
  if (!auth.ok) {
    return sendJson(res, 401, { error: 'No autorizado.' });
  }

  const role = String(auth.data?.role ?? '').trim().toLowerCase();
  // Only super admin can resolve purchases for now
  if (role === 'cashier' || role === 'merchant') {
    return sendJson(res, 403, { error: 'No autorizado.' });
  }

  const firestore = getFirestoreDb();

  try {
    const body = await readJsonBody(req);
    const purchaseId = String(body?.id || '').trim();
    const action = String(body?.action || '').trim(); // 'approve' or 'reject'

    if (!purchaseId || !['approve', 'reject'].includes(action)) {
      return sendJson(res, 400, { ok: false, error: 'Parámetros inválidos.' });
    }

    const purchaseRef = firestore.collection('pending_purchases').doc(purchaseId);
    const purchaseDoc = await purchaseRef.get();
    
    if (!purchaseDoc.exists) {
      return sendJson(res, 404, { ok: false, error: 'Solicitud no encontrada.' });
    }

    const purchaseData = purchaseDoc.data();
    
    if (purchaseData.status !== 'pending') {
      return sendJson(res, 400, { ok: false, error: `La solicitud ya fue procesada (${purchaseData.status}).` });
    }

    const batch = firestore.batch();
    
    if (action === 'reject') {
      batch.update(purchaseRef, {
        status: 'rejected',
        resolvedAt: FieldValue.serverTimestamp()
      });
      await batch.commit();
      return sendJson(res, 200, { ok: true, message: 'Pago rechazado exitosamente.' });
    }

    // If approve, we need to add the points to the user
    const token = purchaseData.cardNumber;
    const points = Number(purchaseData.amount || 0);

    // Find client
    let clientRef = firestore.collection('clientes').doc(token);
    let clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      // Try search by token field
      const clientSnap = await firestore.collection('clientes').where('token', '==', token).limit(1).get();
      if (clientSnap.empty) {
        return sendJson(res, 404, { ok: false, error: 'Cliente no encontrado.' });
      }
      clientRef = clientSnap.docs[0].ref;
      clientDoc = clientSnap.docs[0];
    }

    const clientData = clientDoc.data();
    const currentBalance = Number(clientData?.totalPoints || 0);
    const newBalance = currentBalance + points;

    // Update client balance
    batch.update(clientRef, {
      totalPoints: newBalance,
      updatedAt: FieldValue.serverTimestamp()
    });

    // Log transaction
    const txRef = firestore.collection('transactions').doc();
    batch.set(txRef, {
      type: 'buy_points',
      status: 'completed',
      token: token,
      points: points,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      description: `Compra de ${points} puntos vía Pago Móvil (Ref: ${purchaseData.reference})`,
      createdAt: FieldValue.serverTimestamp(),
      processedAt: FieldValue.serverTimestamp()
    });

    // Update purchase status
    batch.update(purchaseRef, {
      status: 'approved',
      resolvedAt: FieldValue.serverTimestamp()
    });

    await batch.commit();

    sendJson(res, 200, { ok: true, message: `Se han acreditado ${points} puntos exitosamente.` });
  } catch (err) {
    console.error('Error resolving purchase:', err);
    sendJson(res, 500, { ok: false, error: err?.message || String(err) });
  }
}
