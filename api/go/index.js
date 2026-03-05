import { sendJson, sendRedirect } from '../_lib/http.js';

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const token = String(url.searchParams.get('token') ?? '').trim();
  if (!token) {
    sendJson(res, 400, { error: 'Missing token' });
    return;
  }

  const location = `/card/${encodeURIComponent(token)}`;
  sendRedirect(res, 302, location);
}
