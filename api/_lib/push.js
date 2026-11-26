import crypto from 'node:crypto';
import * as webpushNs from 'web-push';
import { getFirestoreDb } from './firestore.js';

const webpush = webpushNs.default?.sendNotification ? webpushNs.default : webpushNs;

let vapidConfiguredFor = '';

export function getVapidPublicKey() {
  return String(process.env.VAPID_PUBLIC_KEY || '').trim();
}

export function getVapidPrivateKey() {
  return String(process.env.VAPID_PRIVATE_KEY || '').trim();
}

export function getVapidSubject() {
  return String(process.env.VAPID_SUBJECT || 'mailto:soporte@vmaspuntos.com').trim();
}

export function isPushConfigured() {
  return Boolean(getVapidPublicKey() && getVapidPrivateKey());
}

function ensureVapidConfigured() {
  const pub = getVapidPublicKey();
  const priv = getVapidPrivateKey();
  const subj = getVapidSubject();
  if (!pub || !priv) return false;

  const signature = `${subj}|${pub}|${priv}`;
  if (vapidConfiguredFor !== signature) {
    webpush.setVapidDetails(subj, pub, priv);
    vapidConfiguredFor = signature;
  }
  return true;
}

export function subscriptionDocId(endpoint) {
  return crypto.createHash('sha256').update(String(endpoint || '')).digest('hex');
}

function normalizePayload(payload = {}) {
  return JSON.stringify({
    title: String(payload.title || 'V+ Puntos'),
    body: String(payload.body || ''),
    icon: String(payload.icon || '/icons/icon-192.png'),
    badge: String(payload.badge || '/icons/badge-72.png'),
    url: String(payload.url || '/'),
    tag: payload.tag ? String(payload.tag) : undefined,
    data: payload.data && typeof payload.data === 'object' ? payload.data : {}
  });
}

/**
 * Sends a Web Push notification to an array of Firestore subscription snapshots.
 * Automatically deletes expired/gone subscriptions (404 / 410).
 */
export async function sendPushToSubscriptionDocs(db, docs, payload) {
  if (!ensureVapidConfigured()) {
    return { ok: false, skipped: true, reason: 'missing_vapid', sent: 0, failed: 0, total: 0 };
  }

  const list = Array.isArray(docs) ? docs : [];
  if (list.length === 0) {
    return { ok: true, sent: 0, failed: 0, total: 0 };
  }

  const bodyStr = normalizePayload(payload);
  let sent = 0;
  let failed = 0;
  const staleDeletes = [];

  const CHUNK_SIZE = 40;
  for (let i = 0; i < list.length; i += CHUNK_SIZE) {
    const chunk = list.slice(i, i + CHUNK_SIZE);
    await Promise.allSettled(
      chunk.map(async (docSnap) => {
        const data = typeof docSnap.data === 'function' ? docSnap.data() : docSnap;
        const endpoint = String(data?.endpoint || '').trim();
        const keys = data?.keys;
        if (!endpoint || !keys?.p256dh || !keys?.auth) {
          failed++;
          return;
        }

        try {
          await webpush.sendNotification({ endpoint, keys }, bodyStr, { TTL: 60 * 60 * 12 });
          sent++;
        } catch (err) {
          failed++;
          const status = Number(err?.statusCode || 0);
          if ((status === 404 || status === 410) && docSnap.ref) {
            staleDeletes.push(docSnap.ref.delete().catch(() => null));
          } else {
            console.warn(`[Push] Error enviando notificación (${status || err?.message}):`, endpoint.slice(0, 60));
          }
        }
      })
    );
  }

  if (staleDeletes.length > 0) {
    await Promise.allSettled(staleDeletes);
  }

  return { ok: true, sent, failed, total: list.length };
}

export async function sendPushToClient(token, payload, dbArg) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken || !ensureVapidConfigured()) return { ok: false, sent: 0 };

  try {
    const db = dbArg || getFirestoreDb();
    const snap = await db
      .collection('push_subscriptions')
      .where('scope', '==', 'client')
      .where('token', '==', cleanToken)
      .get();

    if (snap.empty) return { ok: true, sent: 0, total: 0 };

    const targetPayload = {
      url: `/card/${encodeURIComponent(cleanToken)}`,
      ...payload
    };
    return await sendPushToSubscriptionDocs(db, snap.docs, targetPayload);
  } catch (err) {
    console.warn('[Push] Error en sendPushToClient:', err?.message || err);
    return { ok: false, sent: 0, error: err?.message };
  }
}

export async function sendPushToAllClients(payload, dbArg) {
  if (!ensureVapidConfigured()) return { ok: false, sent: 0, failed: 0, total: 0 };

  try {
    const db = dbArg || getFirestoreDb();
    const snap = await db
      .collection('push_subscriptions')
      .where('scope', '==', 'client')
      .get();

    if (snap.empty) return { ok: true, sent: 0, failed: 0, total: 0 };

    // Each client opens their own card URL unless payload explicitly provides a non-root path
    const results = { ok: true, sent: 0, failed: 0, total: snap.docs.length };
    const staleDeletes = [];
    const CHUNK_SIZE = 40;

    for (let i = 0; i < snap.docs.length; i += CHUNK_SIZE) {
      const chunk = snap.docs.slice(i, i + CHUNK_SIZE);
      await Promise.allSettled(
        chunk.map(async (docSnap) => {
          const data = docSnap.data() || {};
          const endpoint = String(data.endpoint || '').trim();
          const keys = data.keys;
          const clientToken = String(data.token || '').trim();
          if (!endpoint || !keys?.p256dh || !keys?.auth) {
            results.failed++;
            return;
          }

          let targetUrl = String(payload?.url || '/');
          if (clientToken && (targetUrl === '/' || targetUrl.startsWith('/#'))) {
            const hashPart = targetUrl.startsWith('/#') ? targetUrl.slice(1) : '';
            targetUrl = `/card/${encodeURIComponent(clientToken)}${hashPart}`;
          }

          const bodyStr = normalizePayload({ ...payload, url: targetUrl });
          try {
            await webpush.sendNotification({ endpoint, keys }, bodyStr, { TTL: 60 * 60 * 12 });
            results.sent++;
          } catch (err) {
            results.failed++;
            const status = Number(err?.statusCode || 0);
            if (status === 404 || status === 410) {
              staleDeletes.push(docSnap.ref.delete().catch(() => null));
            }
          }
        })
      );
    }

    if (staleDeletes.length > 0) {
      await Promise.allSettled(staleDeletes);
    }
    return results;
  } catch (err) {
    console.warn('[Push] Error en sendPushToAllClients:', err?.message || err);
    return { ok: false, sent: 0, failed: 0, total: 0, error: err?.message };
  }
}

export async function sendPushToAdmins(payload, { includeMarketing = false } = {}, dbArg) {
  if (!ensureVapidConfigured()) return { ok: false, sent: 0 };

  try {
    const db = dbArg || getFirestoreDb();
    const scopes = includeMarketing ? ['admin', 'marketing'] : ['admin'];
    const snap = await db
      .collection('push_subscriptions')
      .where('scope', 'in', scopes)
      .get();

    if (snap.empty) return { ok: true, sent: 0, total: 0 };

    const targetPayload = {
      url: '/admin',
      ...payload
    };
    return await sendPushToSubscriptionDocs(db, snap.docs, targetPayload);
  } catch (err) {
    console.warn('[Push] Error en sendPushToAdmins:', err?.message || err);
    return { ok: false, sent: 0, error: err?.message };
  }
}

