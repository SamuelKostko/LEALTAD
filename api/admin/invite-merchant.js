import { FieldValue } from 'firebase-admin/firestore';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { verifySession } from '../_lib/adminAuth.js';
import { getFirestoreDb } from '../_lib/firestore.js';
import crypto from 'crypto';

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

  const requesterRole = String(auth.data?.role ?? '').trim().toLowerCase();
  if (requesterRole === 'cashier' || requesterRole === 'merchant') {
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
    return sendJson(res, 400, { error: 'Nombre del comercio y correo electrónico son requeridos.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return sendJson(res, 400, { error: 'Formato de correo electrónico inválido.' });
  }

  try {
    const firestore = getFirestoreDb();
    
    // Check if there is already a pending invitation for this email
    const existing = await firestore.collection('merchant_invitations')
      .where('email', '==', email)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
      
    // Generar un token único de 32 bytes (64 caracteres hex)
    const token = crypto.randomBytes(32).toString('hex');
    const origin = req.headers.origin || 'https://vpuntos.app'; // Fallback to your domain if origin is undefined
    const inviteLink = `${origin}/merchant-setup.html?token=${token}`;

    const ref = firestore.collection('merchant_invitations').doc();
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
          subject: "Invitación para Registrar Comercio",
          html: `<h3>Hola, ${name}</h3>
                 <p>Has sido invitado a registrar tu comercio en el sistema de V+ Puntos.</p>
                 <p>Por favor, haz clic en el siguiente enlace para completar tu registro y crear tus credenciales de acceso:</p>
                 <a href="${inviteLink}" style="background-color: #0ea5e9; color: white; padding: 12px 20px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 15px 0; font-weight: bold;">Completar Registro</a>
                 <p>Si el botón no funciona, puedes copiar y pegar el siguiente enlace en tu navegador:</p>
                 <p><a href="${inviteLink}">${inviteLink}</a></p>
                 <p>Si no esperabas este correo, puedes ignorarlo.</p>`
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('MailerSend Error:', response.status, errorData);
        return sendJson(res, 500, {
          error: `Error al enviar correo vía MailerSend (${response.status}). La invitación se creó pero no se pudo enviar el correo.`
        });
      }
    } else {
      const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
      if (isProduction) {
        return sendJson(res, 500, {
          error: 'Faltan variables MAILERSEND_API_KEY o MAILERSEND_SENDER_EMAIL en el servidor.'
        });
      }

      console.warn('MailerSend variables not fully defined, simulating email send in dev mode:', inviteLink);
      // We still return success but notify it was dev mode
      return sendJson(res, 200, { ok: true, devMode: true, inviteLink });
    }

    sendJson(res, 200, { ok: true, message: 'Invitación enviada con éxito.' });
  } catch (err) {
    console.error('Invite Merchant Error:', err);
    sendJson(res, 500, { error: 'Error interno del servidor.' });
  }
}
