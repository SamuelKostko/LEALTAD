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

function normalizeUsername(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function isValidUsername(username) {
  return /^[a-z0-9_]{3,30}$/.test(username);
}

function toDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }
  return null;
}

export default async function handler(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const auth = await verifySession(cookies['admin_session']);
  if (!auth.ok) {
    sendJson(res, 401, { error: 'No autorizado.' });
    return;
  }

  const requesterRole = String(auth.data?.role ?? '').trim().toLowerCase();
  if (requesterRole === 'cashier' || requesterRole === 'merchant') {
    sendJson(res, 403, { error: 'No autorizado.' });
    return;
  }

  const firestore = getFirestoreDb();

  if (req.method === 'GET') {
    try {
      const snapshot = await firestore.collection('merchants').get();
      const merchants = snapshot.docs.map((doc) => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          username: data.username,
          name: data.name,
          branchName: data.branchName,
          settings: data.settings || { pointsPerDollar: 1, minRedeemPoints: 0 },
          createdAt: toDateValue(data.createdAt),
          lastLogin: toDateValue(data.sessionCreatedAt)
        };
      });

      sendJson(res, 200, { ok: true, merchants });
      return;
    } catch (err) {
      console.error('Error listing merchants:', err);
      sendJson(res, 500, { error: 'Error al obtener comercios.' });
      return;
    }
  }

  if (req.method === 'DELETE') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    const id = String(body?.id ?? '').trim();
    if (!id) {
      sendJson(res, 400, { error: 'ID de comercio requerido.' });
      return;
    }

    try {
      await firestore.collection('merchants').doc(id).delete();
      sendJson(res, 200, { ok: true, message: 'Comercio eliminado.' });
    } catch (err) {
      console.error('Error deleting merchant:', err);
      sendJson(res, 500, { error: 'Error interno al eliminar.' });
    }
    return;
  }

  if (req.method === 'PATCH') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    const id = String(body?.id ?? '').trim();
    if (!id) {
      sendJson(res, 400, { error: 'ID de comercio requerido.' });
      return;
    }

    const updates = { updatedAt: FieldValue.serverTimestamp() };

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name || name.length > 120) {
        sendJson(res, 400, { error: 'Nombre inválido.' });
        return;
      }
      updates.name = name;
    }

    if (body.branchName !== undefined) {
      const branchName = String(body.branchName).trim();
      if (!branchName || branchName.length > 120) {
        sendJson(res, 400, { error: 'Sede inválida.' });
        return;
      }
      updates.branchName = branchName;
    }

    if (body.password !== undefined) {
      const pwd = String(body.password).trim();
      if (pwd.length > 0) {
        if (pwd.length < 6) {
          sendJson(res, 400, { error: 'La contraseña debe tener al menos 6 caracteres.' });
          return;
        }
        updates.password = pwd;
      }
    }

    if (body.settings !== undefined) {
      const s = body.settings || {};
      updates.settings = {
        pointsPerDollar: Number.isFinite(Number(s.pointsPerDollar)) ? Number(s.pointsPerDollar) : 1,
        minRedeemPoints: Number.isFinite(Number(s.minRedeemPoints)) ? Number(s.minRedeemPoints) : 0,
        isClosed: s.isClosed === true
      };
    }

    try {
      await firestore.collection('merchants').doc(id).update(updates);
      sendJson(res, 200, { ok: true, message: 'Comercio actualizado.' });
    } catch (err) {
      console.error('Error updating merchant:', err);
      sendJson(res, 500, { error: 'Error interno al actualizar.' });
    }
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  const username = normalizeUsername(body?.username);
  const password = String(body?.password ?? '').trim();
  const name = String(body?.name ?? '').trim();
  const branchName = String(body?.branchName ?? '').trim();

  if (!username || !password || !name || !branchName) {
    sendJson(res, 400, { error: 'Usuario, contraseña, nombre y sede son requeridos.' });
    return;
  }

  if (!isValidUsername(username)) {
    sendJson(res, 400, { error: 'Usuario inválido (3-30 caracteres, minúsculas, números o guion bajo).' });
    return;
  }

  if (password.length < 6) {
    sendJson(res, 400, { error: 'La contraseña debe tener al menos 6 caracteres.' });
    return;
  }

  if (name.length > 120) {
    sendJson(res, 400, { error: 'Nombre inválido.' });
    return;
  }

  if (branchName.length > 120) {
    sendJson(res, 400, { error: 'Sede inválida.' });
    return;
  }

  try {
    const existingCashier = await firestore.collection('cashiers').where('username', '==', username).limit(1).get();
    if (!existingCashier.empty) {
      sendJson(res, 409, { error: 'Ya existe un usuario con ese nombre de usuario.' });
      return;
    }

    const existingMerchant = await firestore.collection('merchants').where('username', '==', username).limit(1).get();
    if (!existingMerchant.empty) {
      sendJson(res, 409, { error: 'Ya existe un usuario con ese nombre de usuario.' });
      return;
    }

    const ref = firestore.collection('merchants').doc();
    await ref.set({
      username,
      password,
      role: 'merchant',
      name,
      branchName,
      settings: {
        pointsPerDollar: Number.isFinite(Number(body?.settings?.pointsPerDollar)) ? Number(body.settings.pointsPerDollar) : 1,
        minRedeemPoints: Number.isFinite(Number(body?.settings?.minRedeemPoints)) ? Number(body.settings.minRedeemPoints) : 0,
        isClosed: body?.settings?.isClosed !== false // Default to true for new ones in the Merchants area
      },
      sessionId: null,
      sessionCreatedAt: null,
      sessionExpiresAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: auth.adminId
    });

    sendJson(res, 200, { ok: true, id: ref.id });
  } catch (err) {
    console.error('Error creating merchant:', err);
    sendJson(res, 500, { error: err?.message || 'Error interno del servidor.' });
  }
}
