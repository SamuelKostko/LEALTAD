import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreDb } from './_lib/firestore.js';
import { sendJson, readJsonBody } from './_lib/http.js';
import { sendEmail } from './_lib/mailer.js';

function extractDigits(str) {
  return String(str || '').replace(/\D/g, '');
}

function parseAmount(val) {
  if (typeof val === 'number') return val;
  let s = String(val || '').trim();
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const parsed = parseFloat(s);
  return isNaN(parsed) ? 0 : parsed;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const body = await readJsonBody(req);
    const { cardNumber, clientName, amount, totalBs, originBank, originPhone, originId, reference, date, rate, autoMatchOnly } = body || {};

    if (!cardNumber || !amount || !totalBs) {
      return sendJson(res, 400, { error: 'Faltan campos básicos (cardNumber, amount, totalBs)' });
    }

    if (!autoMatchOnly && (!reference || reference.trim().length < 4)) {
      console.error('buy-points validation error: reference is required and must have at least 4 digits', body);
      return sendJson(res, 400, { error: 'Debes ingresar al menos los últimos 4 dígitos de la referencia' });
    }

    const db = await getFirestoreDb();
    const baseUrl = (process.env.RECONCILIATION_API_URL || 'https://conciliacion.nexuslealtad.com/api').replace(/\/$/, '');
    const defaultSede = process.env.RECONCILIATION_SEDE || 'VMAS';

    // CASHEA STYLE VERIFICATION: Polling the bank webhook records for up to 15 seconds
    let isApproved = false;
    let matchedTx = null;
    const maxRetries = 5;
    const delayMs = 3000;

    const amountClient = parseAmount(totalBs);
    const refClient = reference ? String(reference).trim() : '';

    // If autoMatchOnly, we need the user's registered ID to match securely
    let clientCedula = '';
    let clientPhone = '';
    let clientDocRef = null;
    let clientDataSnapshot = null;

    // Fetch Client info
    clientDocRef = db.collection('clientes').doc(String(cardNumber));
    clientDataSnapshot = await clientDocRef.get();

    if (!clientDataSnapshot.exists) {
      const clientSnap = await db.collection('clientes').where('token', '==', String(cardNumber)).limit(1).get();
      if (!clientSnap.empty) {
        clientDocRef = clientSnap.docs[0].ref;
        clientDataSnapshot = clientSnap.docs[0];
      }
    }

    if (clientDataSnapshot && clientDataSnapshot.exists) {
      const cData = clientDataSnapshot.data();
      clientCedula = extractDigits(cData.idNumber || cData.cedula || '');
      clientPhone = extractDigits(cData.telefono || '');
    }

    // Polling Loop / Verification
    for (let i = 0; i < maxRetries; i++) {
      try {
        const payload = autoMatchOnly
          ? {
              amount: parseFloat(amountClient.toFixed(2)),
              phone: clientPhone,
              sede: defaultSede
            }
          : {
              amount: parseFloat(amountClient.toFixed(2)),
              reference: refClient,
              phone: extractDigits(originPhone) || clientPhone,
              cedula: extractDigits(originId) || clientCedula,
              sede: defaultSede
            };

        const verifyRes = await fetch(`${baseUrl}/verify-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const verifyData = await verifyRes.json();

        if (verifyRes.ok && verifyData.success) {
          isApproved = true;
          const realRef = verifyData.reference || verifyData.referencia || verifyData.referencia_banco || refClient;
          matchedTx = {
            id: verifyData.matchedId,
            reference: realRef
          };
          break; // Stop polling!
        }
      } catch (e) {
        console.error('Error fetching verify-payment API:', e);
      }

      // In manual mode if not found in first attempt, we don't necessarily need to loop 5 times if user already reported it
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // If we are in autoMatchOnly and didn't find exactly 1 match, we DO NOT save anything. We just return.
    if (autoMatchOnly && !isApproved) {
      return sendJson(res, 200, { success: false, require_manual_data: true });
    }

    // Proceed to save the purchase (Approved or Pending)
    const purchaseRef = db.collection('pending_purchases').doc();
    const finalStatus = isApproved ? 'approved' : 'pending';

    const clientEmail = clientDataSnapshot && clientDataSnapshot.exists ? String(clientDataSnapshot.data()?.email || '').trim() : '';
    const resolvedClientName = clientName ? String(clientName) : (clientDataSnapshot && clientDataSnapshot.exists ? String(clientDataSnapshot.data()?.nombre || clientDataSnapshot.data()?.name || 'Desconocido') : 'Desconocido');

    let availableAtStr = null;
    if (isApproved) {
      const availableAtDate = new Date();
      availableAtDate.setDate(availableAtDate.getDate() + 10);
      availableAtStr = availableAtDate.toISOString();
    }

    const finalRef = matchedTx?.reference || (refClient || (autoMatchOnly ? 'Auto-Conciliado' : ''));

    const newPurchase = {
      cardNumber: String(cardNumber),
      clientName: resolvedClientName,
      clientEmail: clientEmail,
      clientCedula: clientCedula || '',
      clientPhone: clientPhone || '',
      amount: Number(amount),
      totalBs: String(totalBs),
      originBank: String(originBank || (autoMatchOnly ? 'Conciliación Automática' : 'Pago Móvil')),
      originPhone: String(originPhone || clientPhone || ''),
      originId: String(originId || clientCedula || ''),
      reference: finalRef,
      rate: Number(rate || 0),
      status: finalStatus,
      isAutoReconciled: isApproved && !!matchedTx,
      matchedTxId: matchedTx ? matchedTx.id : null,
      resolvedAt: isApproved ? new Date().toISOString() : null,
      resolvedBy: isApproved ? (autoMatchOnly ? 'Sistema (Auto-Conciliado)' : 'Sistema (Conciliación Manual Banco)') : null,
      availableAt: availableAtStr,
      createdAt: new Date().toISOString()
    };

    const batch = db.batch();
    batch.set(purchaseRef, newPurchase);

    if (isApproved) {
      // Logic for Instant Approval
      const token = String(cardNumber);
      const points = Number(amount || 0);

      if (clientDataSnapshot && clientDataSnapshot.exists) {
        const clientData = clientDataSnapshot.data();
        const currentBalance = Number(clientData?.totalPoints || 0);

        batch.update(clientDocRef, {
          scheduledPoints: FieldValue.arrayUnion({
            amount: points,
            availableAt: availableAtStr,
            source: 'purchase',
            reference: finalRef
          }),
          updatedAt: FieldValue.serverTimestamp()
        });

        const pointsTxRef = db.collection('transactions').doc();
        batch.set(pointsTxRef, {
          type: 'buy_points',
          status: 'pending_schedule',
          token: token,
          points: points,
          balanceBefore: currentBalance,
          balanceAfter: currentBalance,
          description: `Compra de ${points} puntos (Disponibles el ${availableAtDate.toLocaleDateString()})`,
          createdAt: FieldValue.serverTimestamp(),
          processedAt: FieldValue.serverTimestamp(),
          availableAt: availableAtStr
        });
      }

      await batch.commit();

      // Send Success Email to Client via Amazon SES / fallback
      const email = clientDataSnapshot && clientDataSnapshot.exists ? String(clientDataSnapshot.data().email || '').trim() : '';
      if (email && email.includes('@')) {
        const availableAtDate = new Date();
        availableAtDate.setDate(availableAtDate.getDate() + 10);

        sendEmail({
          to: email,
          subject: "Confirmación de Compra de Puntos - V+ Puntos",
          html: `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px; padding: 20px;">
              <h2 style="color: #10b981; text-align: center;">¡Pago Verificado!</h2>
              <p style="font-size: 16px;">Hola,</p>
              <p style="font-size: 16px;">Nos complace informarte que tu compra de <strong>${points} puntos</strong> ha sido verificada y aprobada automáticamente.</p>
              <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1;">
                <p style="margin: 0; font-size: 15px; font-weight: bold; color: #4b5563;">Aviso importante:</p>
                <p style="margin: 5px 0 0; font-size: 15px; color: #4b5563;">
                  Tus puntos serán acreditados a tu saldo y utilizables en 10 días a partir de esta confirmación (aprox. el ${availableAtDate.toLocaleDateString()}).
                </p>
              </div>
            </div>
          `,
          fromName: "V+ Puntos - Recargas"
        }).catch(e => console.error("Error enviando correo al cliente:", e));
      }

    } else {
      // Pending Logic
      await batch.commit();

      const adminEmail = "frankelissuarez2.0@gmail.com";

      sendEmail({
        to: adminEmail,
        subject: "Pago Móvil Pendiente por Aprobación",
        html: `
          <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px; padding: 20px;">
            <h2 style="color: #2563eb; text-align: center;">¡Nuevo Pago Móvil Reportado!</h2>
            <p style="font-size: 16px;">Tienes una nueva notificación de pago esperando por tu aprobación en el panel.</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <ul style="list-style: none; padding: 0; margin: 0; font-size: 15px; line-height: 1.6;">
                <li><strong>Cliente:</strong> ${newPurchase.clientName}</li>
                <li><strong>Monto (Bs):</strong> ${newPurchase.totalBs}</li>
                <li><strong>Puntos a comprar:</strong> ${newPurchase.amount} Puntos</li>
                <li><strong>Referencia:</strong> ${newPurchase.reference}</li>
                <li><strong>Banco Origen:</strong> ${newPurchase.originBank}</li>
                <li><strong>Teléfono:</strong> ${newPurchase.originPhone}</li>
              </ul>
            </div>
          </div>
        `,
        fromName: "V+ Puntos Sistema"
      }).catch(e => console.error("Error enviando correo al administrador:", e));
    }

    return sendJson(res, 200, { success: true, id: purchaseRef?.id, status: finalStatus });

  } catch (err) {
    console.error('Error in buy-points handler:', err);
    return sendJson(res, 500, { error: 'Internal Server Error' });
  }
}
