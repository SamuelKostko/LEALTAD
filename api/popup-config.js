import { getFirestoreDb } from './_lib/firestore.js';
import { sendJson } from './_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Método no permitido' });
    return;
  }

  try {
    const firestore = getFirestoreDb();
    const configRef = firestore.collection('system').doc('popupConfig');
    const snap = await configRef.get();
    
    if (!snap.exists) {
      sendJson(res, 200, { type: 'none' });
      return;
    }

    const data = snap.data() || {};
    const type = data.type || 'none';

    // 🎲 MODO 1: Promociones aleatorias
    if (type === 'random_promotion') {
      const promosSnap = await firestore.collection('promotions').get();
      const validPromos = [];
      promosSnap.forEach(doc => {
        const p = doc.data() || {};
        if (p.image && p.active !== false) {
          validPromos.push({ id: doc.id, ...p });
        }
      });

      if (validPromos.length > 0) {
        const randomIndex = Math.floor(Math.random() * validPromos.length);
        const randomPromo = validPromos[randomIndex];
        return sendJson(res, 200, {
          type: 'promotion',
          promotionId: randomPromo.id,
          imageUrl: randomPromo.image,
          promotion: randomPromo
        });
      }
      return sendJson(res, 200, { type: 'none' });
    }

    // 🖼️ MODO 2: Galería de imágenes aleatorias
    if (type === 'random_images') {
      const imagesList = Array.isArray(data.images) ? data.images.filter(Boolean) : (data.imageUrl ? [data.imageUrl] : []);
      if (imagesList.length > 0) {
        const randomIndex = Math.floor(Math.random() * imagesList.length);
        return sendJson(res, 200, {
          type: 'custom_image',
          imageUrl: imagesList[randomIndex]
        });
      }
      return sendJson(res, 200, { type: 'none' });
    }

    // 🎯 MODO 3: Promoción específica fija
    if (type === 'promotion' && data.promotionId) {
      const promoSnap = await firestore.collection('promotions').doc(data.promotionId).get();
      if (promoSnap.exists) {
        const promoData = promoSnap.data() || {};
        return sendJson(res, 200, {
          type: 'promotion',
          promotionId: promoSnap.id,
          imageUrl: promoData.image,
          promotion: { id: promoSnap.id, ...promoData }
        });
      }
      return sendJson(res, 200, { type: 'none' });
    }

    // 📷 MODO 4: Imagen personalizada fija
    if (type === 'custom_image' && data.imageUrl) {
      return sendJson(res, 200, {
        type: 'custom_image',
        imageUrl: data.imageUrl
      });
    }

    // Desactivado / ninguno
    sendJson(res, 200, { type: 'none' });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

