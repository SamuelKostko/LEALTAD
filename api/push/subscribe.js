import { getFirestoreDb } from '../_lib/firestore.js';
import { verifySession } from '../_lib/adminAuth.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { isPushConfigured, subscriptionDocId } from '../_lib/push.js';

function parseAdminCookie(req) {
  const cookies = (req.headers.cookie || '').split(';').reduce((acc, c) => {
    const idx = c.indexOf('=');
    if (idx !== -1) {
      acc[c.slice(0, idx).trim()] = decodeURIComponent(c.slice(idx + 1).trim());
    }
    return acc;
  }, {});
  return cookies['admin_session'] || '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
  }

  if (!isPushConfigured()) {
    return sendJson(res, 503, { ok: false, error: 'Notificaciones push no configuradas en el servidor.' });
  }

  try {
    const body = await readJsonBody(req);
    const requestedScope = String(body?.scope || 'client').trim().toLowerCase();
    const db = getFirestoreDb();

    if (req.method === 'DELETE') {
      const endpoint = String(body?.endpoint || '').trim();
      if (!endpoint) {
        return sendJson(res, 400, { ok: false, error: 'Falta el endpoint de suscripción.' });
      }
      const docId = subscriptionDocId(endpoint);
      await db.collection('push_subscriptions').doc(docId).delete().catch(() => null);
      return sendJson(res, 200, { ok: true });
    }

    const subscription = body?.subscription || {};
    const endpoint = String(subscription?.endpoint || '').trim();
    const p256dh = String(subscription?.keys?.p256dh || '').trim();
    const authKey = String(subscription?.keys?.auth || '').trim();

    if (!endpoint || !p256dh || !authKey) {
      return sendJson(res, 400, { ok: false, error: 'Suscripción push inválida.' });
    }

    const docId = subscriptionDocId(endpoint);
    const nowIso = new Date().toISOString();
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 200);

    if (requestedScope === 'admin' || requestedScope === 'marketing') {
      const sessionCookie = parseAdminCookie(req);
      const auth = await verifySession(sessionCookie);
      if (!auth.ok) {
        return sendJson(res, 401, { ok: false, error: 'Sesión de administrador requerida.' });
      }

      const role = String(auth.data?.role || 'admin').trim().toLowerCase();
      if (role === 'cashier' || role === 'merchant') {
        return sendJson(res, 403, { ok: false, error: 'Rol sin acceso a notificaciones administrativas.' });
      }

      const finalScope = role === 'marketing' ? 'marketing' : 'admin';

      await db.collection('push_subscriptions').doc(docId).set(
        {
          endpoint,
          keys: { p256dh, auth: authKey },
          scope: finalScope,
          role,
          adminId: String(auth.adminId || ''),
          token: '',
          userAgent,
          active: true,
          updatedAt: nowIso,
          createdAt: nowIso
        },
        { merge: true }
      );

      return sendJson(res, 200, { ok: true, scope: finalScope });
    }

    // Client subscription
    const token = String(body?.token || '').trim();
    if (!token) {
      return sendJson(res, 400, { ok: false, error: 'Falta el token de la tarjeta.' });
    }

    // Verify client exists
    let clientExists = false;
    const directDoc = await db.collection('clientes').doc(token).get();
    if (directDoc.exists) {
      clientExists = true;
    } else {
      const qSnap = await db.collection('clientes').where('token', '==', token).limit(1).get();
      clientExists = !qSnap.empty;
    }

    if (!clientExists) {
      return sendJson(res, 404, { ok: false, error: 'Tarjeta no encontrada.' });
    }

    await db.collection('push_subscriptions').doc(docId).set(
      {
        endpoint,
        keys: { p256dh, auth: authKey },
        scope: 'client',
        token,
        adminId: '',
        role: 'client',
        userAgent,
        active: true,
        updatedAt: nowIso,
        createdAt: nowIso
      },
      { merge: true }
    );

    return sendJson(res, 200, { ok: true, scope: 'client' });
  } catch (err) {
    console.error('Error in push subscribe API:', err);
    return sendJson(res, 500, { ok: false, error: 'Error al registrar la suscripción push.' });
  }
}

