import { getFirestoreDb } from '../_lib/firestore.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { requireAdminOrMarketing, isStaffRequest } from '../_lib/adminAuth.js';
import crypto from 'node:crypto';

export default async function handler(req, res) {
  const db = getFirestoreDb();
  const collection = db.collection('promotions');

  try {
    // GET is public for the client app, but we can secure it if needed.
    // The user requested them to be visible to clients.
    if (req.method === 'GET') {
      const snap = await collection.orderBy('createdAt', 'desc').get();
      const promos = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || '',
          description: data.description || '',
          points: data.points || 0,
          image: data.image || '', // Base64 string or URL
          createdAt: data.createdAt || null
        };
      });
      sendJson(res, 200, { promotions: promos });
      return;
    }

    // POST, PATCH, DELETE require Admin or Marketing role
    if (!(await requireAdminOrMarketing(req, res))) return;

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const title = String(body?.title || '').trim();
      const description = String(body?.description || '').trim();
      const points = Number(body?.points || 0);
      const image = String(body?.image || '').trim();

      if (!title || !image) {
        sendJson(res, 400, { error: 'El título y la imagen son requeridos' });
        return;
      }

      const id = crypto.randomUUID();
      await collection.doc(id).set({
        title,
        description,
        points,
        image,
        createdAt: Date.now()
      });

      sendJson(res, 200, { ok: true, id });
      return;
    }

    if (req.method === 'PATCH') {
      const body = await readJsonBody(req);
      const id = String(body?.id || '').trim();
      if (!id) {
        sendJson(res, 400, { error: 'ID requerido' });
        return;
      }

      const updates = {};
      if (body.title !== undefined) updates.title = String(body.title).trim();
      if (body.description !== undefined) updates.description = String(body.description).trim();
      if (body.points !== undefined) updates.points = Number(body.points);
      if (body.image) updates.image = String(body.image).trim();
      
      if (Object.keys(updates).length > 0) {
        await collection.doc(id).update(updates);
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      const body = await readJsonBody(req);
      const id = String(body?.id || '').trim();
      if (!id) {
        sendJson(res, 400, { error: 'ID requerido' });
        return;
      }

      await collection.doc(id).delete();
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 405, { error: 'Method Not Allowed' });
  } catch (err) {
    console.error('Promotions API Error:', err);
    sendJson(res, 500, { error: 'Error interno del servidor' });
  }
}
