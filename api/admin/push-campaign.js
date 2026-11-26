import { getFirestoreDb } from '../_lib/firestore.js';
import { requireAdminOrMarketing } from '../_lib/adminAuth.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { isPushConfigured, sendPushToAllClients } from '../_lib/push.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
  }

  const authorized = await requireAdminOrMarketing(req, res);
  if (!authorized) return;

  if (!isPushConfigured()) {
    return sendJson(res, 503, { ok: false, error: 'Notificaciones push no configuradas (faltan claves VAPID).' });
  }

  try {
    const body = await readJsonBody(req);
    const title = String(body?.title || '').trim().slice(0, 100);
    const message = String(body?.body || '').trim().slice(0, 240);
    const url = String(body?.url || '/#promos').trim() || '/#promos';

    if (!title || !message) {
      return sendJson(res, 400, { ok: false, error: 'Título y mensaje son requeridos.' });
    }

    const db = getFirestoreDb();
    const result = await sendPushToAllClients(
      {
        title,
        body: message,
        url,
        tag: `campaign-${Date.now()}`
      },
      db
    );

    return sendJson(res, 200, {
      ok: true,
      sent: result.sent || 0,
      failed: result.failed || 0,
      total: result.total || 0,
      message: `Notificación enviada a ${result.sent || 0} de ${result.total || 0} dispositivos suscritos.`
    });
  } catch (err) {
    console.error('Error in push-campaign API:', err);
    return sendJson(res, 500, { ok: false, error: 'Error al enviar la campaña push.' });
  }
}

