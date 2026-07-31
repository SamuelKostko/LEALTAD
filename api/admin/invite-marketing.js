import { FieldValue } from 'firebase-admin/firestore';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { verifySession } from '../_lib/adminAuth.js';
import { getFirestoreDb } from '../_lib/firestore.js';
import crypto from 'node:crypto';

function parseCookies(header) {
  const raw = String(header ?? '');
  if (!raw) return {};
  const out = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(val);
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  const cookies = parseCookies(req.headers.cookie);
  const auth = await verifySession(cookies['admin_session']);
  if (!auth.ok) {
    return sendJson(res, 401, { error: 'No autorizado.' });
  }

  const requesterRole = String(auth.data?.role ?? '').trim().toLowerCase() || 'admin';
  // Only admin can invite marketing users
  if (requesterRole !== 'admin' && requesterRole !== 'superadmin') {
    return sendJson(res, 403, { error: 'No autorizado.' });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const name = String(body?.name ?? '').trim();
  const email = String(body?.email ?? '').trim();

  if (!name || !email) {
    return sendJson(res, 400, { error: 'Nombre y correo electrónico son requeridos.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return sendJson(res, 400, { error: 'Formato de correo electrónico inválido.' });
  }

  try {
    const firestore = getFirestoreDb();
    
    // Check if there is already a pending invitation for this email
    const existing = await firestore.collection('marketing_invitations')
      .where('email', '==', email)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
      
    // Generar un token único de 32 bytes (64 caracteres hex)
    const token = crypto.randomBytes(32).toString('hex');
    const origin = req.headers.origin || 'https://vpuntos.app'; // Fallback
    const inviteLink = `${origin}/marketing-setup.html?token=${token}`;

    const ref = firestore.collection('marketing_invitations').doc();
    await ref.set({
      token,
      name,
      email,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      createdBy: auth.adminId
    });

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
          from: {
            email: mailerSendSender,
            name: "Admin V+ Puntos"
          },
          to: [
            {
              email: email
            }
          ],
          subject: "Invitación para administrar Promociones",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
              <h2 style="color: #4f46e5;">¡Hola, ${name}!</h2>
              <p>Has sido invitado para administrar las promociones en la plataforma V+ Puntos.</p>
              <p>Para configurar tus credenciales de acceso, por favor haz clic en el siguiente enlace:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${inviteLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Configurar mi cuenta
                </a>
              </div>
              <p style="font-size: 14px; color: #666;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                <a href="${inviteLink}" style="color: #4f46e5; word-break: break-all;">${inviteLink}</a>
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="font-size: 12px; color: #999;">Este es un mensaje automático, por favor no respondas a este correo.</p>
            </div>
          `
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('MailerSend API error:', response.status, errText);
        // We log the error but still return success to the frontend
      }
    } else {
      console.warn('⚠️ Credenciales de MailerSend no encontradas. No se envió correo.');
      // For testing without API keys, we log the link to console
      console.log('Invite Link:', inviteLink);
    }

    // In case there was an old pending invite, mark it as cancelled (optional, for cleanup)
    if (!existing.empty) {
      const oldDoc = existing.docs[0];
      await oldDoc.ref.update({ status: 'cancelled' });
    }

    return sendJson(res, 200, { ok: true, message: 'Invitación enviada exitosamente.' });
  } catch (error) {
    console.error('Error in invite-marketing handler:', error);
    return sendJson(res, 500, { error: 'Error interno del servidor.' });
  }
}
