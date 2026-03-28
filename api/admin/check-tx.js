import { sendJson } from '../_lib/http.js';
import { requireAdmin } from '../_lib/adminAuth.js';
import { getFirestoreDb } from '../_lib/firestore.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  if (!(await requireAdmin(req, res))) return;

  const id = String(req.query.id ?? '').trim();
  if (!id) {
    sendJson(res, 400, { error: 'Transaction ID required' });
    return;
  }

  try {
    const firestore = getFirestoreDb();
    const doc = await firestore.collection('transactions').doc(id).get();

    if (!doc.exists) {
      sendJson(res, 404, { error: 'Transaction not found' });
      return;
    }

    const data = doc.data() || {};
    sendJson(res, 200, { 
      status: data.status,
      points: data.points,
      amount: data.amount
    });
  } catch (err) {
    sendJson(res, 500, { error: 'Internal server error' });
  }
}
