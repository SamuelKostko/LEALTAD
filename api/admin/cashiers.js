import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreDb } from '../_lib/firestore.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { verifySession } from '../_lib/adminAuth.js';

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

export default async function handler(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const auth = await verifySession(cookies['admin_session']);
  if (!auth.ok) {
    sendJson(res, 401, { error: 'No autorizado.' });
    return;
  }

  // Only admins can manage cashier users
  const requesterRole = String(auth.data?.role ?? '').trim().toLowerCase();
  if (requesterRole === 'cashier') {
    sendJson(res, 403, { error: 'No autorizado.' });
    return;
  }

  const firestore = getFirestoreDb();

  if (req.method === 'GET') {
    try {
      const snapshot = await firestore.collection('cashiers').get();
      const cashiers = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          username: data.username,
          name: data.name,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          lastLogin: data.sessionCreatedAt?.toDate?.() || data.sessionCreatedAt
        };
      });
      sendJson(res, 200, { ok: true, cashiers });
      return;
    } catch (err) {
      console.error('Error listing cashiers:', err);
      sendJson(res, 500, { error: 'Error al obtener cajeros.' });
      return;
    }
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

  if (!username || !password) {
    sendJson(res, 400, { error: 'Usuario y contraseña son requeridos.' });
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

  try {
    const existing = await firestore.collection('cashiers').where('username', '==', username).limit(1).get();
    if (!existing.empty) {
      sendJson(res, 409, { error: 'Ya existe un usuario con ese nombre de usuario.' });
      return;
    }

    const ref = firestore.collection('cashiers').doc();
    await ref.set({
      username,
      password,
      role: 'cashier',
      name: name || null,
      sessionId: null,
      sessionCreatedAt: null,
      sessionExpiresAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: auth.adminId
    });

    sendJson(res, 200, { ok: true, id: ref.id });
  } catch (err) {
    console.error('Error creating cashier:', err);
    sendJson(res, 500, { error: err?.message || 'Error interno del servidor.' });
  }
}
