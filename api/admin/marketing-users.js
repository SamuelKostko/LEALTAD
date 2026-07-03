import { getFirestoreDb } from '../_lib/firestore.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { requireAdmin } from '../_lib/adminAuth.js';
import crypto from 'node:crypto';

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;

  const db = getFirestoreDb();
  const collection = db.collection('marketing');

  try {
    if (req.method === 'GET') {
      const snap = await collection.orderBy('createdAt', 'desc').get();
      const users = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          username: data.username || '',
          createdAt: data.createdAt || null
        };
      });
      sendJson(res, 200, { marketingUsers: users });
      return;
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const name = String(body?.name || '').trim();
      const username = String(body?.username || '').trim().toLowerCase();
      const password = String(body?.password || '').trim();

      if (!name || !username || !password) {
        sendJson(res, 400, { error: 'Nombre, usuario y contraseña son requeridos' });
        return;
      }

      // Check for duplicates
      const exists = await collection.where('username', '==', username).limit(1).get();
      if (!exists.empty) {
        sendJson(res, 400, { error: 'El nombre de usuario ya existe' });
        return;
      }

      const id = crypto.randomUUID();
      await collection.doc(id).set({
        name,
        username,
        password,
        role: 'marketing',
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
      if (body.name) updates.name = String(body.name).trim();
      if (body.password) updates.password = String(body.password).trim();
      
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
    console.error('Marketing Users API Error:', err);
    sendJson(res, 500, { error: 'Error interno del servidor' });
  }
}
