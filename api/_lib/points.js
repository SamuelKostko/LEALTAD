import { getFirestoreDb } from './firestore.js';

/**
 * Resolves any scheduled points that have matured for a client.
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

  const now = new Date().getTime();
  let maturedPoints = 0;
  let remainingScheduled = [];
  let hasUpdates = false;

  clientData.scheduledPoints.forEach(sp => {
    const availableTime = new Date(sp.availableAt).getTime();
    if (now >= availableTime) {
      maturedPoints += Number(sp.amount || 0);
      hasUpdates = true;
    } else {
      remainingScheduled.push(sp);
    }
  });

  if (hasUpdates) {
    const currentBalance = Number(clientData.totalPoints || 0);
    const newBalance = currentBalance + maturedPoints;
    
    // Update the database
    const db = await getFirestoreDb();
    const clientRef = db.collection('clientes').doc(clientDoc.id);
    await clientRef.update({
      totalPoints: newBalance,
      scheduledPoints: remainingScheduled,
      updatedAt: new Date().toISOString()
    });

    // Return the updated data so the calling function can use it immediately
    return {
      ...clientData,
      totalPoints: newBalance,
      scheduledPoints: remainingScheduled
    };
  }

  return clientData;
}
