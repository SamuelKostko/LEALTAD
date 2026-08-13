import { getFirestoreDb } from '../_lib/firestore.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { requireAdminOrMarketing } from '../_lib/adminAuth.js';
import crypto from 'node:crypto';

export default async function handler(req, res) {
  const db = getFirestoreDb();
  const collection = db.collection('promotions');

  try {
    if (req.method === 'GET') {
      const now = Date.now();
      const url = new URL(req.url, 'http://localhost');
      const isAdmin = url.searchParams.get('admin') === '1';
      
      const snap = await collection.orderBy('createdAt', 'desc').get();
      let promos = snap.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || '',
            description: data.description || '',
            branch: data.branch || '',
            points: data.points || 0,
            realPrice: data.realPrice || 0,
            units: data.units || 0,
            maxPerUser: data.maxPerUser || 0,
            image: data.image || '',
            expiresAt: data.expiresAt || null,
            createdAt: data.createdAt || null
          };
        });
        
      if (!isAdmin) {
        promos = promos.filter(p => !p.expiresAt || p.expiresAt > now);
      }
      
      sendJson(res, 200, { promotions: promos });
      return;
    }

    // POST, PATCH, DELETE require Admin or Marketing role
    if (!(await requireAdminOrMarketing(req, res))) return;

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const title = String(body?.title || '').trim();
      const description = String(body?.description || '').trim();
      const branch = String(body?.branch || '').trim();
      const points = Number(body?.points || 0);
      const realPrice = Number(body?.realPrice || 0);
      const units = Number(body?.units || 0);
      const maxPerUser = Number(body?.maxPerUser || 0);
      const image = String(body?.image || '').trim();
      const expiresAt = body?.expiresAt ? Number(body.expiresAt) : null;

      if (!title || !image) {
        sendJson(res, 400, { error: 'El título y la imagen son requeridos' });
        return;
      }

      const id = crypto.randomUUID();
      const docData = {
        title,
        description,
        branch,
        points,
        realPrice,
        units,
        maxPerUser,
        image,
        createdAt: Date.now()
      };
      if (expiresAt) docData.expiresAt = expiresAt;

      await collection.doc(id).set(docData);
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
      if (body.branch !== undefined) updates.branch = String(body.branch).trim();
      if (body.points !== undefined) updates.points = Number(body.points);
      if (body.realPrice !== undefined) updates.realPrice = Number(body.realPrice);
      if (body.units !== undefined) updates.units = Number(body.units);
      if (body.maxPerUser !== undefined) updates.maxPerUser = Number(body.maxPerUser);
      if (body.image) updates.image = String(body.image).trim();
      if (body.expiresAt !== undefined) updates.expiresAt = body.expiresAt ? Number(body.expiresAt) : null;
      
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
