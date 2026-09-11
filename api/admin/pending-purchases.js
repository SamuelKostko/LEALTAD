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

    // Collect unique cardNumbers/tokens to resolve client profiles
    const uniqueIdentifiers = Array.from(
      new Set(
        allPurchases.map(p => String(p.cardNumber || '').trim()).filter(Boolean)
      )
    );

    const clientMap = new Map();

    // Batch fetch from clientes collection
    if (uniqueIdentifiers.length > 0) {
      // Chunk in groups of 30 for Firestore 'in' queries
      for (let i = 0; i < uniqueIdentifiers.length; i += 30) {
        const chunk = uniqueIdentifiers.slice(i, i + 30);
        try {
          // 1. By token field
          const snapByToken = await db.collection('clientes').where('token', 'in', chunk).get();
          snapByToken.forEach(doc => {
            const d = doc.data() || {};
            const key = String(d.token || doc.id).trim();
            clientMap.set(key, d);
            if (d.idNumber) clientMap.set(String(d.idNumber).trim(), d);
          });

          // 2. By idNumber field
          const snapById = await db.collection('clientes').where('idNumber', 'in', chunk).get();
          snapById.forEach(doc => {
            const d = doc.data() || {};
            const key = String(d.idNumber || doc.id).trim();
            clientMap.set(key, d);
            if (d.token) clientMap.set(String(d.token).trim(), d);
          });

          // 3. Direct document IDs
          await Promise.all(chunk.map(async (id) => {
            if (!clientMap.has(id)) {
              try {
                const docSnap = await db.collection('clientes').doc(id).get();
                if (docSnap.exists) {
                  const d = docSnap.data() || {};
                  clientMap.set(id, d);
                  if (d.token) clientMap.set(String(d.token).trim(), d);
                  if (d.idNumber) clientMap.set(String(d.idNumber).trim(), d);
                }
              } catch (_) {}
            }
          }));
        } catch (fetchErr) {
          console.warn('Error fetching client details in pending-purchases:', fetchErr);
        }
      }
    }

    // Attach resolved client details to purchases
    allPurchases.forEach(p => {
      const cardKey = String(p.cardNumber || '').trim();
      const client = clientMap.get(cardKey) || clientMap.get(String(p.clientCedula || '').trim());
      
      if (client) {
        if (!p.clientName || p.clientName === 'Desconocido') {
          p.clientName = String(client.nombre || client.name || client.customerName || 'Cliente').trim();
        }
        if (!p.clientCedula) {
          p.clientCedula = String(client.idNumber || client.cedula || '').trim();
        }
        if (!p.clientPhone) {
          p.clientPhone = String(client.telefono || client.phone || '').trim();
        }
        if (!p.clientEmail) {
          p.clientEmail = String(client.email || client.customerEmail || '').trim();
        }
      }

      // If reference is empty but it was auto reconciled / approved without manual ref
      if (!p.reference && (p.isAutoReconciled || p.status === 'approved')) {
        p.reference = 'Auto-Conciliado';
      }
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

