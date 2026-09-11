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
      const { type, promotionId, imageUrl, images } = req.body || {};

      if (!['none', 'promotion', 'custom_image', 'random_promotion', 'random_images'].includes(type)) {
        sendJson(res, 400, { error: 'Tipo de popup inválido' });
        return;
      }

      const payload = {
        type,
        updatedAt: new Date().toISOString()
      };

      if (type === 'random_promotion') {
        payload.promotionId = null;
        payload.imageUrl = null;
        payload.images = null;
      } else if (type === 'random_images') {
        const cleanedImages = Array.isArray(images) ? images.filter(Boolean) : (imageUrl ? [imageUrl] : []);
        if (cleanedImages.length === 0) {
          sendJson(res, 400, { error: 'Debes subir al menos una imagen para la galería aleatoria.' });
          return;
        }
        payload.images = cleanedImages;
        payload.imageUrl = cleanedImages[0];
        payload.promotionId = null;
      } else if (type === 'promotion') {
        if (!promotionId) {
          sendJson(res, 400, { error: 'Falta el ID de la promoción' });
          return;
        }
        payload.promotionId = promotionId;
        payload.imageUrl = null;
        payload.images = null;
      } else if (type === 'custom_image') {
        if (!imageUrl) {
          sendJson(res, 400, { error: 'Falta la imagen' });
          return;
        }
        payload.imageUrl = imageUrl;
        payload.promotionId = null;
        payload.images = null;
      } else {
        payload.imageUrl = null;
        payload.promotionId = null;
        payload.images = null;
      }

      await configRef.set(payload, { merge: true });
      sendJson(res, 200, { ok: true, message: 'Configuración guardada exitosamente' });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
  } else {
    sendJson(res, 405, { error: 'Método no permitido' });
  }
}
