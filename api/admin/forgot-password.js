import { readJsonBody, sendJson } from '../_lib/http.js';
import { getFirestoreDb } from '../_lib/firestore.js';
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
            name: "Admin Panel NEXUS"
          },
          to: [
            {
              email: adminEmail
            }
          ],
          subject: "Código de Recuperación",
          html: `<h3>Tu código de recuperación es:</h3>
                 <div style="font-size: 24px; font-weight: bold; background: #e0f2fe; color: #0369a1; padding: 12px 20px; border-radius: 8px; display: inline-block; letter-spacing: 4px; margin: 10px 0;">${resetCode}</div>
                 <p style="color: #4b5563; margin-top: 15px;">Este código expira en 15 minutos. Si no lo solicitaste, puedes ignorar este mensaje de seguridad.</p>`
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('MailerSend Error:', response.status, errorData);
        return sendJson(res, 500, {
          error: `Error de MailerSend (${response.status}). Revisa que tu Sender Email esté verificado y la API key sea correcta.`
        });
      }
    } else {
        const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
        if (isProduction) {
          return sendJson(res, 500, {
            error: 'Faltan variables MAILERSEND_API_KEY o MAILERSEND_SENDER_EMAIL en el servidor.'
          });
        }
        
        console.warn('MailerSend variables not fully defined, simulating email send in dev mode:', resetCode);
        return sendJson(res, 200, { ok: true, devMode: true, resetCode });
    }

    sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error('Forgot Pass Error:', err);
    sendJson(res, 500, { error: 'Error interno de red.' });
  }
}