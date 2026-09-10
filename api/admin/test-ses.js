import { sendEmailSES } from '../_lib/mailer.js';
import { sendJson, readJsonBody } from '../_lib/http.js';
import { requireAdmin } from '../_lib/adminAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  if (!(await requireAdmin(req, res))) return;

  try {
    const body = await readJsonBody(req);
    const targetEmail = body.to;

    if (!targetEmail) {
      return sendJson(res, 400, { error: 'Falta el campo "to" en el body.' });
    }

    const html = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #06b6d4;">Prueba de Amazon SES</h2>
        <p>Este es un correo de prueba enviado desde tu aplicación usando <b>Nodemailer y Amazon SES (SMTP)</b>.</p>
        <p>Si estás leyendo esto, las credenciales están configuradas correctamente.</p>
        <br>
        <small style="color: #666;">Sistema V+ Puntos</small>
      </div>
    `;

    const info = await sendEmailSES({
      to: targetEmail,
      subject: 'Prueba de Amazon SES - V+ Puntos',
      html,
      text: 'Este es un correo de prueba enviado usando Nodemailer y Amazon SES (SMTP).'
    });

    sendJson(res, 200, { ok: true, message: 'Correo enviado con éxito', info });
  } catch (err) {
    console.error('Test SES Error:', err);
    sendJson(res, 500, { ok: false, error: err.message || 'Error al enviar correo' });
  }
}
