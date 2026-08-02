import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreDb } from '../_lib/firestore.js';
import { readJsonBody, sendJson } from '../_lib/http.js';

async function sendPromotionEmail(clientData, promoData, configData) {
  const mailerSendApiKey = process.env.MAILERSEND_API_KEY;
  const mailerSendSender = process.env.MAILERSEND_SENDER_EMAIL;

  const clientEmail = String(clientData.email || '').trim();
  const toEmails = new Set();
  if (clientEmail) toEmails.add(clientEmail);
  
  // PARA PRUEBAS: Enviar copia administrativa solo a este correo, ignorando la lista de configuración
  toEmails.add('kostkosamuel43@gmail.com');

  if (toEmails.size === 0) return;

  const formattedRecipients = Array.from(toEmails).map(email => ({ email }));

  const subjectStr = `V+ Puntos - Solicitud de Promoción: ${promoData.title}`;

  const htmlContent = `
  <!DOCTYPE html>
  <html lang="es">
  <body style="margin: 0; padding: 20px; font-family: sans-serif; background-color: #0d0f12; color: #fff;">
    <div style="max-width: 600px; margin: 0 auto; background: #161920; border-radius: 12px; padding: 20px; border: 1px solid #2d3748;">
      <h2 style="color: #06b6d4; margin-top: 0;">¡Nueva Solicitud de Promoción!</h2>
      <p>El cliente <strong>${clientData.nombre || 'Sin nombre'}</strong> (Cédula: ${clientData.cedula || clientData.idNumber || 'N/A'}) ha canjeado una promoción.</p>
      
      <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px; color: #fff;">Detalles de la Promoción</h3>
        <p style="margin: 4px 0;"><strong>Título:</strong> ${promoData.title}</p>
        <p style="margin: 4px 0;"><strong>Puntos canjeados:</strong> ${promoData.points}</p>
        <p style="margin: 4px 0;"><strong>Sede / Ubicación:</strong> ${promoData.branch || 'N/A'}</p>
      </div>

      <p style="color: #a0aec0; font-size: 13px;">Los puntos ya han sido descontados automáticamente de su cuenta.</p>
    </div>
  </body>
  </html>
  `;

  if (mailerSendApiKey && mailerSendSender) {
    try {
      await fetch('https://api.mailersend.com/v1/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mailerSendApiKey}`
        },
        body: JSON.stringify({
          from: {
            email: mailerSendSender,
            name: 'V+ Puntos'
          },
          to: formattedRecipients,
          subject: subjectStr,
          html: htmlContent
        })
      });
    } catch (err) {
      console.error('Error enviando email de promoción:', err);
    }
  } else {
    console.log('--- SIMULADOR DE ENVÍO DE EMAIL DE PROMOCIÓN ---');
    console.log(`To: ${Array.from(toEmails).join(', ')}`);
    console.log(`Subject: ${subjectStr}`);
    console.log('--------------------------------------------------');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const token = String(body?.token || '').trim();
    const promotionId = String(body?.promotionId || '').trim();
    const otp = String(body?.otp || '').trim();

    if (!token || !promotionId || !otp) {
      sendJson(res, 400, { error: 'Token, promotionId y otp son requeridos' });
      return;
    }

    const firestore = getFirestoreDb();

    // Fetch config for emails list
    const configDoc = await firestore.collection('config').doc('reports_settings').get();
    const configData = configDoc.exists ? configDoc.data() : {};

    const result = await firestore.runTransaction(async (tx) => {
      // 1. Fetch promotion
      const promoRef = firestore.collection('promotions').doc(promotionId);
      const promoDoc = await tx.get(promoRef);
      if (!promoDoc.exists) {
        throw new Error('La promoción no existe.');
      }
      const promoData = promoDoc.data();
      const pointsRequired = Number(promoData.points || 0);

      if (promoData.expiresAt && promoData.expiresAt < Date.now()) {
        throw new Error('La promoción ha expirado.');
      }
      
      if (promoData.units !== undefined && promoData.units <= 0) {
        throw new Error('Esta promoción se ha agotado.');
      }

      // 2. Fetch client
      let clientRef = firestore.collection('clientes').doc(token);
      let clientDoc = await tx.get(clientRef);
      if (!clientDoc.exists) {
        const clientSnap = await tx.get(firestore.collection('clientes').where('token', '==', token).limit(1));
        if (clientSnap.empty) {
          throw new Error('Cliente no encontrado.');
        }
        clientDoc = clientSnap.docs[0];
        clientRef = clientDoc.ref;
      }
      const clientData = clientDoc.data() || {};
      
      // OTP Verification
      const savedOtp = clientData.promoOtpCode;
      const otpExpiresAt = clientData.promoOtpExpiresAt || 0;
      let otpAttempts = clientData.promoOtpAttempts || 0;

      if (!savedOtp) {
         throw new Error('No has solicitado un código OTP para esta compra.');
      }
      
      if (Date.now() > otpExpiresAt) {
         tx.update(clientRef, { promoOtpCode: FieldValue.delete(), promoOtpExpiresAt: FieldValue.delete(), promoOtpAttempts: FieldValue.delete() });
         throw new Error('El código OTP ha expirado. Solicita uno nuevo.');
      }
      
      if (savedOtp !== otp) {
         otpAttempts += 1;
         if (otpAttempts >= 3) {
             tx.update(clientRef, { promoOtpCode: FieldValue.delete(), promoOtpExpiresAt: FieldValue.delete(), promoOtpAttempts: FieldValue.delete() });
             throw new Error('Demasiados intentos fallidos. Código cancelado, solicita uno nuevo.');
         } else {
             tx.update(clientRef, { promoOtpAttempts: otpAttempts });
             throw new Error(`Código incorrecto. Te quedan ${3 - otpAttempts} intentos.`);
         }
      }

      const currentBalance = Number(clientData.totalPoints || 0);

      // 3. Verify points
      if (currentBalance < pointsRequired) {
        throw new Error(`Puntos insuficientes. Tienes ${currentBalance} Pts y necesitas ${pointsRequired} Pts.`);
      }

      // 4. Update balance and units and clear OTP
      const newBalance = currentBalance - pointsRequired;
      tx.update(clientRef, {
        totalPoints: newBalance,
        promoOtpCode: FieldValue.delete(),
        promoOtpExpiresAt: FieldValue.delete(),
        promoOtpAttempts: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
      });
      
      if (promoData.units !== undefined) {
        tx.update(promoRef, {
          units: promoData.units - 1
        });
      }

      // 5. Create transaction log
      const txRef = firestore.collection('transactions').doc();
      tx.set(txRef, {
        type: 'promotion_request',
        status: 'completed',
        token: token,
        points: pointsRequired,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        description: `Canje de promoción: ${promoData.title}`,
        createdAt: FieldValue.serverTimestamp(),
        processedAt: FieldValue.serverTimestamp(),
        promotionId: promotionId,
        branchName: promoData.branch || 'Global'
      });

      return { clientData, promoData };
    });

    // Send email asynchronously without blocking the response
    sendPromotionEmail(result.clientData, result.promoData, configData).catch(e => console.error(e));

    sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error('Request promotion error:', err);
    sendJson(res, 400, { error: err.message || 'Error al procesar solicitud' });
  }
}
