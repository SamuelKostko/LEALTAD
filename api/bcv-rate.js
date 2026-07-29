import { getFirestoreDb } from './_lib/firestore.js';
import { sendJson } from './_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const db = await getFirestoreDb();
    const rateRef = db.collection('config').doc('bcv_rate');
    const rateDoc = await rateRef.get();
    
    const now = Date.now();
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    
    let rateData = rateDoc.exists ? rateDoc.data() : null;
    
    // Check if we need to fetch a new rate
    // Conditions: no data, or updated more than 2 hours ago
    const needsUpdate = !rateData || !rateData.updatedAt || (now - rateData.updatedAt > TWO_HOURS_MS);

    if (needsUpdate) {
      try {
        const response = await fetch("https://ve.dolarapi.com/v1/dolares/oficial");
        if (!response.ok) throw new Error("Failed to fetch from DolarAPI");
        const data = await response.json();
        
        const newRate = Number(data.promedio);
        if (newRate > 0) {
          rateData = {
            rate: newRate,
            updatedAt: now,
            formattedDate: data.fechaActualizacion ? new Date(data.fechaActualizacion).toISOString() : new Date().toISOString()
          };
          
          // Save asynchronously (no await needed for the response)
          rateRef.set(rateData, { merge: true }).catch(err => console.error("Error saving BCV rate", err));
        }
      } catch (err) {
        console.error("Error fetching BCV rate, using fallback if available:", err);
        // If we fail but have old data, we'll just return the old data instead of crashing
        if (!rateData) {
          return sendJson(res, 500, { error: 'No se pudo obtener la tasa BCV' });
        }
      }
    }

    return sendJson(res, 200, { 
      rate: rateData.rate, 
      updatedAt: rateData.updatedAt,
      cached: !needsUpdate
    });
  } catch (err) {
    console.error('Error in bcv-rate handler:', err);
    return sendJson(res, 500, { error: 'Internal Server Error' });
  }
}
