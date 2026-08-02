import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreDb } from '../_lib/firestore.js';
import { readJsonBody, sendJson } from '../_lib/http.js';

async function sendOtpEmail(clientEmail, otpCode, promoTitle) {
  const mailerSendApiKey = process.env.MAILERSEND_API_KEY;
  const mailerSendSender = process.env.MAILERSEND_SENDER_EMAIL;

  if (!clientEmail) return;

  const subjectStr = `Código de verificación para ${promoTitle}`;

  // Clear text message explicitly optimized for mobile parsing
  const htmlContent = `
  <!DOCTYPE html>
  <html lang="es">
  <body style="margin: 0; padding: 20px; font-family: sans-serif; background-color: #0d0f12; color: #fff;">
    <div style="max-width: 600px; margin: 0 auto; background: #161920; border-radius: 12px; padding: 20px; border: 1px solid #2d3748; text-align: center;">
      <h2 style="color: #06b6d4; margin-top: 0;">Confirma tu Compra</h2>
      <p style="font-size: 16px; color: #e2e8f0;">Estás a un paso de obtener: <strong>${promoTitle}</strong>.</p>
      
      <p>Tu código de verificación de un solo uso es:</p>
      <div style="font-size: 32px; font-weight: bold; background: #e0f2fe; color: #0369a1; padding: 12px 20px; border-radius: 8px; display: inline-block; letter-spacing: 6px; margin: 20px 0;">${otpCode}</div>
      
      <p style="color: #a0aec0; font-size: 13px;">Este código expirará en 10 minutos. Si no has solicitado esto, puedes ignorar este correo.</p>
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
          from: { email: mailerSendSender, name: 'V+ Puntos' },
          to: [{ email: clientEmail }],
          subject: subjectStr,
          html: htmlContent
        })
      });
    } catch (err) {
      console.error('Error enviando email OTP:', err);
    }
  } else {
    console.log('--- SIMULADOR DE ENVÍO OTP ---');
    console.log(`To: ${clientEmail}`);
    console.log(`Subject: ${subjectStr}`);
    console.log(`OTP: ${otpCode}`);
    console.log('------------------------------');
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

    if (!token || !promotionId) {
      sendJson(res, 400, { error: 'Token y promotionId son requeridos' });
      return;
    }

    const firestore = getFirestoreDb();

    let result = null;
    await firestore.runTransaction(async (tx) => {
      // 1. Fetch promotion
      const promoRef = firestore.collection('promotions').doc(promotionId);
      const promoDoc = await tx.get(promoRef);
      if (!promoDoc.exists) throw new Error('La promoción no existe.');
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
        if (clientSnap.empty) throw new Error('Cliente no encontrado.');
        clientDoc = clientSnap.docs[0];
        clientRef = clientDoc.ref;
      }
      const clientData = clientDoc.data() || {};
      const currentBalance = Number(clientData.totalPoints || 0);

      if (!clientData.email) {
         throw new Error('No tienes un correo registrado para recibir el código de validación.');
      }

      // 3. Verify points
      if (currentBalance < pointsRequired) {
        throw new Error(`Puntos insuficientes. Tienes ${currentBalance} Pts y necesitas ${pointsRequired} Pts.`);
      }

      // 4. Generate OTP and save to client
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiresAt = Date.now() + 1000 * 60 * 10; // 10 minutes

      tx.update(clientRef, {
        promoOtpCode: otpCode,
        promoOtpExpiresAt: otpExpiresAt,
        promoOtpAttempts: 0
      });

      result = { clientEmail: clientData.email, promoTitle: promoData.title, otpCode };
    });

    // Send email asynchronously
    if (result) {
      sendOtpEmail(result.clientEmail, result.otpCode, result.promoTitle).catch(console.error);
    }

    sendJson(res, 200, { ok: true, message: 'OTP enviado' });
  } catch (err) {
    console.error('Request promotion OTP error:', err);
    sendJson(res, 400, { error: err.message || 'Error al solicitar código OTP' });
  }
}
