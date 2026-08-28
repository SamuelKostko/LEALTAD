import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreDb } from './_lib/firestore.js';
import { sendJson, readJsonBody } from './_lib/http.js';

function extractDigits(str) {
  return String(str || '').replace(/\D/g, '');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const body = await readJsonBody(req);
    const { cardNumber, clientName, amount, totalBs, originBank, originPhone, originId, reference, rate, autoMatchOnly } = body || {};

    if (!cardNumber || !amount || !totalBs) {
      return sendJson(res, 400, { error: 'Faltan campos básicos (cardNumber, amount, totalBs)' });
    }

    if (!autoMatchOnly && (!reference || !originBank || !originPhone || !originId)) {
      console.error('buy-points validation error:', body);
      return sendJson(res, 400, { error: 'Faltan campos manuales requeridos' });
    }

    const db = await getFirestoreDb();
    
    // CASHEA STYLE VERIFICATION: Polling the bank webhook records for up to 15 seconds
    let isApproved = false;
    let matchedTx = null;
    const maxRetries = 5;
    const delayMs = 3000;
    
    const cleanTotalBsStr = String(totalBs).replace(/\./g, '').replace(',', '.');
    const amountClient = parseFloat(cleanTotalBsStr);
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

    // Polling Loop
    for (let i = 0; i < maxRetries; i++) {
      try {
        const verifyRes = await fetch('https://develop.conciliacion.nexuslealtad.com/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: amountClient,
            cedula: clientCedula,
            phone: clientPhone,
            reference: autoMatchOnly ? null : refClient
          })
        });

        const verifyData = await verifyRes.json();
        
        if (verifyRes.ok && verifyData.success) {
          isApproved = true;
          matchedTx = { id: verifyData.matchedId };
          break; // Stop polling!
        }
      } catch (e) {
        console.error('Error fetching verify-payment API:', e);
      }
      
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

    const newPurchase = {
      cardNumber: String(cardNumber),
      clientName: clientName ? String(clientName) : 'Desconocido',
      amount: Number(amount),
      totalBs: String(totalBs),
      originBank: String(originBank || ''),
      originPhone: String(originPhone || ''),
      originId: String(originId || ''),
      reference: String(reference || ''),
      rate: Number(rate || 0),
      status: finalStatus,
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

        const availableAtDate = new Date();
        availableAtDate.setDate(availableAtDate.getDate() + 10);
        const availableAtStr = availableAtDate.toISOString();

        batch.update(clientDocRef, {
          scheduledPoints: FieldValue.arrayUnion({
            amount: points,
            availableAt: availableAtStr,
            source: 'purchase',
            reference: autoMatchOnly ? 'Auto-Conciliado' : String(reference)
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

      // Send Success Email to Client
      const email = clientDataSnapshot && clientDataSnapshot.exists ? String(clientDataSnapshot.data().email || '').trim() : '';
      if (email && email.includes('@')) {
        const mailerSendApiKey = process.env.MAILERSEND_API_KEY;
        if (mailerSendApiKey) {
          const availableAtDate = new Date();
          availableAtDate.setDate(availableAtDate.getDate() + 10);
          
          try {
            await fetch('https://api.mailersend.com/v1/email', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${mailerSendApiKey}`
              },
              body: JSON.stringify({
                from: { email: process.env.MAILERSEND_SENDER_EMAIL || 'no-reply@vmaspuntos.com', name: "V+ Puntos" },
                to: [{ email: email }],
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
                `
              })
            });
          } catch (e) {
            console.error("Error enviando correo al cliente:", e);
          }
        }
      }

    } else {
      // Pending Logic
      await batch.commit();

      const mailerSendApiKey = process.env.MAILERSEND_API_KEY;
      const adminEmail = "frankelissuarez2.0@gmail.com";

      if (mailerSendApiKey) {
        try {
          await fetch('https://api.mailersend.com/v1/email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
              'Authorization': `Bearer ${mailerSendApiKey}`
            },
            body: JSON.stringify({
              from: { email: process.env.MAILERSEND_SENDER_EMAIL || 'no-reply@vmaspuntos.com', name: "V+ Puntos Sistema" },
              to: [{ email: adminEmail }],
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
              `
            })
          });
        } catch (e) {
          console.error("Error enviando correo al administrador:", e);
        }
      }
    }

    return sendJson(res, 200, { success: true, id: purchaseRef?.id, status: finalStatus });

  } catch (err) {
    console.error('Error in buy-points handler:', err);
    return sendJson(res, 500, { error: 'Internal Server Error' });
  }
}
