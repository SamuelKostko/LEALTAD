import { FieldValue } from 'firebase-admin/firestore';
import { readJsonBody, sendJson } from './_lib/http.js';
import { getFirestoreDb } from './_lib/firestore.js';

function normalizeUsername(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function isValidUsername(username) {
  return /^[a-z0-9_]{3,30}$/.test(username);
}

export default async function handler(req, res) {
  const firestore = getFirestoreDb();

  if (req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const token = url.searchParams.get('token');

    if (!token) {
      return sendJson(res, 400, { error: 'Token es requerido.' });
    }

    try {
      const snap = await firestore.collection('merchant_invitations')
        .where('token', '==', token)
        .where('status', '==', 'pending')
        .limit(1)
        .get();

      if (snap.empty) {
        return sendJson(res, 404, { error: 'Invitación no válida, expirada o ya utilizada.' });
      }

      const invite = snap.docs[0].data();
      return sendJson(res, 200, { 
        ok: true, 
        name: invite.name, 
        email: invite.email 
      });
    } catch (err) {
      console.error('Error fetching invitation:', err);
      return sendJson(res, 500, { error: 'Error interno del servidor.' });
    }
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON body' });
    }

    const { action, token } = body;

    if (!token) {
      return sendJson(res, 400, { error: 'Token de invitación requerido.' });
    }

    try {
      const snap = await firestore.collection('merchant_invitations')
        .where('token', '==', token)
        .where('status', '==', 'pending')
        .limit(1)
        .get();

      if (snap.empty) {
        return sendJson(res, 404, { error: 'Invitación no válida, expirada o ya utilizada.' });
      }

      const inviteDoc = snap.docs[0];
      const inviteData = inviteDoc.data();
      const inviteRef = inviteDoc.ref;

      if (action === 'request_otp') {
        const { username, password, branchName } = body;
        
        const normUsername = normalizeUsername(username);
        const normPassword = String(password ?? '').trim();
        const normBranch = String(branchName ?? '').trim();

        if (!normUsername || !normPassword || !normBranch) {
          return sendJson(res, 400, { error: 'Usuario, contraseña y sede son requeridos.' });
        }

        if (!isValidUsername(normUsername)) {
          return sendJson(res, 400, { error: 'Usuario inválido (3-30 caracteres, minúsculas, números o guion bajo).' });
        }

        if (normPassword.length < 6) {
          return sendJson(res, 400, { error: 'La contraseña debe tener al menos 6 caracteres.' });
        }

        // Check if username is already taken
        const existingCashier = await firestore.collection('cashiers').where('username', '==', normUsername).limit(1).get();
        if (!existingCashier.empty) {
          return sendJson(res, 409, { error: 'Ya existe un usuario con ese nombre de usuario.' });
        }

        const existingMerchant = await firestore.collection('merchants').where('username', '==', normUsername).limit(1).get();
        if (!existingMerchant.empty) {
          return sendJson(res, 409, { error: 'Ya existe un usuario con ese nombre de usuario.' });
        }

        // Generate OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiresAt = Date.now() + 1000 * 60 * 15; // 15 Minutos

        await inviteRef.update({
          otpCode,
          otpExpiresAt,
          pendingData: {
            username: normUsername,
            password: normPassword, // En texto plano por el momento, según la lógica existente
            branchName: normBranch
          }
        });

        // Send OTP email
        const mailerSendApiKey = process.env.MAILERSEND_API_KEY;
        const mailerSendSender = process.env.MAILERSEND_SENDER_EMAIL;

        if (mailerSendApiKey && mailerSendSender) {
          const response = await fetch('https://api.mailersend.com/v1/email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${mailerSendApiKey}`
            },
            body: JSON.stringify({
              from: { email: mailerSendSender, name: "Admin V+ Puntos" },
              to: [{ email: inviteData.email }],
              subject: "Código de Verificación - Registro de Comercio",
              html: `<h3>Código de Verificación</h3>
                     <p>Estás a un paso de completar el registro de <strong>${inviteData.name}</strong>.</p>
                     <p>Tu código de verificación de un solo uso (OTP) es:</p>
                     <div style="font-size: 24px; font-weight: bold; background: #e0f2fe; color: #0369a1; padding: 12px 20px; border-radius: 8px; display: inline-block; letter-spacing: 4px; margin: 10px 0;">${otpCode}</div>
                     <p style="color: #4b5563; margin-top: 15px;">Este código expira en 15 minutos.</p>`
            })
          });

          if (!response.ok) {
            console.error('MailerSend OTP Error:', response.status);
            return sendJson(res, 500, { error: 'Error al enviar el código por correo electrónico.' });
          }
        } else {
          console.warn('MailerSend variables missing, devMode OTP:', otpCode);
        }

        return sendJson(res, 200, { ok: true, message: 'OTP enviado con éxito.' });
      }

      if (action === 'verify_otp') {
        const { otp } = body;
        const submittedOtp = String(otp ?? '').trim();

        if (!submittedOtp) {
          return sendJson(res, 400, { error: 'El código OTP es requerido.' });
        }

        if (inviteData.otpCode !== submittedOtp) {
          return sendJson(res, 400, { error: 'El código OTP es incorrecto.' });
        }

        if (Date.now() > (inviteData.otpExpiresAt || 0)) {
          return sendJson(res, 400, { error: 'El código OTP ha expirado. Por favor, solicita uno nuevo.' });
        }

        const pendingData = inviteData.pendingData;
        if (!pendingData) {
          return sendJson(res, 500, { error: 'Datos pendientes no encontrados.' });
        }

        // Crear el merchant final en Firestore
        const newMerchantRef = firestore.collection('merchants').doc();
        await newMerchantRef.set({
          username: pendingData.username,
          password: pendingData.password,
          role: 'merchant',
          name: inviteData.name,
          branchName: pendingData.branchName,
          settings: {
            pointsPerDollar: 100,
            minRedeemPoints: 0,
            isClosed: true // Por defecto true para el área de merchants
          },
          sessionId: null,
          sessionCreatedAt: null,
          sessionExpiresAt: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          createdBy: inviteData.createdBy // Guardar el admin que lo invitó
        });

        // Marcar invitación como usada
        await inviteRef.update({
          status: 'used',
          usedAt: FieldValue.serverTimestamp()
        });

        return sendJson(res, 200, { ok: true, message: 'Comercio creado con éxito.' });
      }

      return sendJson(res, 400, { error: 'Acción no válida.' });

    } catch (err) {
      console.error('Merchant Setup Error:', err);
      return sendJson(res, 500, { error: 'Error interno del servidor.' });
    }
  }

  sendJson(res, 405, { error: 'Method Not Allowed' });
}
