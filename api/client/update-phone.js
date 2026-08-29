import { getFirestoreDb } from '../_lib/firestore.js';
import { readJsonBody, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const body = await readJsonBody(req);
    const { token, telefono } = body || {};

    if (!token || !telefono) {
      return sendJson(res, 400, { error: 'Faltan campos requeridos.' });
    }

    const cleanTelefono = String(telefono).replace(/\D/g, '').slice(-11);
    if (cleanTelefono.length < 10) {
      return sendJson(res, 400, { error: 'Número de teléfono inválido.' });
    }

    const db = await getFirestoreDb();
    
    // Check if client exists
    let docRef = db.collection('clientes').doc(String(token));
    let docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      // Try searching by token field
      const querySnap = await db.collection('clientes').where('token', '==', String(token)).limit(1).get();
      if (!querySnap.empty) {
        docRef = querySnap.docs[0].ref;
        docSnap = querySnap.docs[0];
      } else {
        return sendJson(res, 404, { error: 'Cliente no encontrado.' });
      }
    }

    await docRef.set({ telefono: cleanTelefono }, { merge: true });

    return sendJson(res, 200, { success: true, telefono: cleanTelefono });

  } catch (err) {
    console.error('Error in update-phone handler:', err);
    return sendJson(res, 500, { error: 'Internal Server Error' });
  }
}
