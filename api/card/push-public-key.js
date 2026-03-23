import { getPublicVapidKey } from '../_lib/push.js';
import { sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const publicKey = getPublicVapidKey();
  if (!publicKey) {
    sendJson(res, 200, { configured: false, publicKey: '' });
    return;
  }

  sendJson(res, 200, { configured: true, publicKey });
}
