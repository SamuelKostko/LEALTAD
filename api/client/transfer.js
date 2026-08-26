import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreDb } from '../_lib/firestore.js';
import { readJsonBody, sendJson } from '../_lib/http.js';

const sendTransferEmail = async (toEmail, subject, html) => {
  const mailerSendApiKey = process.env.MAILERSEND_API_KEY;
  const mailerSendSender = process.env.MAILERSEND_SENDER_EMAIL;

  if (!mailerSendApiKey || !mailerSendSender) {
    console.log('--- SIMULADOR DE ENVÍO DE CORREO ---');
    console.log(`To: ${toEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(`HTML: ${html}`);
    console.log('------------------------------------');
    return;
  }

  try {
    await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mailerSendApiKey}`
      },
      body: JSON.stringify({
        from: { email: mailerSendSender, name: 'V+ Puntos' },
        to: [{ email: toEmail }],
        subject,
        html
      })
    });
  } catch (err) {
    console.error(`Error enviando email a ${toEmail}:`, err);
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const { action, token, email, amount, otp } = body;
    const firestore = getFirestoreDb();

    if (!action) {
      sendJson(res, 400, { error: 'Action is required' });
      return;
    }

    if (action === 'verify_email') {
      if (!email) {
        sendJson(res, 400, { error: 'Email is required' });
        return;
      }
      const lowerEmail = email.toLowerCase().trim();
      const snap = await firestore.collection('clientes').where('email', '==', lowerEmail).limit(1).get();
      if (snap.empty) {
        sendJson(res, 404, { error: 'Usuario no encontrado con ese correo.' });
        return;
      }
      const userData = snap.docs[0].data();
      sendJson(res, 200, { name: userData.nombre });
      return;
    }

    if (action === 'request_otp') {
      if (!token || !email || !amount) {
        sendJson(res, 400, { error: 'Faltan datos para la transferencia (token, email, monto)' });
        return;
      }
      
      const transferAmount = Number(amount);
      if (transferAmount < 1) {
        sendJson(res, 400, { error: 'El monto a transferir debe ser al menos 1 punto.' });
        return;
      }

      // Check sender balance
      let senderSnap = await firestore.collection('clientes').doc(token).get();
      if (!senderSnap.exists) {
        const senderQuery = await firestore.collection('clientes').where('token', '==', token).limit(1).get();
        if (senderQuery.empty) {
          sendJson(res, 404, { error: 'Usuario origen no encontrado.' });
          return;
        }
        senderSnap = senderQuery.docs[0];
      }
      const senderData = senderSnap.data();
      const senderBalance = Number(senderData.totalPoints || 0);

      if (senderBalance < transferAmount) {
        sendJson(res, 400, { error: 'Saldo insuficiente para realizar esta transferencia.' });
        return;
      }

      // Verify recipient exists
      const lowerEmail = email.toLowerCase().trim();
      if (senderData.email && senderData.email.toLowerCase() === lowerEmail) {
        sendJson(res, 400, { error: 'No puedes transferir puntos a ti mismo.' });
        return;
      }

      const recipientSnap = await firestore.collection('clientes').where('email', '==', lowerEmail).limit(1).get();
      if (recipientSnap.empty) {
        sendJson(res, 404, { error: 'Usuario destino no encontrado.' });
        return;
      }

      // Generate OTP
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpRef = firestore.collection('transfer_otps').doc(token);
      
      await otpRef.set({
        otp: generatedOtp,
        createdAt: Date.now(),
        email: lowerEmail,
        amount: transferAmount
      });

      // Send email to sender
      const senderEmail = senderData.email;
      if (senderEmail) {
        const subject = `Código de seguridad - Transferencia V+ Puntos`;
        const html = `
        <!DOCTYPE html>
        <html lang="es">
        <body style="margin: 0; padding: 20px; font-family: sans-serif; background-color: #0d0f12; color: #fff;">
          <div style="max-width: 600px; margin: 0 auto; background: #161920; border-radius: 12px; padding: 20px; border: 1px solid #2d3748;">
            <h2 style="color: #06b6d4; margin-top: 0;">Código de Confirmación</h2>
            <p>Hola <strong>${senderData.nombre}</strong>,</p>
            <p>Has solicitado transferir <strong>${transferAmount} puntos</strong> al correo <strong>${lowerEmail}</strong>.</p>
            <p>Ingresa el siguiente código de 6 dígitos para confirmar la operación:</p>
            <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <h1 style="margin: 0; color: #fff; letter-spacing: 4px;">${generatedOtp}</h1>
            </div>
            <p style="color: #a0aec0; font-size: 13px;">Si no has solicitado esta transferencia, ignora este correo.</p>
          </div>
        </body>
        </html>
        `;
        await sendTransferEmail(senderEmail, subject, html);
      }

      sendJson(res, 200, { success: true, message: 'OTP enviado al correo asociado a tu cuenta.' });
      return;
    }

    if (action === 'confirm') {
      if (!token || !otp) {
        sendJson(res, 400, { error: 'Token y OTP son requeridos.' });
        return;
      }

      const otpRef = firestore.collection('transfer_otps').doc(token);
      
      const result = await firestore.runTransaction(async (tx) => {
        const otpSnap = await tx.get(otpRef);
        if (!otpSnap.exists) {
          throw new Error('No hay una solicitud de transferencia pendiente.');
        }
        
        const otpData = otpSnap.data();
        if (otpData.otp !== otp) {
          throw new Error('El código OTP es incorrecto.');
        }

        const expiry = 10 * 60 * 1000; // 10 minutes
        if (Date.now() - otpData.createdAt > expiry) {
          throw new Error('El código OTP ha expirado.');
        }

        const transferAmount = Number(otpData.amount);
        const lowerEmail = otpData.email;

        // Fetch sender
        let senderRef = firestore.collection('clientes').doc(token);
        let senderSnap = await tx.get(senderRef);
        if (!senderSnap.exists) {
          const senderQuery = await tx.get(firestore.collection('clientes').where('token', '==', token).limit(1));
          if (senderQuery.empty) throw new Error('Usuario origen no encontrado.');
          senderSnap = senderQuery.docs[0];
          senderRef = senderSnap.ref;
        }
        const senderData = senderSnap.data();
        
        if (Number(senderData.totalPoints || 0) < transferAmount) {
          throw new Error('Saldo insuficiente.');
        }

        // Fetch recipient
        const recipientQuery = await tx.get(firestore.collection('clientes').where('email', '==', lowerEmail).limit(1));
        if (recipientQuery.empty) throw new Error('Usuario destino no encontrado.');
        const recipientSnap = recipientQuery.docs[0];
        const recipientRef = recipientSnap.ref;
        const recipientData = recipientSnap.data();

        // Perform transfer
        tx.update(senderRef, {
          totalPoints: FieldValue.increment(-transferAmount)
        });

        tx.update(recipientRef, {
          totalPoints: FieldValue.increment(transferAmount)
        });

        // Generate reference number
        const refNumber = `${Math.floor(1000000 + Math.random() * 9000000)}`;

        // Record transactions
        const senderTxRef = firestore.collection('transactions').doc();
        tx.set(senderTxRef, {
          type: 'transfer_out',
          token: senderData.token,
          amount: transferAmount,
          points: transferAmount,
          recipientEmail: lowerEmail,
          recipientName: recipientData.nombre,
          createdAt: new Date().toISOString(),
          processedAt: new Date().toISOString(),
          description: `Envío a ${recipientData.nombre}`,
          reference: refNumber
        });

        const recipientTxRef = firestore.collection('transactions').doc();
        tx.set(recipientTxRef, {
          type: 'transfer_in',
          token: recipientData.token,
          amount: transferAmount,
          points: transferAmount,
          senderName: senderData.nombre,
          createdAt: new Date().toISOString(),
          processedAt: new Date().toISOString(),
          description: `Recibido de ${senderData.nombre}`,
          reference: refNumber
        });

        // Delete OTP
        tx.delete(otpRef);

        return { transferAmount, recipientName: recipientData.nombre, reference: refNumber };
      });

      sendJson(res, 200, { success: true, ...result });
      return;
    }

    sendJson(res, 400, { error: 'Acción no válida' });
  } catch (error) {
    console.error('Error in transfer:', error);
    sendJson(res, 500, { error: error.message || 'Error interno del servidor' });
  }
}
