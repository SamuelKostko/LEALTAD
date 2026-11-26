import { getFirestoreDb } from './_lib/firestore.js';
import { sendJson } from './_lib/http.js';
import {
  formatReleaseDurationLabel,
  formatReleaseTermsText,
  getBuyPointsReleaseConfig
} from './_lib/points.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
  }

  try {
    const db = getFirestoreDb();
    const settings = await getBuyPointsReleaseConfig(db);

    return sendJson(res, 200, {
      ok: true,
      releaseValue: settings.releaseValue,
      releaseUnit: settings.releaseUnit,
      label: formatReleaseDurationLabel(settings),
      termsText: formatReleaseTermsText(settings)
    });
  } catch (err) {
    console.error('Error in public buy-points-config API:', err);
    return sendJson(res, 500, { ok: false, error: 'Error al consultar la configuración de liberación.' });
  }
}

