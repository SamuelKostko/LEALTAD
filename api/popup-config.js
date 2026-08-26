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

    sendJson(res, 200, snap.data());
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}
