import { getFirestoreDb } from './_lib/firestore.js';
import { sendJson } from './_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const { cardNumber, amount, totalBs, originBank, originPhone, originId, reference, rate } = req.body;

    if (!cardNumber || !amount || !totalBs || !reference || !originBank || !originPhone || !originId) {
      return sendJson(res, 400, { error: 'Missing required fields' });
    }

    const db = await getFirestoreDb();
    const purchaseRef = db.collection('pending_purchases').doc();

    const newPurchase = {
      cardNumber: String(cardNumber),
      amount: Number(amount),
      totalBs: String(totalBs),
      originBank: String(originBank),
      originPhone: String(originPhone),
      originId: String(originId),
      reference: String(reference),
      rate: Number(rate),
      status: 'pending', // Can be 'pending', 'approved', 'rejected'
      createdAt: new Date().toISOString()
    };

    await purchaseRef.set(newPurchase);

    return sendJson(res, 200, { success: true, id: purchaseRef.id });

  } catch (err) {
    console.error('Error in buy-points handler:', err);
    return sendJson(res, 500, { error: 'Internal Server Error' });
  }
}
