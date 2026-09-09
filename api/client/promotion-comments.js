import { getFirestoreDb } from '../_lib/firestore.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { isAdminOrMarketingRequest } from '../_lib/adminAuth.js';
import crypto from 'node:crypto';

export default async function handler(req, res) {
  const db = getFirestoreDb();
  const commentsCollection = db.collection('promotion_comments');

  try {
    // ------------------------------------------------------------
    // GET: List comments for a given promotion
    // ------------------------------------------------------------
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const promoId = String(url.searchParams.get('promotionId') || '').trim();

      if (!promoId) {
        sendJson(res, 400, { ok: false, error: 'Se requiere el ID de la promoción' });
        return;
      }

      let snap;
      try {
        snap = await commentsCollection
          .where('promotionId', '==', promoId)
          .orderBy('createdAt', 'desc')
          .limit(50)
          .get();
      } catch (err) {
        // Fallback without orderBy index if needed
        snap = await commentsCollection
          .where('promotionId', '==', promoId)
          .limit(50)
          .get();
      }

      const comments = snap.docs
        .map(doc => {
          const data = doc.data() || {};
          return {
            id: doc.id,
            promotionId: data.promotionId || '',
            userName: data.userName || 'Cliente',
            rating: Number(data.rating || 5),
            comment: data.comment || '',
            createdAt: data.createdAt || null
          };
        })
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      const total = comments.length;
      const sumRatings = comments.reduce((sum, c) => sum + (c.rating || 5), 0);
      const averageRating = total > 0 ? Number((sumRatings / total).toFixed(1)) : 5.0;

      sendJson(res, 200, {
        ok: true,
        comments,
        stats: {
          total,
          averageRating
        }
      });
      return;
    }

    // ------------------------------------------------------------
    // POST: Create a new feedback comment for a promotion
    // ------------------------------------------------------------
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const promoId = String(body?.promotionId || '').trim();
      const commentText = String(body?.comment || '').trim();
      let userName = String(body?.userName || '').trim();
      const token = String(body?.token || '').trim();
      let rating = parseInt(body?.rating, 10);

      if (!promoId) {
        sendJson(res, 400, { ok: false, error: 'ID de la promoción requerido.' });
        return;
      }

      if (!commentText || commentText.length < 2) {
        sendJson(res, 400, { ok: false, error: 'El comentario debe tener al menos 2 caracteres.' });
        return;
      }

      if (commentText.length > 500) {
        sendJson(res, 400, { ok: false, error: 'El comentario no puede exceder 500 caracteres.' });
        return;
      }

      if (Number.isNaN(rating) || rating < 1 || rating > 5) {
        rating = 5;
      }

      // If user name is empty or generic, check token if available
      if (!userName || userName.length < 2) {
        if (token) {
          try {
            const clientSnap = await db.collection('clientes').where('token', '==', token).limit(1).get();
            if (!clientSnap.empty) {
              const cData = clientSnap.docs[0].data();
              userName = cData.nombre || cData.name || 'Cliente';
            }
          } catch (e) {
            // ignore lookup error
          }
        }
      }

      if (!userName) userName = 'Cliente';
      if (userName.length > 60) userName = userName.slice(0, 60);

      const commentId = crypto.randomUUID();
      const newComment = {
        id: commentId,
        promotionId: promoId,
        userName,
        token: token || null,
        rating,
        comment: commentText,
        createdAt: Date.now()
      };

      await commentsCollection.doc(commentId).set(newComment);

      sendJson(res, 201, {
        ok: true,
        message: 'Comentario publicado con éxito.',
        comment: newComment
      });
      return;
    }

    // ------------------------------------------------------------
    // DELETE: Delete a comment (Admin/Marketing only)
    // ------------------------------------------------------------
    if (req.method === 'DELETE') {
      const isStaff = await isAdminOrMarketingRequest(req);
      if (!isStaff) {
        sendJson(res, 401, { ok: false, error: 'No autorizado para eliminar comentarios.' });
        return;
      }

      const body = await readJsonBody(req);
      const commentId = String(body?.id || '').trim();

      if (!commentId) {
        sendJson(res, 400, { ok: false, error: 'ID del comentario requerido.' });
        return;
      }

      await commentsCollection.doc(commentId).delete();
      sendJson(res, 200, { ok: true, message: 'Comentario eliminado.' });
      return;
    }

    sendJson(res, 405, { ok: false, error: 'Método no permitido.' });
  } catch (err) {
    console.error('Promotion Comments API Error:', err);
    sendJson(res, 500, { ok: false, error: 'Error interno del servidor.' });
  }
}
