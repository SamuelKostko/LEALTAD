import { sendJson } from '../_lib/http.js';
import { destroySession, clearSessionCookie } from '../_lib/adminAuth.js';

export default async function handler(req, res) {
  // Accept both GET and POST for maximum compatibility
  if (req.method !== 'POST' && req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  // Destroy session in Firestore
  await destroySession();

  // Clear cookie
  clearSessionCookie(res, req);

  sendJson(res, 200, { ok: true });
}
