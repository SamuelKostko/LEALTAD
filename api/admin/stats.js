import { requireAdmin } from '../_lib/adminAuth.js';
import { getFirestoreDb } from '../_lib/firestore.js';
import { sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  if (!requireAdmin(req, res)) return;

  const url = new URL(req.url, 'http://localhost');
  const range = String(url.searchParams.get('range') ?? 'all').trim();

  let since = null;
  const now = Date.now();

  if (range === 'day') {
    since = now - 24 * 3600 * 1000;
  } else if (range === 'week') {
    since = now - 7 * 24 * 3600 * 1000;
  } else if (range === 'month') {
    since = now - 30 * 24 * 3600 * 1000;
  } else if (range === 'semester') {
    since = now - 182 * 24 * 3600 * 1000;
  } else if (range === 'year') {
    since = now - 365 * 24 * 3600 * 1000;
  }

  try {
    const firestore = getFirestoreDb();

    // 1. Total users (entire collection count - this is fast for standard collections)
    const totalUsersSnap = await firestore.collection('clientes').get();
    const totalUsers = totalUsersSnap.size;

    // 2. New users (filtered by createdAt)
    let newUsers = 0;
    if (!since) {
      newUsers = totalUsers;
    } else {
      const sinceDate = new Date(since);
      // We use a separate query to allow Firestore to use indexes
      const newUsersSnap = await firestore.collection('clientes')
        .where('createdAt', '>=', sinceDate)
        .get();
      newUsers = newUsersSnap.size;
    }

    // 3. Transactions (filtered by date)
    // We remove the strict 'status == success' from the query because legacy credit transactions
    // might not have the status field yet. We filter in-memory for accuracy.
    let txQuery = firestore.collection('transactions');

    if (since) {
      const sinceDate = new Date(since);
      // We use createdAt for the query as it's the more consistent field across all versions
      txQuery = txQuery.where('createdAt', '>=', sinceDate);
    }

    const txSnap = await txQuery.get();

    let pointsEarned = 0;
    let pointsRedeemed = 0;

    txSnap.forEach(doc => {
      const data = doc.data() || {};
      const pts = Number(data.points) || 0;
      const status = data.status;
      
      // Filter: If status is present, it must be success. If missing, we assume success for legacy credits.
      if (status !== undefined && status !== 'success') return;

      // Mappings based on database types
      if (data.type === 'credit' || data.type === 'purchase_credit' || (!data.type && pts > 0)) {
        pointsEarned += pts;
      } else if (data.type === 'pos_charge' || data.type === 'redeem') {
        pointsRedeemed += pts;
      }
    });

    sendJson(res, 200, {
      totalUsers,
      newUsers,
      pointsEarned,
      pointsRedeemed,
      range
    });

  } catch (err) {
    console.error('Stats error:', err);
    sendJson(res, 500, { error: 'Failed to aggregate statistics' });
  }
}
