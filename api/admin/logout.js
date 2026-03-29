import { sendJson } from '../_lib/http.js';
import { destroySession, clearSessionCookie } from '../_lib/adminAuth.js';

export default async function handler(req, res) {
  // Accept both GET and POST for maximum compatibility
  if (req.method !== 'POST' && req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  // Destroy session in Firestore if cookie exists
  const cookieHeader = req.headers.cookie || '';
  const sessionId = cookieHeader.split(';').find(c => c.trim().startsWith('admin_session='))?.split('=')[1];
  if (sessionId) {
    await destroySession(decodeURIComponent(sessionId));
  }

  // Clear cookie
  clearSessionCookie(res, req);

  sendJson(res, 200, { ok: true });
}
