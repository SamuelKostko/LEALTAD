import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreDb } from './firestore.js';
import { sendPushToClient } from './push.js';

export const DEFAULT_BUY_POINTS_RELEASE = {
  releaseValue: 10,
  releaseUnit: 'days'
};

export const MAX_RELEASE_HOURS = 8760; // 365 days
export const MAX_RELEASE_DAYS = 365;

/**
 * Normalizes a release configuration object to valid { releaseValue, releaseUnit }.
 */
export function normalizeReleaseConfig(raw) {
  const unitRaw = String(raw?.releaseUnit || '').trim().toLowerCase();
  const releaseUnit = unitRaw === 'hours' ? 'hours' : 'days';

  const parsedVal = Number(raw?.releaseValue);
  let releaseValue = Number.isFinite(parsedVal) ? Math.max(0, Math.floor(parsedVal)) : DEFAULT_BUY_POINTS_RELEASE.releaseValue;

  const maxVal = releaseUnit === 'hours' ? MAX_RELEASE_HOURS : MAX_RELEASE_DAYS;
  if (releaseValue > maxVal) releaseValue = maxVal;

  return { releaseValue, releaseUnit };
}

/**
 * Reads the current buy-points release configuration from Firestore (`config/buy_points_settings`).
 * Falls back to 10 days if not yet configured.
 */
export async function getBuyPointsReleaseConfig(db) {
  try {
    const firestore = db || getFirestoreDb();
    const doc = await firestore.collection('config').doc('buy_points_settings').get();
    if (!doc.exists) {
      return { ...DEFAULT_BUY_POINTS_RELEASE };
    }
    return normalizeReleaseConfig(doc.data());
  } catch (err) {
    console.warn('Error reading buy_points_settings, using default:', err?.message || err);
    return { ...DEFAULT_BUY_POINTS_RELEASE };
  }
}

/**
 * Computes the Date at which points become available, or null for immediate release (0).
 */
export function computeAvailableAtDate(config, baseDate = new Date()) {
  const { releaseValue, releaseUnit } = normalizeReleaseConfig(config);
  if (releaseValue <= 0) return null;

  const multiplierMs = releaseUnit === 'hours' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return new Date(baseDate.getTime() + releaseValue * multiplierMs);
}

/**
 * Returns a short Spanish duration string (e.g. "inmediata", "2 horas", "10 días").
 */
export function formatReleaseDurationLabel(config) {
  const { releaseValue, releaseUnit } = normalizeReleaseConfig(config);
  if (releaseValue <= 0) return 'inmediata';
  if (releaseUnit === 'hours') {
    return `${releaseValue} ${releaseValue === 1 ? 'hora' : 'horas'}`;
  }
  return `${releaseValue} ${releaseValue === 1 ? 'día' : 'días'}`;
}

/**
 * Returns the Spanish terms & conditions paragraph for step 1 of buying points.
 */
export function formatReleaseTermsText(config) {
  const { releaseValue, releaseUnit } = normalizeReleaseConfig(config);
  if (releaseValue <= 0) {
    return 'Comprendo que la adquisición de puntos para ofertas con inventario limitado no garantiza la reserva del producto, el cual estará sujeto a la disponibilidad existente al momento de aprobarse y acreditarse mi saldo (acreditación inmediata).';
  }
  const unitLabel = releaseUnit === 'hours'
    ? (releaseValue === 1 ? 'hora continua' : 'horas continuas')
    : (releaseValue === 1 ? 'día continuo' : 'días continuos');
  return `Comprendo que la adquisición de puntos para ofertas con inventario limitado no garantiza la reserva del producto, el cual estará sujeto a la disponibilidad existente al momento de cumplirse mi periodo de liberación de saldo (${releaseValue} ${unitLabel}).`;
}

/**
 * Resolves any scheduled points that have matured for a client inside a transaction.
 * If any points are matured, it updates the client document and returns the new data.
 * If no updates are needed, it returns the clientData as-is.
 * 
 * @param {Object} clientDoc - The Firestore document snapshot of the client
 * @param {Object} clientData - The data of the client document
 * @returns {Promise<Object>} - The updated client data
 */
