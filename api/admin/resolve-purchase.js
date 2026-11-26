import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreDb } from '../_lib/firestore.js';
import { requireAdmin, verifySession } from '../_lib/adminAuth.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { sendEmail } from '../_lib/mailer.js';
import { sendPushToClient } from '../_lib/push.js';
import {
  DEFAULT_BUY_POINTS_RELEASE,
  computeAvailableAtDate,
  formatReleaseDurationLabel,
  normalizeReleaseConfig
} from '../_lib/points.js';

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

    const adminIdentifier = String(auth.data?.email || auth.data?.username || auth.data?.name || 'Administrador').trim();

    if (action === 'reject') {
      batch.update(purchaseRef, {
        status: 'rejected',
        resolvedAt: FieldValue.serverTimestamp(),
        resolvedBy: adminIdentifier
      });
      await batch.commit();

      if (purchaseData.cardNumber) {
        sendPushToClient(
          purchaseData.cardNumber,
          {
            title: 'Pago no aprobado',
            body: `Tu compra de ${Number(purchaseData.amount || 0)} Pts (Ref. ${purchaseData.reference || 'N/A'}) no fue aprobada.`,
            tag: `purchase-resolved-${purchaseId}`
          },
          firestore
        ).catch(() => null);
      }

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

    // Use the release config snapshotted when the purchase began (legacy purchases default to 10 days)
    const hasSnapshottedConfig =
      purchaseData.releaseValue !== undefined &&
      purchaseData.releaseValue !== null &&
      Boolean(purchaseData.releaseUnit);
    const purchaseReleaseConfig = hasSnapshottedConfig
      ? normalizeReleaseConfig(purchaseData)
      : { ...DEFAULT_BUY_POINTS_RELEASE };

    const isImmediate = purchaseReleaseConfig.releaseValue <= 0;
    const durationLabel = formatReleaseDurationLabel(purchaseReleaseConfig);
    const now = new Date();
    const availableAtDate = computeAvailableAtDate(purchaseReleaseConfig, now);
    const availableAtStr = availableAtDate ? availableAtDate.toISOString() : now.toISOString();
    const availableDisplayStr = availableAtDate
      ? availableAtDate.toLocaleString('es-VE', {
          dateStyle: 'short',
          timeStyle: 'short',
          timeZone: 'America/Caracas'
        })
      : '';

    const txRef = firestore.collection('transactions').doc();

    if (isImmediate) {
      batch.update(clientRef, {
        totalPoints: FieldValue.increment(points),
        updatedAt: FieldValue.serverTimestamp()
      });

      batch.set(txRef, {
        type: 'buy_points',
        status: 'success',
        token: token,
        points: points,
        balanceBefore: currentBalance,
        balanceAfter: currentBalance + points,
        description: `Compra de ${points} puntos (Acreditación inmediata)`,
        createdAt: FieldValue.serverTimestamp(),
        processedAt: FieldValue.serverTimestamp(),
        availableAt: availableAtStr
      });
    } else {
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
      batch.set(txRef, {
        type: 'buy_points',
        status: 'pending_schedule',
        token: token,
        points: points,
        balanceBefore: currentBalance,
        balanceAfter: currentBalance, // balance hasn't changed yet
        description: `Compra de ${points} puntos (Disponibles el ${availableDisplayStr || `en ${durationLabel}`})`,
        createdAt: FieldValue.serverTimestamp(),
        processedAt: FieldValue.serverTimestamp(),
        availableAt: availableAtStr
      });
    }

    // Update purchase status
    batch.update(purchaseRef, {
      status: 'approved',
      resolvedAt: FieldValue.serverTimestamp(),
      resolvedBy: adminIdentifier,
      availableAt: availableAtStr,
      releaseValue: purchaseReleaseConfig.releaseValue,
      releaseUnit: purchaseReleaseConfig.releaseUnit
    });

    await batch.commit();

    // Send email notification to client via Amazon SES / fallback
    const email = String(clientData?.email || '').trim();
    if (email && email.includes('@')) {
      const emailNoticeText = isImmediate
        ? 'Tus puntos ya han sido acreditados a tu saldo y están <strong>disponibles para usar de inmediato</strong>.'
        : `Tus puntos serán acreditados a tu saldo y serán <strong>utilizables en ${durationLabel}</strong> a partir de esta confirmación (aprox. el ${availableDisplayStr}).`;

      const htmlContent = `
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px; padding: 20px;">
          <h2 style="color: #10b981; text-align: center;">¡Pago Aceptado!</h2>
          <p style="font-size: 16px;">Hola <strong>${clientData.nombre || clientData.name || clientData.clientName || 'Cliente'}</strong>,</p>
          <p style="font-size: 16px;">Nos complace informarte que tu compra de <strong>${points} puntos</strong> ha sido verificada y aprobada exitosamente.</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1;">
            <p style="margin: 0; font-size: 15px; font-weight: bold; color: #4b5563;">
              Aviso importante:
            </p>
            <p style="margin: 5px 0 0; font-size: 15px; color: #4b5563;">
              ${emailNoticeText}
            </p>
          </div>
          <p style="font-size: 14px; color: #666; text-align: center; margin-top: 30px;">
            Gracias por preferir V+ Puntos.
          </p>
        </div>
      `;

      sendEmail({
        to: email,
        subject: "Confirmación de Compra de Puntos - V+ Puntos",
        html: htmlContent,
        fromName: "V+ Puntos - Recargas"
      }).catch(e => console.error("Error enviando correo de confirmación:", e));
    }

    // Send push notification to client
    sendPushToClient(
      String(clientData?.token || token || '').trim(),
      {
        title: isImmediate ? `¡Pago aprobado! +${points} Pts` : `¡Pago aprobado! +${points} Pts`,
        body: isImmediate
          ? 'Tus puntos ya fueron acreditados a tu saldo y están disponibles para usar.'
          : `Tus puntos estarán disponibles en ${durationLabel} (${availableDisplayStr}).`,
        tag: `purchase-resolved-${purchaseId}`
      },
      firestore
    ).catch(() => null);

    const successMsg = isImmediate
      ? `Se han acreditado ${points} puntos de forma inmediata.`
      : `Se han programado ${points} puntos exitosamente (disponibles en ${durationLabel}).`;
    sendJson(res, 200, { ok: true, message: successMsg });
  } catch (err) {
    console.error('Error resolving purchase:', err);
    sendJson(res, 500, { ok: false, error: err?.message || String(err) });
  }
}
