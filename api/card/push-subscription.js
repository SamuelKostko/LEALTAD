import { readJsonBody, sendJson } from '../_lib/http.js';
import { removePushSubscription, savePushSubscription } from '../_lib/push.js';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const token = String(body?.token ?? '').trim();

    if (!token) {
      sendJson(res, 400, { error: 'Missing token' });
      return;
    }

    if (req.method === 'POST') {
      const subscription = body?.subscription;
      const result = await savePushSubscription({
        token,
        subscription,
        userAgent: req.headers['user-agent']
      });

      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    const endpoint = String(body?.endpoint ?? body?.subscription?.endpoint ?? '').trim();
    if (!endpoint) {
      sendJson(res, 400, { error: 'Missing endpoint' });
      return;
    }

    const result = await removePushSubscription({ token, endpoint });
    sendJson(res, 200, { ok: true, ...result });
  } catch (err) {
    sendJson(res, 400, { error: err?.message ?? 'Invalid JSON body' });
  }
}
