import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'node:crypto';
import { getFirestoreDb } from '../_lib/firestore.js';
import { getPublicOrigin, readJsonBody, sendJson, sendRedirect } from '../_lib/http.js';
import { makeToken, normalizeEmail } from '../_lib/utils.js';



async function dbProcessPurchase({ email, name, cedula, pointsToAdd, absoluteBalance, sede }) {
  const now = new Date(); // Using Date object for Firestore Timestamp compatibility
  const firestore = getFirestoreDb();
  const customerRef = firestore.collection('clientes').doc(email);

  let token = '';
  let firstActivation = false;
  const txId = crypto.randomBytes(12).toString('base64url');
  const purchaseTxRef = firestore.collection('transactions').doc(txId);

  let currentBalance = 0;
  let finalBalance = 0;
  let creditedPoints = 0;
  let balanceBefore = 0;

    // Check if the sede belongs to a registered merchant (Closed Merchant)
    let merchantId = '';
    if (sede) {
      const merchantSnap = await firestore.collection('merchants').where('branchName', '==', sede).limit(1).get();
      if (!merchantSnap.empty) {
        merchantId = merchantSnap.docs[0].id;
      }
    }

    await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(customerRef);
      const data = snap.exists ? snap.data() : null;
      const existingToken = data && typeof data.token === 'string' ? data.token : '';

      if (!existingToken) {
        token = makeToken();
        firstActivation = true;
        
        const initialBalance = absoluteBalance !== null ? absoluteBalance : (pointsToAdd || 0);
        
        const setPayload = {
          token,
          nombre: name,
          idNumber: cedula,
          email,
          totalPoints: merchantId ? 0 : initialBalance,
          sedes: sede || '',
          createdAt: now,
          updatedAt: now
        };

        if (merchantId) {
          setPayload.merchantBalances = { [merchantId]: initialBalance };
          creditedPoints = initialBalance;
          finalBalance = initialBalance;
        } else {
          creditedPoints = initialBalance;
          finalBalance = initialBalance;
        }

        tx.set(customerRef, setPayload, { merge: true });
        balanceBefore = 0;
      } else {
        token = existingToken;
        
        if (merchantId) {
          const balances = data.merchantBalances || {};
          const current = Number(balances[merchantId] ?? 0);
          balanceBefore = current;

          if (absoluteBalance !== null) {
            finalBalance = absoluteBalance;
            creditedPoints = Math.max(0, finalBalance - current);
          } else {
            creditedPoints = Math.max(0, pointsToAdd || 0);
            finalBalance = current + creditedPoints;
          }

          tx.set(
            customerRef,
            {
              nombre: name,
              idNumber: cedula,
              [`merchantBalances.${merchantId}`]: finalBalance,
              updatedAt: now
            },
            { merge: true }
          );
        } else {
          const current = Number(data.totalPoints ?? 0);
          balanceBefore = current;

          if (absoluteBalance !== null) {
            finalBalance = absoluteBalance;
            creditedPoints = Math.max(0, finalBalance - current);
          } else {
            creditedPoints = Math.max(0, pointsToAdd || 0);
            finalBalance = current + creditedPoints;
          }

          tx.set(
            customerRef,
            {
              nombre: name,
              idNumber: cedula,
              totalPoints: finalBalance,
              updatedAt: now
            },
            { merge: true }
          );
        }
      }

      // Only create a credit transaction when the balance increased.
      if (creditedPoints > 0) {
        tx.set(purchaseTxRef, {
          type: 'credit',
          status: 'success',
          token,
          points: creditedPoints,
          branchName: sede || '',
          merchantId: merchantId || '',
          description: firstActivation ? 'Activación' : 'Crédito',
          balanceBefore: balanceBefore,
          balanceAfter: finalBalance,
          createdAt: FieldValue.serverTimestamp(),
          processedAt: FieldValue.serverTimestamp()
        });
      }
    });

  return { token, firstActivation, creditedPoints, balanceBefore, balanceAfter: finalBalance };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const secret = String(process.env.WEBHOOK_SECRET ?? '').trim();
  if (secret) {
    const provided = String(req.headers['x-webhook-secret'] ?? '');
    if (provided !== secret) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }
  }

  try {
    const body = await readJsonBody(req);
    const email = normalizeEmail(body?.email);
    const name = String(body?.name ?? '').trim();
    const cedula = String(body?.cedula ?? body?.id ?? '').trim();
    
    // Support either adding points OR forcing an absolute balance
    const pointsToAdd = body?.points !== undefined ? Number(body.points) : null;
    const absoluteBalance = body?.balance !== undefined ? Number(body.balance) : null;
    const sede = String(body?.BranchName || body?.branchName || body?.sede || body?.sedes || body?.branch || '').trim();

    if (!email || !email.includes('@') || !name || !cedula || (pointsToAdd === null && absoluteBalance === null)) {
      sendJson(res, 400, { error: 'Invalid body. Expected: { email, name, cedula, and either points or balance }' });
      return;
    }

    const origin = getPublicOrigin(req);
    const { token, firstActivation, creditedPoints, balanceBefore, balanceAfter } = await dbProcessPurchase({
      email,
      name,
      cedula,
      pointsToAdd,
      absoluteBalance,
      sede
    });

    const linkPath = `/card/${token}`;
    const link = origin + linkPath;

    // Ya no enviamos tarjetas por correo
    let emailResult = { sent: false, reason: 'disabled' };



    const url = new URL(req.url, 'http://localhost');
    const wantsRedirect = url.searchParams.get('redirect') === '1';
    if (wantsRedirect) {
      sendRedirect(res, 303, linkPath);
      return;
    }

    sendJson(res, 200, { token, linkPath, link, firstActivation, email: emailResult });
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
  }
}
