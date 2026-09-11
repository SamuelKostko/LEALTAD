import { getFirestoreDb } from '../_lib/firestore.js';
import { requireAdmin } from '../_lib/adminAuth.js';
import { sendJson } from '../_lib/http.js';

function toIso(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val?.toDate === 'function') {
    try {
      return val.toDate().toISOString();
    } catch {
      return '';
    }
  }
  return '';
}

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
    const url = new URL(req.url, 'http://localhost');
    const filterStatus = String(url.searchParams.get('status') || 'all').trim().toLowerCase();

    // Fetch purchases collection
    const snapshot = await db.collection('pending_purchases').get();

    const allPurchases = [];
    const counts = { all: 0, pending: 0, approved: 0, rejected: 0 };

    snapshot.forEach(doc => {
      const data = doc.data() || {};
      const status = String(data.status || 'pending').toLowerCase();
      
      if (counts[status] !== undefined) {
        counts[status]++;
      } else {
        counts.pending++;
      }
      counts.all++;

      allPurchases.push({
        id: doc.id,
        ...data,
        status: status,
        createdAt: toIso(data.createdAt) || data.createdAt,
        resolvedAt: toIso(data.resolvedAt) || data.resolvedAt,
        availableAt: toIso(data.availableAt) || data.availableAt
      });
    });

    // Sort newest first
    allPurchases.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    // Filter if requested
    let filtered = allPurchases;
    if (filterStatus && filterStatus !== 'all') {
      filtered = allPurchases.filter(p => p.status === filterStatus);
    }

    const pendingOnly = allPurchases.filter(p => p.status === 'pending');

    return sendJson(res, 200, {
      ok: true,
      purchases: filtered,
      pending: pendingOnly, // For backwards compatibility
      counts
    });
  } catch (error) {
    console.error('Error fetching purchases in admin:', error);
    return sendJson(res, 500, { error: 'Error al consultar compras de puntos.' });
  }
}

