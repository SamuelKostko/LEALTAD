import { getFirestoreDb } from './firestore.js';
import { processAllMaturedScheduledPoints } from './points.js';
import { isPushConfigured, sendPushToAllClients } from './push.js';

let started = false;
let tickRunning = false;

async function processPromotionsNotifications() {
  if (!isPushConfigured()) return;

  const db = getFirestoreDb();
  const snap = await db.collection('promotions').get();
  if (snap.empty) return;

  const now = Date.now();
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  for (const docSnap of snap.docs) {
    const promo = docSnap.data() || {};
    const title = String(promo.title || '').trim();
    if (!title) continue;

    const isSoldOut = promo.units !== undefined && Number(promo.units) <= 0;
    const isExpired = promo.expiresAt && Number(promo.expiresAt) <= now;
    if (promo.active === false || isSoldOut || isExpired) continue;

    // 1. Scheduled promotion just went live
    const startsAt = promo.startsAt ? Number(promo.startsAt) : null;
    if (startsAt && startsAt <= now && promo.startPushSent !== true) {
      try {
        const claimed = await db.runTransaction(async (tx) => {
          const fresh = await tx.get(docSnap.ref);
          if (!fresh.exists) return false;
          const d = fresh.data() || {};
          if (d.startPushSent === true) return false;
          tx.update(docSnap.ref, { startPushSent: true });
          return true;
        });

        if (claimed) {
          await sendPushToAllClients(
            {
              title: '¡Nueva promoción disponible!',
              body: `${title} por ${Number(promo.points || 0).toLocaleString('es-VE')} Pts${promo.branch ? ` en ${promo.branch}` : ''}.`,
              url: '/#promos',
              tag: `promo-start-${docSnap.id}`
            },
            db
          );
        }
      } catch (err) {
        console.warn(`[PushScheduler] Error en promo start ${docSnap.id}:`, err?.message || err);
      }
    }

    // 2. Promotion expiring within 24 hours
    const expiresAt = promo.expiresAt ? Number(promo.expiresAt) : null;
    if (
      expiresAt &&
      expiresAt > now &&
      expiresAt - now <= TWENTY_FOUR_HOURS_MS &&
      promo.expiryPushSent !== true &&
      (!startsAt || startsAt <= now)
    ) {
      try {
        const claimed = await db.runTransaction(async (tx) => {
          const fresh = await tx.get(docSnap.ref);
          if (!fresh.exists) return false;
          const d = fresh.data() || {};
          if (d.expiryPushSent === true) return false;
          tx.update(docSnap.ref, { expiryPushSent: true });
          return true;
        });

        if (claimed) {
          await sendPushToAllClients(
            {
              title: '⏳ Últimas horas de promoción',
              body: `Aprovecha "${title}" antes de que venza.`,
              url: '/#promos',
              tag: `promo-exp-${docSnap.id}`
            },
            db
          );
        }
      } catch (err) {
        console.warn(`[PushScheduler] Error en promo expiry ${docSnap.id}:`, err?.message || err);
      }
    }
  }
}

async function runTick() {
  if (tickRunning) return;
  tickRunning = true;
  try {
    await processAllMaturedScheduledPoints();
    await processPromotionsNotifications();
  } catch (err) {
    console.warn('[PushScheduler] Error en ciclo:', err?.message || err);
  } finally {
    tickRunning = false;
  }
}

export function initPushSchedulers() {
  if (started) return;
  if (process.env.DISABLE_PUSH_SCHEDULER === 'true') {
    console.log('[PushScheduler] Desactivado por configuración (DISABLE_PUSH_SCHEDULER=true).');
    return;
  }
  started = true;

  console.log('[PushScheduler] Inicializando scheduler de liberación de puntos y promociones...');
  setTimeout(() => runTick(), 8000);
  setInterval(() => runTick(), 60000);
}

