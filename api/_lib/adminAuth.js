import crypto from 'node:crypto';
import { timingSafeEqualString } from './utils.js';

const COOKIE_NAME = 'admin_session';
const VERSION = 'v1';

function base64urlEncode(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function base64urlDecodeToString(value) {
  return Buffer.from(String(value), 'base64url').toString('utf8');
}

function sign(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

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

function getSessionSecret() {
  return String(process.env.SESSION_SECRET ?? '').trim();
}

export function getAdminPassword() {
  // Backwards compatible with existing env
  return String(process.env.ADMIN_PASSWORD ?? process.env.ADMIN_KEY ?? '').trim();
}

export function createAdminSessionCookie({ now = Date.now() } = {}) {
  const secret = getSessionSecret();
  if (!secret) throw new Error('SESSION_SECRET not set');

  const iat = Math.floor(now / 1000);
  const exp = iat + 60 * 60 * 24 * 7; // 7 days
  const payload = { iat, exp };
  const encoded = base64urlEncode(JSON.stringify(payload));
  const data = `${VERSION}.${encoded}`;
  const sig = sign(data, secret);
  return `${data}.${sig}`;
}

export function verifyAdminSessionCookie(cookieValue, { now = Date.now() } = {}) {
  const secret = getSessionSecret();
  if (!secret) return { ok: false, reason: 'missing_secret' };

  const raw = String(cookieValue ?? '').trim();
  if (!raw) return { ok: false, reason: 'missing_cookie' };

  const parts = raw.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'bad_format' };

  const [version, encoded, sig] = parts;
  if (version !== VERSION) return { ok: false, reason: 'bad_version' };

  const data = `${version}.${encoded}`;
  const expected = sign(data, secret);
  if (!timingSafeEqualString(sig, expected)) return { ok: false, reason: 'bad_sig' };

  try {
    const parsed = JSON.parse(base64urlDecodeToString(encoded));
    const exp = Number(parsed?.exp ?? 0);
    if (!Number.isFinite(exp) || exp <= 0) return { ok: false, reason: 'bad_payload' };

    const nowSec = Math.floor(now / 1000);
    if (nowSec > exp) return { ok: false, reason: 'expired' };

    return { ok: true, payload: parsed };
  } catch {
    return { ok: false, reason: 'bad_payload' };
  }
}

export function isAdminRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  const session = cookies[COOKIE_NAME];
  return verifyAdminSessionCookie(session).ok;
}

export function requireAdmin(req, res) {
  if (isAdminRequest(req)) return true;

  res.statusCode = 401;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ error: 'Unauthorized' }));
  return false;
}

export function setAdminCookie(res, cookieValue, req) {
  const proto = String(req?.headers?.['x-forwarded-proto'] ?? '').toLowerCase();
  const secure = proto === 'https';

  const maxAge = 60 * 60 * 24 * 7;
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(cookieValue)}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Strict`,
    `Max-Age=${maxAge}`
  ];
  if (secure) attrs.push('Secure');

  res.setHeader('Set-Cookie', attrs.join('; '));
}

export function clearAdminCookie(res, req) {
  const proto = String(req?.headers?.['x-forwarded-proto'] ?? '').toLowerCase();
  const secure = proto === 'https';

  const attrs = [
    `${COOKIE_NAME}=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Strict`,
    `Max-Age=0`
  ];
  if (secure) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}
