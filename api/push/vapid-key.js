import { sendJson } from '../_lib/http.js';
import { getVapidPublicKey, isPushConfigured } from '../_lib/push.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
  }

  return sendJson(res, 200, {
    ok: true,
    configured: isPushConfigured(),
    publicKey: getVapidPublicKey()
  });
}

