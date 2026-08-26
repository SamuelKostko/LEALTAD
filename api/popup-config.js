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

    const data = snap.data();
    
    // If it's a promotion, fetch the promotion details so the frontend has the image immediately
    if (data.type === 'promotion' && data.promotionId) {
      const promoSnap = await firestore.collection('promotions').doc(data.promotionId).get();
      if (promoSnap.exists) {
        const promoData = promoSnap.data();
        data.imageUrl = promoData.image; // attach the image
        data.promotion = { id: promoSnap.id, ...promoData }; // attach the full promo for click handler
      } else {
        // Promotion no longer exists, default to none
        data.type = 'none';
      }
    }

    sendJson(res, 200, data);
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}
