import { readJsonBody, sendJson } from '../_lib/http.js';
import { getFirestoreDb } from '../_lib/firestore.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const db = getFirestoreDb();
    const adminDoc = await db.collection('config').doc('admin').get();

    if (!adminDoc.exists) {
      return sendJson(res, 500, { error: 'Settings not configured' });
    }

    const body = await readJsonBody(req);
    const code = String(body?.code ?? '').trim();

    if (!code) {
      return sendJson(res, 400, { error: 'Código requerido.' });
    }

    const data = adminDoc.data();
    
    if (!data.resetToken || data.resetToken !== code) {
      return sendJson(res, 403, { error: 'El código es inválido.' });
    }

    if (!data.resetTokenExpires || Date.now() > data.resetTokenExpires) {
      return sendJson(res, 403, { error: 'El código expiró. Solicita uno nuevo.' });
    }

    return sendJson(res, 200, { ok: true });
  } catch (err) {
    return sendJson(res, 500, { error: err.message || 'Error interno.' });
  }
}