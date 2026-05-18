import { FieldValue } from 'firebase-admin/firestore';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { verifySession } from '../_lib/adminAuth.js';
import { getFirestoreDb } from '../_lib/firestore.js';

function parseCookies(header) {
  const raw = String(header ?? '');
  if (!raw) return {};
  const out = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(val);
  }
  return out;
}

export default async function handler(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const auth = await verifySession(cookies['admin_session']);
  if (!auth.ok) {
    sendJson(res, 401, { error: 'No autorizado.' });
    return;
  }

  const role = String(auth.data?.role ?? '').trim().toLowerCase();
  if (role !== 'merchant') {
    sendJson(res, 403, { error: 'No autorizado. Solo comercios pueden gestionar su catálogo.' });
    return;
  }

  const merchantId = String(auth.adminId ?? '').trim();
  if (!merchantId) {
    sendJson(res, 500, { error: 'ID de comercio no encontrado en la sesión.' });
    return;
  }

  const firestore = getFirestoreDb();
  const productsColl = firestore.collection('merchants').doc(merchantId).collection('products');

  // GET: List all products
  if (req.method === 'GET') {
    try {
      const snap = await productsColl.orderBy('createdAt', 'desc').get();
      const list = [];
      snap.forEach(doc => {
        const d = doc.data();
        list.push({
          id: doc.id,
          name: d.name,
          price: Number(d.price ?? 0),
          description: d.description || '',
          createdAt: d.createdAt
        });
      });
      sendJson(res, 200, { ok: true, products: list });
    } catch (err) {
      console.error('Error fetching merchant products:', err);
      sendJson(res, 500, { error: 'Error al obtener el catálogo.' });
    }
    return;
  }

  // POST: Add new product
  if (req.method === 'POST') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    const name = String(body?.name ?? '').trim();
    const price = Number(body?.price);
    const description = String(body?.description ?? '').trim();

    if (!name || name.length > 100) {
      sendJson(res, 400, { error: 'Nombre de producto requerido (máximo 100 caracteres).' });
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      sendJson(res, 400, { error: 'Precio de producto debe ser un número igual o mayor a cero.' });
      return;
    }

    try {
      const docRef = productsColl.doc();
      await docRef.set({
        name,
        price,
        description,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      sendJson(res, 200, { ok: true, id: docRef.id, message: 'Producto agregado exitosamente.' });
    } catch (err) {
      console.error('Error creating product:', err);
      sendJson(res, 500, { error: 'Error al agregar producto.' });
    }
    return;
  }

  // PUT: Update product details
  if (req.method === 'PUT' || req.method === 'PATCH') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    const id = String(body?.id ?? '').trim();
    if (!id) {
      sendJson(res, 400, { error: 'ID de producto requerido para actualizar.' });
      return;
    }

    const updates = { updatedAt: FieldValue.serverTimestamp() };

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name || name.length > 100) {
        sendJson(res, 400, { error: 'Nombre de producto requerido.' });
        return;
      }
      updates.name = name;
    }

    if (body.price !== undefined) {
      const price = Number(body.price);
      if (!Number.isFinite(price) || price < 0) {
        sendJson(res, 400, { error: 'Precio de producto debe ser un número mayor o igual a cero.' });
        return;
      }
      updates.price = price;
    }

    if (body.description !== undefined) {
      updates.description = String(body.description || '').trim();
    }

    try {
      const docRef = productsColl.doc(id);
      const doc = await docRef.get();
      if (!doc.exists) {
        sendJson(res, 404, { error: 'Producto no encontrado.' });
        return;
      }
      await docRef.update(updates);
      sendJson(res, 200, { ok: true, message: 'Producto actualizado con éxito.' });
    } catch (err) {
      console.error('Error updating product:', err);
      sendJson(res, 500, { error: 'Error al actualizar producto.' });
    }
    return;
  }

  // DELETE: Remove product
  if (req.method === 'DELETE') {
    let body;
    let id = '';
    try {
      body = await readJsonBody(req);
      id = String(body?.id || '').trim();
    } catch {
      // Ignored
    }

    if (!id && req.url) {
      const parsedUrl = new URL(req.url, 'http://localhost');
      id = String(parsedUrl.searchParams.get('id') || '').trim();
    }

    if (!id) {
      sendJson(res, 400, { error: 'ID de producto requerido para eliminar.' });
      return;
    }

    try {
      const docRef = productsColl.doc(id);
      const doc = await docRef.get();
      if (!doc.exists) {
        sendJson(res, 404, { error: 'Producto no encontrado.' });
        return;
      }
      await docRef.delete();
      sendJson(res, 200, { ok: true, message: 'Producto eliminado con éxito.' });
    } catch (err) {
      console.error('Error deleting product:', err);
      sendJson(res, 500, { error: 'Error al eliminar producto.' });
    }
    return;
  }

  sendJson(res, 405, { error: 'Method Not Allowed' });
}
