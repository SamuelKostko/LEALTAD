import crypto from 'node:crypto';

export function makeToken() {
  return crypto.randomBytes(16).toString('base64url');
}

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function linkToOrigin(link) {
  try {
    const url = new URL(String(link));
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
}

export function timingSafeEqualString(a, b) {
  const aa = Buffer.from(String(a ?? ''), 'utf8');
  const bb = Buffer.from(String(b ?? ''), 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}
