import { readJsonBody, sendJson } from '../_lib/http.js';
import { createAdminSessionCookie, setAdminCookie } from '../_lib/adminAuth.js';
import { getFirestoreDb } from '../_lib/firestore.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const db = getFirestoreDb();
    const adminDoc = await db.collection('config').doc('admin').get();
    
    let expected = '';
    if (adminDoc.exists) {
      expected = String(adminDoc.data()?.password ?? '').trim();
    }
    
    // Fallback to local .env if Firestore config isn't set up yet
    if (!expected) {
      const { getAdminPassword } = await import('../_lib/adminAuth.js');
      expected = getAdminPassword();
    }

    if (!expected) {
      sendJson(res, 500, { error: 'Admin password not set in .env or database.' });
      return;
    }

    const body = await readJsonBody(req);
    const password = String(body?.password ?? '').trim();
    if (!password) {
      sendJson(res, 400, { error: 'Missing password' });
      return;
    }

    // Comparación directa (si prefieres usar hash más adelante, se cambia aquí)
    if (password !== expected) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    let cookieValue = '';
    try {
      cookieValue = createAdminSessionCookie();
    } catch (err) {
      sendJson(res, 500, { error: err?.message ?? String(err) });
      return;
    }
    setAdminCookie(res, cookieValue, req);
    sendJson(res, 200, { ok: true });
  } catch (err) {
    sendJson(res, 500, { error: 'Internal server error' });
  }
}
