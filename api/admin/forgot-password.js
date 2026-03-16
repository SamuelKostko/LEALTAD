import { readJsonBody, sendJson } from '../_lib/http.js';
import { getFirestoreDb } from '../_lib/firestore.js';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const db = getFirestoreDb();
    const adminRef = db.collection('config').doc('admin');
    const adminDoc = await adminRef.get();

    if (!adminDoc.exists) {
      return sendJson(res, 500, { error: 'Settings not configured' });
    }

    const body = await readJsonBody(req);
    const inputEmail = String(body?.email ?? '').trim();

    const data = adminDoc.data();
    const adminEmail = String(data.email ?? '').trim();

    // Verificación de seguridad
    if (!inputEmail || inputEmail.toLowerCase() !== adminEmail.toLowerCase()) {
      return sendJson(res, 400, { error: 'El correo ingresado no coincide con el registrado.' });
    }

    // Generar Token numérico de 6 dígitos
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetTokenExpires = Date.now() + 1000 * 60 * 15; // 15 Minutos de validez
    
    await adminRef.update({
      resetToken: resetCode,
      resetTokenExpires
    });

    let transporter;
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL } = process.env;
    const smtpPort = Number(SMTP_PORT);

    if (SMTP_HOST && SMTP_USER && SMTP_PASS && Number.isFinite(smtpPort) && smtpPort > 0) {
        transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000
        });

        await transporter.sendMail({
            from: `"Admin Panel" <${SMTP_FROM_EMAIL || SMTP_USER}>`,
            to: adminEmail,
            subject: 'Código de Recuperación',
            html: `<h3>Tu código de recuperación es:</h3>
                   <div style="font-size: 24px; font-weight: bold; background: #f4f4f4; padding: 10px; display: inline-block; letter-spacing: 2px;">${resetCode}</div>
                   <p>Este código expira en 15 minutos. Si no lo solicitaste, puedes ignorar este mensaje.</p>`
        });
    } else {
        const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
        if (isProduction) {
          return sendJson(res, 500, {
            error: 'SMTP no configurado correctamente. Revisa SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS.'
          });
        }

        console.warn('SMTP variables not fully defined, just printing code', resetCode);
        return sendJson(res, 200, { ok: true, devMode: true, resetCode });
    }

    sendJson(res, 200, { ok: true });
  } catch (err) {
    const rawMessage = String(err?.message || 'Internal error');
    const code = String(err?.code || '').toUpperCase();
    const command = String(err?.command || '');
    const isTimeout =
      code.includes('TIMEOUT') ||
      code === 'ESOCKET' ||
      /timeout|timed out/i.test(rawMessage);

    if (isTimeout) {
      const host = String(process.env.SMTP_HOST || '');
      const port = String(process.env.SMTP_PORT || '');
      return sendJson(res, 500, {
        error: `SMTP connection timeout (${host}:${port}). Revisa host/puerto, firewall de Railway y usa 587 o 2525 si 465 no responde.`,
        code: code || undefined,
        command: command || undefined
      });
    }

    sendJson(res, 500, { error: rawMessage });
  }
}