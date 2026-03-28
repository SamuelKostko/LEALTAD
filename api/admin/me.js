import { sendJson } from '../_lib/http.js';
import { isAdminRequest } from '../_lib/adminAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const authenticated = await isAdminRequest(req);
  sendJson(res, 200, { ok: true, authenticated });
}
