import { sendJson } from '../_lib/http.js';
import { clearAdminCookie } from '../_lib/adminAuth.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  clearAdminCookie(res, req);
  sendJson(res, 200, { ok: true });
}
