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
    const code = String(body?.code ?? '').trim();
    const newPassword = String(body?.newPassword ?? '').trim();

    if (!code || !newPassword) {
      return sendJson(res, 400, { error: 'Código y nueva contraseña son requeridos' });
    }

    const data = adminDoc.data();
    
    // Validate Code again as extra security before writing
    if (!data.resetToken || data.resetToken !== code) {
      return sendJson(res, 403, { error: 'El código es inválido.' });
    }

    // Validate Expiration
    if (!data.resetTokenExpires || Date.now() > data.resetTokenExpires) {
      return sendJson(res, 403, { error: 'El código expiró. Solicita uno nuevo.' });
    }

    // Update password
    await adminRef.update({
      password: newPassword,
      resetToken: null,
      resetTokenExpires: null
    });

    sendJson(res, 200, { ok: true });
  } catch (err) {
    sendJson(res, 500, { error: err.message || 'Error interno al actualizar la contraseña.' });
  }
}