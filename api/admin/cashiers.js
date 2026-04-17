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

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function isValidEmail(email) {
  // Simple sanity check (not RFC exhaustive)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  // Verify session
  const cookies = parseCookies(req.headers.cookie);
  const auth = await verifySession(cookies['admin_session']);
  if (!auth.ok) {
    sendJson(res, 401, { error: 'No autorizado.' });
    return;
  }

  // Only admins can create cashier users
  const requesterRole = String(auth.data?.role ?? '').trim().toLowerCase();
  if (requesterRole === 'cashier') {
    sendJson(res, 403, { error: 'No autorizado.' });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  const email = normalizeEmail(body?.email);
  const password = String(body?.password ?? '').trim();
  const name = String(body?.name ?? '').trim();

  if (!email || !password) {
    sendJson(res, 400, { error: 'Correo y contraseña son requeridos.' });
    return;
  }

  if (!isValidEmail(email)) {
    sendJson(res, 400, { error: 'Correo inválido.' });
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

  const firestore = getFirestoreDb();

  try {
    const existing = await firestore.collection('config').where('email', '==', email).limit(1).get();
    if (!existing.empty) {
      sendJson(res, 409, { error: 'Ya existe un usuario con ese correo.' });
      return;
    }

    const ref = firestore.collection('config').doc();
    await ref.set({
      email,
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
