import { requireAdminOrMarketing } from '../_lib/adminAuth.js';
import { getFirestoreDb } from '../_lib/firestore.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  if (!(await requireAdminOrMarketing(req, res))) return;

  const db = getFirestoreDb();

  try {
    if (req.method === 'GET') {
      const snap = await db.collection('transactions')
        .where('type', '==', 'promotion_request')
        .orderBy('createdAt', 'desc')
        .get();

      const promotions = [];
      
      const tokensToFetch = new Set();
      
      snap.forEach(doc => {
        const data = doc.data();
        if (data.token) tokensToFetch.add(data.token);
          let createdAtIso = new Date().toISOString();
          if (data.createdAt) {
            try {
              if (typeof data.createdAt.toDate === 'function') createdAtIso = data.createdAt.toDate().toISOString();
              else createdAtIso = new Date(data.createdAt).toISOString();
            } catch(e) {}
          }

          promotions.push({
          id: doc.id,
          createdAt: createdAtIso,
          token: data.token,
          description: data.description,
          points: data.points,
          promotionId: data.promotionId,
          deliveryStatus: data.deliveryStatus || 'pending',
          orderNumber: data.orderNumber || 'N/A'
        });
      });

      const clientNames = {};
      const tokensArray = Array.from(tokensToFetch);
      
      if (tokensArray.length <= 50) {
          await Promise.all(tokensArray.map(async (token) => {
             if (typeof token !== 'string' || !token.trim() || token.includes('/')) return;
             try {
               const clientSnap = await db.collection('clientes').doc(token).get();
               if (clientSnap.exists) {
                   clientNames[token] = clientSnap.data().nombre || clientSnap.data().name || token;
               } else {
                   const clientQ = await db.collection('clientes').where('token', '==', token).limit(1).get();
                   if (!clientQ.empty) {
                       clientNames[token] = clientQ.docs[0].data().nombre || clientQ.docs[0].data().name || token;
                   }
               }
             } catch (e) {
               console.error('Error fetching client name for token', token, e);
             }
          }));
      }

      promotions.forEach(p => {
          if (clientNames[p.token]) {
              p.clientName = clientNames[p.token];
          }
      });

      sendJson(res, 200, { promotions });
      return;
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      if (body.action === 'deliver' && body.id) {
        await db.collection('transactions').doc(body.id).update({
          deliveryStatus: 'delivered',
          deliveredAt: FieldValue.serverTimestamp()
        });
        sendJson(res, 200, { ok: true });
        return;
      }
      sendJson(res, 400, { error: 'Acción inválida o ID faltante' });
      return;
    }

    if (req.method === 'DELETE') {
      const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
      const id = searchParams.get('id');
      const password = searchParams.get('password');
      const refund = searchParams.get('refund') === 'true';

      if (!id || !password) {
        sendJson(res, 400, { error: 'Faltan parámetros' });
        return;
      }

      const adminPwd = process.env.ADMIN_PASSWORD;
      if (password !== adminPwd) {
        sendJson(res, 403, { error: 'Clave incorrecta' });
        return;
      }

      const txRef = db.collection('transactions').doc(id);
      
      await db.runTransaction(async (t) => {
        const txDoc = await t.get(txRef);
        if (!txDoc.exists) throw new Error("La transacción no existe");
        
        const txData = txDoc.data();
        if (txData.type !== 'promotion_request') throw new Error("Tipo de transacción inválido");
        
        if (refund && txData.token && txData.points) {
          // Refund points to client
          let clientRef = db.collection('clientes').doc(txData.token);
          let clientDoc = await t.get(clientRef);
          
          if (!clientDoc.exists) {
            const clientSnap = await t.get(db.collection('clientes').where('token', '==', txData.token).limit(1));
            if (!clientSnap.empty) {
                clientDoc = clientSnap.docs[0];
                clientRef = clientDoc.ref;
            }
          }
          
          if (clientDoc.exists) {
            const currentPoints = Number(clientDoc.data().totalPoints || 0);
            t.update(clientRef, {
              totalPoints: currentPoints + Number(txData.points),
              updatedAt: FieldValue.serverTimestamp()
            });
            
            // Also restore promotion units if applicable
            if (txData.promotionId) {
                const promoRef = db.collection('promotions').doc(txData.promotionId);
                const promoDoc = await t.get(promoRef);
                if (promoDoc.exists && promoDoc.data().units !== undefined) {
                    t.update(promoRef, {
                        units: FieldValue.increment(1)
                    });
                }
            }
          }
        }
        
        // Delete the transaction
        t.delete(txRef);
      });

      sendJson(res, 200, { ok: true, message: refund ? 'Promoción eliminada y puntos reembolsados' : 'Promoción eliminada' });
      return;
    }

    sendJson(res, 405, { error: 'Method Not Allowed' });
  } catch (err) {
    console.error('Error en redeemed-promotions API:', err);
    sendJson(res, 500, { error: err.message || 'Error del servidor' });
  }
}
