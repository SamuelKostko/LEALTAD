import crypto from 'node:crypto';
import { getFirestoreDb } from './firestore.js';

const COOKIE_NAME = 'admin_session';
const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hour

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

export function getAdminPassword() {
  return String(process.env.ADMIN_PASSWORD ?? process.env.ADMIN_KEY ?? '').trim();
}

/**
 * Creates a new session in Firestore for a specific admin document and returns the sessionId.
 * Stores: sessionId, sessionCreatedAt, sessionExpiresAt in config/{docId}.
 */
export async function createSession(docId = 'admin') {
  const db = getFirestoreDb();
  const sessionId = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION_MS;

  await db.collection('config').doc(docId).update({
    sessionId,
    sessionCreatedAt: now,
    sessionExpiresAt: expiresAt
  });

  return { sessionId, expiresAt };
}

/**
 * Validates the sessionId from the cookie against any document in the config collection.
 * Returns { ok: true } if a valid session is found.
 */
export async function verifySession(cookieValue) {
  if (!cookieValue || typeof cookieValue !== 'string' || !cookieValue.trim()) {
    return { ok: false, reason: 'missing_cookie' };
  }

  try {
    const db = getFirestoreDb();
    const sessionId = cookieValue.trim();
    
    // Search across all docs in 'config' for this sessionId
    const snap = await db.collection('config').where('sessionId', '==', sessionId).limit(1).get();

    if (snap.empty) {
      return { ok: false, reason: 'no_session' };
    }

    const adminDoc = snap.docs[0];
    const data = adminDoc.data();
    const expiresAt = Number(data?.sessionExpiresAt ?? 0);

    // Check expiration
    if (Date.now() > expiresAt) {
      return { ok: false, reason: 'expired' };
    }

    return { ok: true, adminId: adminDoc.id, data };
  } catch (err) {
    console.error('Session verify error:', err);
    return { ok: false, reason: 'error' };
  }
}

/**
 * Destroys the session in Firestore by clearing the sessionId fields 
 * in whichever document currently holds it.
 */
export async function destroySession(sessionId) {
  try {
    const db = getFirestoreDb();
    if (!sessionId) return false;

    const snap = await db.collection('config').where('sessionId', '==', sessionId).limit(1).get();
    if (snap.empty) return true; // Already gone or never existed

    await snap.docs[0].ref.update({
      sessionId: null,
      sessionCreatedAt: null,
      sessionExpiresAt: null
    });
    return true;
  } catch (err) {
    console.error('Session destroy error:', err);
    return false;
  }
}

/**
 * Checks if the current request has a valid staff session.
 */
export async function isStaffRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[COOKIE_NAME];
  const result = await verifySession(sessionId);
  return result.ok;
}

/**
 * Checks if the current request has a valid admin session.
 * Cashiers are considered non-admin.
 */
export async function isAdminRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[COOKIE_NAME];
  const result = await verifySession(sessionId);
  if (!result.ok) return false;

  const role = String(result.data?.role ?? '').trim().toLowerCase();
  if (role === 'cashier') return false;
  return true;
}

/**
 * Middleware: returns true if authorized, sends 401 and returns false otherwise.
 */
export async function requireAdmin(req, res) {
  const authorized = await isAdminRequest(req);
  if (authorized) return true;

  res.statusCode = 401;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ error: 'Unauthorized' }));
  return false;
}

/**
 * Middleware: returns true if staff-authorized, sends 401 and returns false otherwise.
 */
export async function requireStaff(req, res) {
  const authorized = await isStaffRequest(req);
  if (authorized) return true;

  res.statusCode = 401;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ error: 'Unauthorized' }));
  return false;
}

/**
 * Sets the session cookie on the response.
 */
export function setSessionCookie(res, sessionId, req) {
  // req.secure is true when express detects HTTPS (respects trust proxy=1).
  // Fall back to x-forwarded-proto for any other proxy setup.
  const secure =
    (req?.secure === true) ||
    String(req?.headers?.['x-forwarded-proto'] ?? '').toLowerCase() === 'https';
  const maxAge = Math.floor(SESSION_DURATION_MS / 1000);

  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,   // Lax: cookie is sent on top-level navigations; Strict was too aggressive for Chrome mobile
    `Max-Age=${maxAge}`
  ];
  if (secure) attrs.push('Secure');

  res.setHeader('Set-Cookie', attrs.join('; '));
}

/**
 * Clears the session cookie on the response.
 */
export function clearSessionCookie(res, req) {
  const secure =
    (req?.secure === true) ||
    String(req?.headers?.['x-forwarded-proto'] ?? '').toLowerCase() === 'https';

  const attrs = [
    `${COOKIE_NAME}=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=0`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  ];
  if (secure) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}
