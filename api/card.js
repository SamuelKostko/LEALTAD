import { getFirestoreDb } from './_lib/firestore.js';
import { sendJson } from './_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const token = String(url.searchParams.get('token') ?? '').trim();
  if (!token) {
    sendJson(res, 400, { error: 'Missing token' });
    return;
  }

  try {
    const snap = await getFirestoreDb().collection('cards').doc(token).get();
    if (!snap.exists) {
      sendJson(res, 404, { error: 'Not Found' });
      return;
    }

    sendJson(res, 200, { token, ...snap.data() });
  } catch (err) {
    sendJson(res, 500, { error: err?.message ?? String(err) });
  }
}
