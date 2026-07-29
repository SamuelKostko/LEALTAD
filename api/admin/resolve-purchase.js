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

    // Calculate availableAt (10 days from now)
    const availableAtDate = new Date();
    availableAtDate.setDate(availableAtDate.getDate() + 10);
    const availableAtStr = availableAtDate.toISOString();

    // Add to scheduledPoints instead of totalPoints
    batch.update(clientRef, {
      scheduledPoints: FieldValue.arrayUnion({
        amount: points,
        availableAt: availableAtStr,
        source: 'purchase',
        reference: purchaseData.reference || ''
      }),
      updatedAt: FieldValue.serverTimestamp()
    });

    // Log transaction (pending status for now, since points aren't fully usable yet)
    const txRef = firestore.collection('transactions').doc();
    batch.set(txRef, {
      type: 'buy_points',
      status: 'pending_schedule',
      token: token,
      points: points,
      balanceBefore: currentBalance,
      balanceAfter: currentBalance, // balance hasn't changed yet
      description: `Compra de ${points} puntos (Disponibles el ${availableAtDate.toLocaleDateString()})`,
      createdAt: FieldValue.serverTimestamp(),
      processedAt: FieldValue.serverTimestamp(),
      availableAt: availableAtStr
    });

    // Update purchase status
    batch.update(purchaseRef, {
      status: 'approved',
      resolvedAt: FieldValue.serverTimestamp()
    });

    await batch.commit();

    // Send email notification to client
    const email = String(clientData?.email || '').trim();
    if (email && email.includes('@')) {
      const mailerSendApiKey = process.env.MAILERSEND_API_KEY;
      const mailerSendSender = process.env.MAILERSEND_SENDER_EMAIL || 'no-reply@vmaspuntos.com';

      if (mailerSendApiKey) {
        const htmlContent = `
          <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px; padding: 20px;">
            <h2 style="color: #10b981; text-align: center;">¡Pago Aceptado!</h2>
            <p style="font-size: 16px;">Hola <strong>${clientData.clientName || 'Cliente'}</strong>,</p>
            <p style="font-size: 16px;">Nos complace informarte que tu compra de <strong>${points} puntos</strong> ha sido verificada y aprobada exitosamente.</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1;">
              <p style="margin: 0; font-size: 15px; font-weight: bold; color: #4b5563;">
                Aviso importante:
              </p>
              <p style="margin: 5px 0 0; font-size: 15px; color: #4b5563;">
                Tus puntos serán acreditados a tu saldo y serán <strong>utilizables en 10 días</strong> a partir de esta confirmación (aprox. el ${availableAtDate.toLocaleDateString()}).
              </p>
            </div>
            <p style="font-size: 14px; color: #666; text-align: center; margin-top: 30px;">
              Gracias por preferir V+ Puntos.
            </p>
          </div>
        `;

        try {
          await fetch('https://api.mailersend.com/v1/email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
              'Authorization': `Bearer ${mailerSendApiKey}`
            },
            body: JSON.stringify({
              from: { email: mailerSendSender, name: "V+ Puntos" },
              to: [{ email: email }],
              subject: "Confirmación de Compra de Puntos - V+ Puntos",
              html: htmlContent
            })
          });
        } catch (e) {
          console.error("Error enviando correo de confirmación:", e);
        }
      }
    }

    sendJson(res, 200, { ok: true, message: `Se han programado ${points} puntos exitosamente (disponibles en 10 días).` });
  } catch (err) {
    console.error('Error resolving purchase:', err);
    sendJson(res, 500, { ok: false, error: err?.message || String(err) });
  }
}
