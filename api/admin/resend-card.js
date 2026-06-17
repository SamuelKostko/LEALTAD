import { getFirestoreDb } from '../_lib/firestore.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { requireAdmin, requireStaff } from '../_lib/adminAuth.js';

async function findClientRefByToken(firestore, token) {
  const snap = await firestore.collection('clientes').where('token', '==', token).limit(1).get();
  if (!snap.empty) return snap.docs[0];

  const docRef = firestore.collection('clientes').doc(token);
  const doc = await docRef.get();
  if (doc.exists) return doc;

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  // Any staff member can resend a card
  if (!(await requireStaff(req, res))) return;

  const firestore = getFirestoreDb();

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  const token = String(body?.token ?? '').trim();

  if (!token) {
    sendJson(res, 400, { error: 'Token requerido.' });
    return;
  }

  try {
    const clientDoc = await findClientRefByToken(firestore, token);
    if (!clientDoc) {
      sendJson(res, 404, { error: 'Cliente no encontrado.' });
      return;
    }

    const clientData = clientDoc.data() || {};
    const email = String(clientData.email || '').trim();
    const name = String(clientData.nombre || clientData.name || '').trim();

    if (!email || !email.includes('@')) {
      sendJson(res, 400, { error: 'El cliente no tiene un correo válido registrado.' });
      return;
    }

    const cardLink = `https://vmaspuntos.com/card/${token}`;

    const mailerSendApiKey = process.env.MAILERSEND_API_KEY;
    const mailerSendSender = process.env.MAILERSEND_SENDER_EMAIL || 'no-reply@vmaspuntos.com';

    if (!mailerSendApiKey) {
      sendJson(res, 500, { error: 'MailerSend no está configurado.' });
      return;
    }

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.5;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #4f46e5; margin-bottom: 10px;">¡Hola${name ? ' ' + name : ''}!</h2>
          <p style="font-size: 16px; margin: 0;">Aquí tienes el enlace de acceso rápido a tu Wallet de V+ Puntos.</p>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
          <a href="${cardLink}" style="display: inline-block; background: #4f46e5; color: #fff; text-decoration: none; padding: 14px 28px; font-weight: 600; border-radius: 8px; font-size: 16px;">
            Abrir mi Wallet
          </a>
          <p style="margin-top: 20px; font-size: 14px; color: #64748b;">
            O copia y pega este enlace en tu navegador:<br>
            <a href="${cardLink}" style="color: #4f46e5; word-break: break-all;">${cardLink}</a>
          </p>
        </div>
        
        <p style="font-size: 13px; color: #94a3b8; text-align: center;">
          Guarda este enlace en tus favoritos para acceder rápidamente a tus puntos. Si tienes algún problema, por favor contáctanos.
        </p>
      </div>
    `;

    const response = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Authorization': `Bearer ${mailerSendApiKey}`
      },
      body: JSON.stringify({
        from: { email: mailerSendSender, name: "V+ Puntos" },
        to: [{ email: email }],
        subject: "Tu Tarjeta Digital - V+ Puntos",
        html: htmlContent
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('MailerSend Resend Card Error:', response.status, errorData);
      throw new Error(`Error al enviar correo (status ${response.status}).`);
    }

    sendJson(res, 200, { ok: true, message: 'Correo enviado.' });
  } catch (err) {
    console.error('Resend card error:', err);
    sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
  }
}
