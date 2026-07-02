import { getFirestoreDb } from '../_lib/firestore.js';
import { sendJson, readJsonBody } from '../_lib/http.js';
import { requireAdmin } from '../_lib/adminAuth.js';

export default async function handler(req, res) {
  try {
    const auth = await requireAdmin(req, res);
    if (!auth) return; // Response handled by requireAdmin

    const firestore = getFirestoreDb();
    const configDocRef = firestore.collection('config').doc('referral_settings');

    if (req.method === 'GET') {
      const doc = await configDocRef.get();
      let data = { bonusPercent: 5 }; // Default to 5%
      
      if (doc.exists) {
        data = doc.data();
      }
      
      return sendJson(res, 200, { ok: true, settings: data });
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const bonusPercent = Number(body.bonusPercent ?? 5);

      if (!Number.isFinite(bonusPercent) || bonusPercent < 0 || bonusPercent > 100) {
        return sendJson(res, 400, { error: 'El porcentaje debe estar entre 0 y 100.' });
      }

      await configDocRef.set({ bonusPercent }, { merge: true });

      return sendJson(res, 200, { ok: true, message: 'Configuración de referidos actualizada exitosamente.' });
    }

    sendJson(res, 405, { error: 'Method Not Allowed' });
  } catch (err) {
    console.error('Error in referral-config API:', err);
    sendJson(res, 500, { error: 'Internal Server Error' });
  }
}
