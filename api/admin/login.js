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
    const email = String(body?.email ?? '').trim().toLowerCase();
    const password = String(body?.password ?? '').trim();

    if (!email || !password) {
      sendJson(res, 400, { error: 'Correo y contraseña son requeridos.' });
      return;
    }

    const db = getFirestoreDb();
    const adminDoc = await db.collection('config').doc('admin').get();

    if (!adminDoc.exists) {
      sendJson(res, 500, { error: 'Configuración de admin no encontrada.' });
      return;
    }

    const data = adminDoc.data();
    const adminEmail = String(data?.email ?? '').trim().toLowerCase();
    const adminPassword = String(data?.password ?? '').trim();

    // Fallback to .env if no password in Firestore
    const expectedPassword = adminPassword || String(process.env.ADMIN_PASSWORD ?? '').trim();

    if (!adminEmail || !expectedPassword) {
      sendJson(res, 500, { error: 'Admin no configurado en la base de datos.' });
      return;
    }

    // Validate email
    if (email !== adminEmail) {
      sendJson(res, 403, { error: 'Credenciales incorrectas.' });
      return;
    }

    // Validate password
    if (password !== expectedPassword) {
      sendJson(res, 403, { error: 'Credenciales incorrectas.' });
      return;
    }

    // Create session in Firestore
    const { sessionId } = await createSession();

    // Set cookie
    setSessionCookie(res, sessionId, req);

    sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error('Login error:', err);
    sendJson(res, 500, { error: 'Error interno del servidor.' });
  }
}