export async function resolveScheduledPoints(clientDoc, clientData) {
  if (!clientData || !clientData.scheduledPoints || !Array.isArray(clientData.scheduledPoints)) {
    return clientData;
  }

  const now = Date.now();
  const hasAnyMatured = clientData.scheduledPoints.some(sp => now >= new Date(sp.availableAt).getTime());
  if (!hasAnyMatured) {
    return clientData;
  }

  const db = getFirestoreDb();
  const clientRef = db.collection('clientes').doc(clientDoc.id);

  const txResult = await db.runTransaction(async (tx) => {
    const freshSnap = await tx.get(clientRef);
    if (!freshSnap.exists) return null;

    const freshData = freshSnap.data() || {};
    const list = Array.isArray(freshData.scheduledPoints) ? freshData.scheduledPoints : [];
    const txNow = Date.now();
    let maturedPoints = 0;
    const remainingScheduled = [];

    list.forEach(sp => {
      const availableTime = new Date(sp.availableAt).getTime();
      if (txNow >= availableTime) {
        maturedPoints += Number(sp.amount || 0);
      } else {
        remainingScheduled.push(sp);
      }
    });

    if (maturedPoints <= 0) {
      return { updated: false, data: freshData };
    }

    const currentBalance = Number(freshData.totalPoints || 0);
    const newBalance = currentBalance + maturedPoints;

    tx.update(clientRef, {
      totalPoints: newBalance,
      scheduledPoints: remainingScheduled.length > 0 ? remainingScheduled : FieldValue.delete(),
      updatedAt: new Date().toISOString()
    });

    return {
      updated: true,
      maturedPoints,
      newBalance,
      token: String(freshData.token || '').trim(),
      data: {
        ...freshData,
        totalPoints: newBalance,
        scheduledPoints: remainingScheduled
      }
    };
  });

  if (!txResult) return clientData;
  return txResult.data;
}

/**
 * Background processor that releases all matured scheduledPoints across clients
 * and notifies each client via Web Push when their points become available.
 */
export async function processAllMaturedScheduledPoints() {
  const db = getFirestoreDb();
  const snap = await db.collection('clientes').orderBy('scheduledPoints').get();
  if (snap.empty) return { processed: 0 };

  const now = Date.now();
  let processed = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    if (!Array.isArray(data.scheduledPoints) || data.scheduledPoints.length === 0) continue;

    const hasMatured = data.scheduledPoints.some(sp => now >= new Date(sp.availableAt).getTime());
    if (!hasMatured) continue;

    try {
      const clientRef = docSnap.ref;
      const txResult = await db.runTransaction(async (tx) => {
        const freshSnap = await tx.get(clientRef);
        if (!freshSnap.exists) return null;

        const freshData = freshSnap.data() || {};
        const list = Array.isArray(freshData.scheduledPoints) ? freshData.scheduledPoints : [];
        const txNow = Date.now();
        let maturedPoints = 0;
        const remainingScheduled = [];

        list.forEach(sp => {
          const availableTime = new Date(sp.availableAt).getTime();
          if (txNow >= availableTime) {
            maturedPoints += Number(sp.amount || 0);
          } else {
            remainingScheduled.push(sp);
          }
        });

        if (maturedPoints <= 0) return null;

        const currentBalance = Number(freshData.totalPoints || 0);
        const newBalance = currentBalance + maturedPoints;

        tx.update(clientRef, {
          totalPoints: newBalance,
          scheduledPoints: remainingScheduled.length > 0 ? remainingScheduled : FieldValue.delete(),
          updatedAt: new Date().toISOString()
        });

        return {
          maturedPoints,
          newBalance,
          token: String(freshData.token || '').trim()
        };
      });

      if (txResult && txResult.maturedPoints > 0) {
        processed++;
        if (txResult.token) {
          sendPushToClient(
            txResult.token,
            {
              title: '¡Tus puntos ya están disponibles!',
              body: `Se liberaron +${txResult.maturedPoints} Pts en tu saldo. Nuevo saldo: ${txResult.newBalance} Pts.`,
              tag: `points-released-${docSnap.id}`
            },
            db
          ).catch(() => null);
        }
      }
    } catch (err) {
      console.warn(`[PushScheduler] Error liberando puntos para ${docSnap.id}:`, err?.message || err);
    }
  }

  return { processed };
}
