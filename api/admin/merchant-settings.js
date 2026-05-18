import { FieldValue } from 'firebase-admin/firestore';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { verifySession } from '../_lib/adminAuth.js';
import { getFirestoreDb } from '../_lib/firestore.js';

function parseCookies(header) {
  const raw = String(header ?? '');
  if (!raw) return {};
  const out = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(val);
  }
  return out;
}

export default async function handler(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const auth = await verifySession(cookies['admin_session']);
  if (!auth.ok) {
    sendJson(res, 401, { error: 'No autorizado.' });
    return;
  }

  const role = String(auth.data?.role ?? '').trim().toLowerCase();
  if (role !== 'merchant') {
    sendJson(res, 403, { error: 'No autorizado. Solo comercios pueden ver o editar su configuración.' });
    return;
  }

  const merchantId = String(auth.adminId ?? '').trim();
  if (!merchantId) {
    sendJson(res, 500, { error: 'ID de comercio no encontrado en la sesión.' });
    return;
  }

  const firestore = getFirestoreDb();

  if (req.method === 'GET') {
    try {
      const doc = await firestore.collection('merchants').doc(merchantId).get();
      if (!doc.exists) {
        sendJson(res, 404, { error: 'Comercio no encontrado.' });
        return;
      }
      const data = doc.data() || {};
      const settings = data.settings || {};
      if (settings.pointsPerDollar === undefined) settings.pointsPerDollar = 100;
      if (settings.minRedeemPoints === undefined) settings.minRedeemPoints = 0;
      if (settings.cashbackPercent === undefined) settings.cashbackPercent = 5;
      if (settings.isClosed === undefined) settings.isClosed = true;
      sendJson(res, 200, {
        ok: true,
        name: data.name,
        branchName: data.branchName,
        settings
      });
      return;
    } catch (err) {
      console.error('Error fetching merchant settings:', err);
      sendJson(res, 500, { error: 'Error al obtener la configuración.' });
      return;
    }
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    const s = body?.settings || {};
    const pointsPerDollar = 100;
    const minRedeemPoints = Number(s.minRedeemPoints);
    const cashbackPercent = Number(s.cashbackPercent ?? 5);

    if (!Number.isFinite(minRedeemPoints) || minRedeemPoints < 0) {
      sendJson(res, 400, { error: 'Mínimo de puntos para canje debe ser un número igual o mayor a cero.' });
      return;
    }

    if (!Number.isFinite(cashbackPercent) || cashbackPercent <= 0 || cashbackPercent > 100) {
      sendJson(res, 400, { error: 'El porcentaje de cashback debe ser un número mayor a cero y menor o igual a 100.' });
      return;
    }

    try {
      const docRef = firestore.collection('merchants').doc(merchantId);
      const doc = await docRef.get();
      if (!doc.exists) {
        sendJson(res, 404, { error: 'Comercio no encontrado.' });
        return;
      }

      const currentData = doc.data() || {};
      const currentSettings = currentData.settings || {};
      const isClosed = currentSettings.isClosed !== false;

      await docRef.update({
        settings: {
          pointsPerDollar,
          minRedeemPoints,
          cashbackPercent,
          isClosed,
          configured: true
        },
        updatedAt: FieldValue.serverTimestamp()
      });

      sendJson(res, 200, { ok: true, message: 'Configuración de comercio actualizada con éxito.' });
    } catch (err) {
      console.error('Error updating merchant settings:', err);
      sendJson(res, 500, { error: 'Error al guardar la configuración.' });
    }
    return;
  }

  sendJson(res, 405, { error: 'Method Not Allowed' });
}
