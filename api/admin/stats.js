import { requireAdmin } from '../_lib/adminAuth.js';
import { getFirestoreDb } from '../_lib/firestore.js';
import { sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  if (!(await requireAdmin(req, res))) return;

  const url = new URL(req.url, 'http://localhost');
  const range = String(url.searchParams.get('range') ?? 'all').trim();

  let since = null;
  const now = new Date();

  // Helper to get the start of the day in Venezuela time (GMT-4)
  const getVzlaToday = () => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(now);
    const d = {};
    parts.forEach(p => d[p.type] = p.value);
    // Construct ISO string for 00:00:00 in Caracas
    return new Date(`${d.year}-${d.month}-${d.day}T00:00:00-04:00`);
  };

  const vzlaToday = getVzlaToday().getTime();

  if (range === 'day') {
    since = vzlaToday;
  } else if (range === 'week') {
    since = vzlaToday - 6 * 24 * 3600 * 1000;
  } else if (range === 'month') {
    since = vzlaToday - 29 * 24 * 3600 * 1000;
  } else if (range === 'semester') {
    since = vzlaToday - 181 * 24 * 3600 * 1000;
  } else if (range === 'year') {
    since = vzlaToday - 364 * 24 * 3600 * 1000;
  }

  try {
    const firestore = getFirestoreDb();

    // 1. Total users (entire collection count)
    const totalUsersSnap = await firestore.collection('clientes').get();
    const totalUsers = totalUsersSnap.size;

    // Group clients by branch (only those registered in the period)
    const clientsByBranch = {};
    const start = since ? new Date(since) : null;
    
    totalUsersSnap.forEach(doc => {
      const c = doc.data() || {};
      const createdAt = c.createdAt ? (c.createdAt.toDate ? c.createdAt.toDate() : new Date(c.createdAt)) : null;
      
      // Filter by date if 'since' is provided
      if (start && (!createdAt || createdAt < start)) return;

      const branch = (typeof c.sedes === 'string' && c.sedes.trim() !== '') 
        ? c.sedes.trim() 
        : (typeof c.sede === 'string' && c.sede.trim() !== '') 
          ? c.sede.trim() 
          : 'Sin sede';
      clientsByBranch[branch] = (clientsByBranch[branch] || 0) + 1;
    });

    // 2. New users (filtered by createdAt)
    let newUsers = 0;
    if (!since) {
      newUsers = totalUsers;
    } else {
      const sinceDate = new Date(since);
      const newUsersSnap = await firestore.collection('clientes')
        .where('createdAt', '>=', sinceDate)
        .get();
      newUsers = newUsersSnap.size;
    }

    // 3. Transactions (filtered by date)
    let txQuery = firestore.collection('transactions');

    if (since) {
      const sinceDate = new Date(since);
      txQuery = txQuery.where('createdAt', '>=', sinceDate);
    }

    const txSnap = await txQuery.get();

    let pointsEarned = 0;
    let pointsRedeemed = 0;
    const earnedByBranch = {};
    const redeemedByBranch = {};

    txSnap.forEach(doc => {
      const data = doc.data() || {};
      const pts = Number(data.points) || 0;
      const status = data.status;
      const branchName = typeof data.branchName === 'string' && data.branchName.trim() !== '' ? data.branchName.trim() : 'Sin sede';
      
      if (status !== undefined && status !== 'success') return;

      if (data.type === 'credit' || data.type === 'purchase_credit' || (!data.type && pts > 0)) {
        pointsEarned += pts;
        earnedByBranch[branchName] = (earnedByBranch[branchName] || 0) + pts;
      } else if (data.type === 'pos_charge' || data.type === 'redeem') {
        pointsRedeemed += pts;
        redeemedByBranch[branchName] = (redeemedByBranch[branchName] || 0) + pts;
      }
    });

    sendJson(res, 200, {
      totalUsers,
      newUsers,
      pointsEarned,
      pointsRedeemed,
      earnedByBranch,
      redeemedByBranch,
      clientsByBranch,
      range
    });

  } catch (err) {
    console.error('Stats error:', err);
    sendJson(res, 500, { error: 'Failed to aggregate statistics' });
  }
}
