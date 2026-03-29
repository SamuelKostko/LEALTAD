import { readJsonBody, sendJson } from '../_lib/http.js';
import { getFirestoreDb } from '../_lib/firestore.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const db = getFirestoreDb();
    const body = await readJsonBody(req);
    const code = String(body?.code ?? '').trim();
    const newPassword = String(body?.newPassword ?? '').trim();

    if (!code || !newPassword) {
      return sendJson(res, 400, { error: 'Código y nueva contraseña son requeridos' });
    }

    // Search for any document in 'config' with this resetToken
    const snap = await db.collection('config').where('resetToken', '==', code).limit(1).get();

    if (snap.empty) {
      return sendJson(res, 403, { error: 'El código es inválido.' });
    }

    const adminDoc = snap.docs[0];
    const data = adminDoc.data();
    const adminRef = adminDoc.ref;

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