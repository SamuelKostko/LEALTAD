import crypto from 'node:crypto';
import webpush from 'web-push';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreDb } from './firestore.js';

let _configured = null;

function getPushConfig() {
  if (_configured) return _configured;

  const publicKey = String(process.env.VAPID_PUBLIC_KEY ?? '').trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY ?? '').trim();
  const subject = String(process.env.VAPID_SUBJECT ?? '').trim() || 'mailto:admin@example.com';

  const ready = Boolean(publicKey && privateKey);
  if (ready) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  }

  _configured = { ready, publicKey };
  return _configured;
}

export function getPublicVapidKey() {
  const cfg = getPushConfig();
  return cfg.ready ? cfg.publicKey : '';
}

function isValidSubscription(subscription) {
  if (!subscription || typeof subscription !== 'object') return false;
  const endpoint = String(subscription.endpoint ?? '').trim();
  const p256dh = String(subscription?.keys?.p256dh ?? '').trim();
  const auth = String(subscription?.keys?.auth ?? '').trim();
  return Boolean(endpoint && p256dh && auth);
}

function subscriptionIdFromEndpoint(endpoint) {
  return crypto.createHash('sha256').update(String(endpoint)).digest('base64url');
}

export async function savePushSubscription({ token, subscription, userAgent }) {
  const t = String(token ?? '').trim();
  if (!t) throw new Error('Missing token');
  if (!isValidSubscription(subscription)) throw new Error('Invalid subscription');

  const cfg = getPushConfig();
  if (!cfg.ready) return { configured: false, saved: false };

  const endpoint = String(subscription.endpoint).trim();
  const id = subscriptionIdFromEndpoint(endpoint);
  const nowIso = new Date().toISOString();

  await getFirestoreDb()
    .collection('push_subscriptions')
    .doc(id)
    .set(
      {
        token: t,
        endpoint,
        keys: {
          p256dh: String(subscription.keys.p256dh),
          auth: String(subscription.keys.auth)
        },
        userAgent: String(userAgent ?? '').trim().slice(0, 300),
        enabled: true,
        updatedAt: nowIso,
        createdAt: FieldValue.serverTimestamp(),
        lastSeenAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

  return { configured: true, saved: true };
}

export async function removePushSubscription({ token, endpoint }) {
  const t = String(token ?? '').trim();
  const ep = String(endpoint ?? '').trim();
  if (!t || !ep) throw new Error('Missing token/endpoint');

  const cfg = getPushConfig();
  if (!cfg.ready) return { configured: false, removed: false };

  const id = subscriptionIdFromEndpoint(ep);
  const ref = getFirestoreDb().collection('push_subscriptions').doc(id);

  await getFirestoreDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const data = snap.data() || {};
    const rowToken = String(data.token ?? '').trim();
    if (rowToken !== t) return;

    tx.set(
      ref,
      {
        enabled: false,
        updatedAt: new Date().toISOString(),
        disabledAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  });

  return { configured: true, removed: true };
}

export async function notifyTokenActivity({ token, title, body, url, tag, payload }) {
  const t = String(token ?? '').trim();
  if (!t) return { configured: false, sent: 0, failed: 0 };

  const cfg = getPushConfig();
  if (!cfg.ready) return { configured: false, sent: 0, failed: 0 };

  const snap = await getFirestoreDb()
    .collection('push_subscriptions')
    .where('token', '==', t)
    .where('enabled', '==', true)
    .limit(50)
    .get();

  if (snap.empty) return { configured: true, sent: 0, failed: 0 };

  const message = JSON.stringify({
    title: String(title ?? 'Actividad en tu cuenta'),
    body: String(body ?? ''),
    url: String(url ?? `/card/${t}`),
    tag: String(tag ?? 'wallet-activity'),
    data: payload && typeof payload === 'object' ? payload : {}
  });

  let sent = 0;
  let failed = 0;

  await Promise.all(
    snap.docs.map(async (doc) => {
      const data = doc.data() || {};
      const subscription = {
        endpoint: String(data.endpoint ?? ''),
        keys: {
          p256dh: String(data?.keys?.p256dh ?? ''),
          auth: String(data?.keys?.auth ?? '')
        }
      };

      if (!isValidSubscription(subscription)) {
        failed += 1;
        return;
      }

      try {
        await webpush.sendNotification(subscription, message, { TTL: 120 });
        sent += 1;
      } catch (err) {
        failed += 1;
        const statusCode = Number(err?.statusCode ?? 0);

        // Auto-disable expired subscriptions.
        if (statusCode === 404 || statusCode === 410) {
          await doc.ref.set(
            {
              enabled: false,
              updatedAt: new Date().toISOString(),
              disabledAt: FieldValue.serverTimestamp()
            },
            { merge: true }
          );
        }
      }
    })
  );

  return { configured: true, sent, failed };
}
