import { getFirestoreDb } from '../_lib/firestore.js';
import { requireAdmin } from '../_lib/adminAuth.js';
import { sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  const authorized = await requireAdmin(req, res);
  if (!authorized) return;

  const firestore = getFirestoreDb();
  const configRef = firestore.collection('system').doc('popupConfig');

  if (req.method === 'GET') {
    try {
      const snap = await configRef.get();
      if (!snap.exists) {
        sendJson(res, 200, { type: 'none' });
        return;
      }
      sendJson(res, 200, snap.data());
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
  } else if (req.method === 'POST') {
    try {
      const { type, promotionId, imageUrl } = req.body;

      if (!['none', 'promotion', 'custom_image'].includes(type)) {
        sendJson(res, 400, { error: 'Tipo de popup inválido' });
        return;
      }

      const payload = {
        type,
        updatedAt: new Date().toISOString()
      };

      if (type === 'promotion') {
        if (!promotionId) {
          sendJson(res, 400, { error: 'Falta el ID de la promoción' });
          return;
        }
        payload.promotionId = promotionId;
        payload.imageUrl = null; // Clear image
      } else if (type === 'custom_image') {
        if (!imageUrl) {
          sendJson(res, 400, { error: 'Falta la imagen' });
          return;
        }
        payload.imageUrl = imageUrl;
        payload.promotionId = null; // Clear promotion ID
      } else {
        payload.imageUrl = null;
        payload.promotionId = null;
      }

      await configRef.set(payload, { merge: true });
      sendJson(res, 200, { ok: true, message: 'Configuración guardada' });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
  } else {
    sendJson(res, 405, { error: 'Método no permitido' });
  }
}
