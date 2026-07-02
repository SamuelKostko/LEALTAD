import { getFirestoreDb } from './_lib/firestore.js';
import { readJsonBody, sendJson } from './_lib/http.js';
import crypto from 'node:crypto';

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    result += chars[randomIndex];
  }
  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const token = String(body.token || '').trim();

    if (!token) {
      sendJson(res, 400, { error: 'Missing token' });
      return;
    }

    const db = getFirestoreDb();
    
    // Find the user's card by token
    const snap = await db.collection('cards').where('token', '==', token).limit(1).get();
    
    if (snap.empty) {
      sendJson(res, 404, { error: 'Card not found' });
      return;
    }

    const doc = snap.docs[0];
    const data = doc.data();

    // If they already have a code, return it
    if (data.referralCode) {
      sendJson(res, 200, { referralCode: data.referralCode });
      return;
    }

    // Generate a unique 6-character code
    let newCode;
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 5) {
      newCode = generateCode();
      const existingSnap = await db.collection('cards').where('referralCode', '==', newCode).limit(1).get();
      if (existingSnap.empty) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new Error("Could not generate a unique referral code");
    }

    // Save to DB
    await doc.ref.update({
      referralCode: newCode,
      updatedAt: new Date()
    });

    sendJson(res, 200, { referralCode: newCode });

  } catch (err) {
    console.error('Error generating referral code:', err);
    sendJson(res, 500, { error: err?.message || 'Internal server error' });
  }
}
