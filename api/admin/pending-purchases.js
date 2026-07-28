import { getFirestoreDb } from '../_lib/firestore.js';
import { requireAdmin } from '../_lib/adminAuth.js';
import { sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  const user = await requireAdmin(req);
  if (!user) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  try {
    const db = await getFirestoreDb();
    // For simplicity, we just fetch all pending purchases
    const snapshot = await db.collection('pending_purchases')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .get();

    const pending = [];
    snapshot.forEach(doc => {
      pending.push({ id: doc.id, ...doc.data() });
    });

    return sendJson(res, 200, { pending });
  } catch (error) {
    console.error('Error fetching pending purchases:', error);
    // Fallback if index is missing for orderBy
    try {
      const db = await getFirestoreDb();
      const snapshot = await db.collection('pending_purchases')
        .where('status', '==', 'pending')
        .get();
      
      const pending = [];
      snapshot.forEach(doc => {
        pending.push({ id: doc.id, ...doc.data() });
      });
      // Sort manually
      pending.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return sendJson(res, 200, { pending });
    } catch (fallbackError) {
      console.error('Fallback error:', fallbackError);
      return sendJson(res, 500, { error: 'Error fetching data' });
    }
  }
}
