import { FieldValue } from 'firebase-admin/firestore';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { getFirestoreDb } from '../_lib/firestore.js';

function normalizeUsername(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function isValidUsername(username) {
  return /^[a-z0-9_]{3,30}$/.test(username);
}

export default async function handler(req, res) {
  const firestore = getFirestoreDb();

  if (req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const token = url.searchParams.get('token');

    if (!token) {
      return sendJson(res, 400, { error: 'Token es requerido.' });
    }

    try {
      const snap = await firestore.collection('marketing_invitations')
        .where('token', '==', token)
        .where('status', '==', 'pending')
        .limit(1)
        .get();

      if (snap.empty) {
        return sendJson(res, 404, { error: 'Invitación no válida, expirada o ya utilizada.' });
      }

      const invite = snap.docs[0].data();
      return sendJson(res, 200, { 
        ok: true, 
        name: invite.name, 
        email: invite.email 
      });
    } catch (err) {
      console.error('Error fetching marketing invitation:', err);
      return sendJson(res, 500, { error: 'Error interno del servidor.' });
    }
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON body' });
    }

    const { action, token } = body;

    if (!token) {
      return sendJson(res, 400, { error: 'Token de invitación requerido.' });
    }

    try {
      const snap = await firestore.collection('marketing_invitations')
        .where('token', '==', token)
        .where('status', '==', 'pending')
        .limit(1)
        .get();

      if (snap.empty) {
        return sendJson(res, 404, { error: 'Invitación no válida, expirada o ya utilizada.' });
      }

      const inviteDoc = snap.docs[0];
      const inviteData = inviteDoc.data();
      const inviteRef = inviteDoc.ref;

      if (action === 'complete_setup') {
        const { username, password } = body;
        
        const normUsername = normalizeUsername(username);
        const normPassword = String(password ?? '').trim();

        if (!normUsername || !normPassword) {
          return sendJson(res, 400, { error: 'Usuario y contraseña son requeridos.' });
        }

        if (!isValidUsername(normUsername)) {
          return sendJson(res, 400, { error: 'Usuario inválido (3-30 caracteres, minúsculas, números o guion bajo).' });
        }

        if (normPassword.length < 6) {
          return sendJson(res, 400, { error: 'La contraseña debe tener al menos 6 caracteres.' });
        }

        // Check if username is already taken in marketing
        const existingMarketing = await firestore.collection('marketing').where('username', '==', normUsername).limit(1).get();
        if (!existingMarketing.empty) {
          return sendJson(res, 409, { error: 'Ya existe un usuario con ese nombre de usuario.' });
        }

        // Also check if admin or cashiers have it (globally unique is better)
        const existingAdmin = await firestore.collection('admins').where('username', '==', normUsername).limit(1).get();
        if (!existingAdmin.empty) {
            return sendJson(res, 409, { error: 'Nombre de usuario no disponible.' });
        }
        
        const existingCashier = await firestore.collection('cashiers').where('username', '==', normUsername).limit(1).get();
        if (!existingCashier.empty) {
            return sendJson(res, 409, { error: 'Nombre de usuario no disponible.' });
        }

        // Create the user
        const newMarketingRef = firestore.collection('marketing').doc();
        await newMarketingRef.set({
          name: inviteData.name,
          username: normUsername,
          password: normPassword, // Stored plain text for now as per system design
          role: 'marketing',
          email: inviteData.email,
          createdAt: FieldValue.serverTimestamp()
        });

        // Mark invite as used
        await inviteRef.update({
          status: 'used',
          usedAt: FieldValue.serverTimestamp()
        });

        return sendJson(res, 200, { ok: true, message: 'Cuenta creada exitosamente.' });
      }

      return sendJson(res, 400, { error: 'Acción inválida.' });

    } catch (err) {
      console.error('Error completing marketing setup:', err);
      return sendJson(res, 500, { error: 'Error interno del servidor.' });
    }
  }

  return sendJson(res, 405, { error: 'Method Not Allowed' });
}
