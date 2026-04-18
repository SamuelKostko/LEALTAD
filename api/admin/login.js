import { readJsonBody, sendJson } from '../_lib/http.js';
import { createSession, setSessionCookie } from '../_lib/adminAuth.js';
import { getFirestoreDb } from '../_lib/firestore.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const identifier = String(body?.username || body?.email || '').trim().toLowerCase();
    const password = String(body?.password ?? '').trim();

    if (!identifier || !password) {
      sendJson(res, 400, { error: 'Usuario y contraseña son requeridos.' });
      return;
    }

    const db = getFirestoreDb();

    // First try email in 'config'
    let snap = await db.collection('config').where('email', '==', identifier).limit(1).get();
    let collection = 'config';

    // If not found, try username in 'cashiers'
    if (snap.empty) {
      snap = await db.collection('cashiers').where('username', '==', identifier).limit(1).get();
      collection = 'cashiers';
    }

    if (snap.empty) {
      sendJson(res, 403, { error: 'Credenciales incorrectas.' });
      return;
    }

    const userDoc = snap.docs[0];
    const data = userDoc.data();
    const userPassword = String(data?.password ?? '').trim();

    // Fallback to .env only for the main 'config' collection (admins)
    let expectedPassword = userPassword;
    if (collection === 'config' && !expectedPassword) {
      expectedPassword = String(process.env.ADMIN_PASSWORD ?? '').trim();
    }

    if (!expectedPassword) {
      sendJson(res, 500, { error: 'Usuario no configurado correctamente.' });
      return;
    }

    // Validate password
    if (password !== expectedPassword) {
      sendJson(res, 403, { error: 'Credenciales incorrectas.' });
      return;
    }

    // Create session in Firestore for this specific document in the correct collection
    const { sessionId } = await createSession(userDoc.id, collection);

    // Set cookie
    setSessionCookie(res, sessionId, req);

    sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error('Login error:', err);
    sendJson(res, 500, { error: 'Error interno del servidor.' });
  }
}
