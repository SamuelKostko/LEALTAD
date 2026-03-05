import { readJsonBody, sendJson } from '../_lib/http.js';
import { createAdminSessionCookie, getAdminPassword, setAdminCookie } from '../_lib/adminAuth.js';
import { timingSafeEqualString } from '../_lib/utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const expected = getAdminPassword();
  if (!expected) {
    sendJson(res, 500, { error: 'ADMIN_PASSWORD (or ADMIN_KEY) not set on server' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const password = String(body?.password ?? '').trim();
    if (!password) {
      sendJson(res, 400, { error: 'Missing password' });
      return;
    }

    if (!timingSafeEqualString(password, expected)) {
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
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
  }
}
