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

    if (SMTP_HOST && SMTP_USER) {
        transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: Number(SMTP_PORT),
            secure: Number(SMTP_PORT) === 465, 
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS
            }
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
        console.warn('SMTP variables not fully defined, just printing code', resetCode);
        return sendJson(res, 200, { ok: true, devMode: true, resetCode }); 
    }

    sendJson(res, 200, { ok: true });
  } catch (err) {
    sendJson(res, 500, { error: err.message || 'Internal error' });
  }
}