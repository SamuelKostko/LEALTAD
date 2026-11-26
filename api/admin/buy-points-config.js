import { getFirestoreDb } from '../_lib/firestore.js';
import { requireAdmin } from '../_lib/adminAuth.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import {
  MAX_RELEASE_DAYS,
  MAX_RELEASE_HOURS,
  formatReleaseDurationLabel,
  formatReleaseTermsText,
  getBuyPointsReleaseConfig
} from '../_lib/points.js';

export default async function handler(req, res) {
  try {
    const authorized = await requireAdmin(req, res);
    if (!authorized) return;

    const db = getFirestoreDb();
    const configRef = db.collection('config').doc('buy_points_settings');

    if (req.method === 'GET') {
      const settings = await getBuyPointsReleaseConfig(db);
      return sendJson(res, 200, {
        ok: true,
        settings,
        label: formatReleaseDurationLabel(settings),
        termsText: formatReleaseTermsText(settings)
      });
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const rawUnit = String(body?.releaseUnit || '').trim().toLowerCase();
      const rawValue = body?.releaseValue;

      if (rawUnit !== 'hours' && rawUnit !== 'days') {
        return sendJson(res, 400, { ok: false, error: 'Unidad inválida. Usa "hours" (horas) o "days" (días).' });
      }

      const numValue = Number(rawValue);
      const maxVal = rawUnit === 'hours' ? MAX_RELEASE_HOURS : MAX_RELEASE_DAYS;

      if (!Number.isFinite(numValue) || !Number.isInteger(numValue) || numValue < 0 || numValue > maxVal) {
        return sendJson(res, 400, {
          ok: false,
          error: `El tiempo debe ser un número entero entre 0 y ${maxVal} ${rawUnit === 'hours' ? 'horas' : 'días'}.`
        });
      }

      const payload = {
        releaseValue: numValue,
        releaseUnit: rawUnit,
        updatedAt: new Date().toISOString()
      };

      await configRef.set(payload, { merge: true });

      const settings = { releaseValue: numValue, releaseUnit: rawUnit };
      const label = formatReleaseDurationLabel(settings);

      return sendJson(res, 200, {
        ok: true,
        settings,
        label,
        termsText: formatReleaseTermsText(settings),
        message: numValue === 0
          ? 'Configuración guardada: acreditación inmediata para nuevas compras.'
          : `Configuración guardada: liberación en ${label} para nuevas compras.`
      });
    }

    return sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
  } catch (err) {
    console.error('Error in admin buy-points-config API:', err);
    return sendJson(res, 500, { ok: false, error: 'Error interno al gestionar la configuración.' });
  }
}

