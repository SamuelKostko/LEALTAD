import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreDb } from '../_lib/firestore.js';
import { getPublicOrigin, sendJson } from '../_lib/http.js';

function getQrSecret() {
  return String(process.env.QR_SECRET ?? '').trim();
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function timingSafeEqualString(a, b) {
  const aa = Buffer.from(String(a ?? ''), 'utf8');
  const bb = Buffer.from(String(b ?? ''), 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const secret = getQrSecret();
  if (!secret) {
    sendJson(res, 500, { error: 'QR_SECRET not set on server' });
    return;
  }

  const url = new URL(req.url, 'http://localhost');

  const token = String(url.searchParams.get('token') ?? '').trim();
  const points = Number(url.searchParams.get('points') ?? 0);
  const ts = Number(url.searchParams.get('ts') ?? 0);
  const nonce = String(url.searchParams.get('nonce') ?? '').trim();
  const desc = String(url.searchParams.get('desc') ?? '').trim().slice(0, 120);
  const sig = String(url.searchParams.get('sig') ?? '').trim();

  if (!token) {
    sendJson(res, 400, { error: 'Missing token' });
    return;
  }

  if (!Number.isFinite(points) || points <= 0) {
    sendJson(res, 400, { error: 'Invalid points' });
    return;
  }

  if (!Number.isFinite(ts) || ts <= 0 || !nonce || !sig) {
    sendJson(res, 400, { error: 'Invalid QR parameters' });
    return;
  }

  // Basic anti-replay: only accept QRs minted recently.
  const MAX_AGE_MS = 5 * 60 * 1000;
  const age = Math.abs(Date.now() - ts);
  if (age > MAX_AGE_MS) {
    // Best-effort: mark transaction as expired if it exists and is still pending.
    try {
      const firestore = getFirestoreDb();
      const txRef = firestore.collection('transactions').doc(nonce);
      await firestore.runTransaction(async (t) => {
        const snap = await t.get(txRef);
        if (!snap.exists) return;
        const status = String(snap.data()?.status ?? '');
        if (status !== 'pending') return;
        t.set(
          txRef,
          { status: 'expired', processedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      });
    } catch {
      // Ignore.
    }

    sendJson(res, 400, { error: 'QR expired' });
    return;
  }

  const payload = `${points}|${ts}|${nonce}|${desc}`;
  const expected = sign(payload, secret);
  if (!timingSafeEqualString(sig, expected)) {
    // Helpful diagnostic: if the transaction exists and the stored signature matches
    // the QR, but the server's expected signature does not, it strongly suggests
    // QR_SECRET differs between the environment that minted the QR and this one.
    try {
      const firestore = getFirestoreDb();
      const txRef = firestore.collection('transactions').doc(nonce);
      const snap = await txRef.get();
      if (snap.exists) {
        const data = snap.data() || {};
        const status = String(data.status ?? '');
        const storedSig = String(data.sig ?? '').trim();
        if (status === 'pending' && storedSig && storedSig === sig) {
          sendJson(res, 500, {
            error: 'QR_SECRET mismatch between environments (generate and redeem must use the same deployment/env vars)'
          });
          return;
        }
      }
    } catch {
      // Ignore diagnostics failures.
    }

    sendJson(res, 403, { error: 'Invalid signature' });
    return;
  }

  const firestore = getFirestoreDb();

  // Apply redemption atomically:
  // - transaction must exist and be pending
  // - card must exist and have enough balance
  // - on success: subtract points and mark transaction success
  try {
    const result = await firestore.runTransaction(async (tx) => {
      const txRef = firestore.collection('transactions').doc(nonce);
      // We must find the client document where the 'token' field matches
      const clientQuery = firestore.collection('clientes').where('token', '==', token).limit(1);
      const clientSnap = await tx.get(clientQuery);

      if (clientSnap.empty) throw new Error('Card not found');
      const clientDoc = clientSnap.docs[0];
      const clientRef = clientDoc.ref;
      const clientData = clientDoc.data() || {};

      const txSnap = await tx.get(txRef);
      if (!txSnap.exists) throw new Error('Transaction not found');
      const txData = txSnap.data() || {};
      const status = String(txData.status ?? '');
      if (status !== 'pending') {
        throw new Error('Transaction not pending');
      }

      // Check referral bonus
      const cardRef = firestore.collection('cards').doc(token);
      const cardSnap = await tx.get(cardRef);
      const cardData = cardSnap.exists ? cardSnap.data() : {};
      
      let referralBonusPoints = 0;
      let referrerToken = null;
      
      if (cardData.referredBy && cardData.hasPaidFirstTime === false) {
        const configSnap = await tx.get(firestore.collection('config').doc('referral_settings'));
        const bonusPercent = configSnap.exists ? (configSnap.data().bonusPercent ?? 5) : 5;
        
        referralBonusPoints = Math.floor(points * (bonusPercent / 100));
        referrerToken = cardData.referredBy;
      }

      let referrerClientSnap = null;
      let referrerClientRef = null;
      let referrerClientData = null;
      if (referrerToken && referralBonusPoints > 0) {
        const referrerQuery = firestore.collection('clientes').where('token', '==', referrerToken).limit(1);
        referrerClientSnap = await tx.get(referrerQuery);
        if (!referrerClientSnap.empty) {
          const rDoc = referrerClientSnap.docs[0];
          referrerClientRef = rDoc.ref;
          referrerClientData = rDoc.data() || {};
        }
      }

      if (referrerToken) {
        // Mark as paid for the first time
        tx.update(cardRef, { hasPaidFirstTime: true, updatedAt: FieldValue.serverTimestamp() });
      }

      // Ensure the QR params match the minted transaction.
      const mintedPoints = Number(txData.points ?? 0);
      const mintedTs = Number(txData.ts ?? 0);
      const mintedSig = String(txData.sig ?? '').trim();
      const mintedDesc = String(txData.description ?? '').trim().slice(0, 120);
      if (
        !Number.isFinite(mintedPoints) ||
        mintedPoints !== points ||
        mintedTs !== ts ||
        mintedSig !== sig ||
        mintedDesc !== desc
      ) {
        throw new Error('Invalid transaction payload');
      }

      const isClosed = txData.isClosed === true;
      const merchantId = String(txData.merchantId || '').trim();

      let currentBalance = 0;
      let updateFields = {};

      if (isClosed && merchantId) {
        const settings = txData.settings || {};
        const minRedeem = Number(settings.minRedeemPoints || 0);
        if (points < minRedeem) {
          throw new Error(`El canje mínimo en este comercio es de ${minRedeem} pts`);
        }

        const balances = clientData.merchantBalances || {};
        currentBalance = Number(balances[merchantId] ?? 0);
        if (!Number.isFinite(currentBalance)) throw new Error('Invalid merchant balance');

        const next = currentBalance - points;
        if (next < 0) {
          throw new Error('Saldo insuficiente. Este es un comercio cerrado, por lo tanto los puntos acumulados aquí solo pueden ser utilizados en este mismo comercio.');
        }

        const pointsToGrant = Number(txData.pointsToGrant ?? 0);
        const finalBalance = next + pointsToGrant;

        updateFields = {
          [`merchantBalances.${merchantId}`]: finalBalance,
          updatedAt: FieldValue.serverTimestamp()
        };
        currentBalance = currentBalance; // for transaction log
        
        tx.update(clientRef, updateFields);

        // Update the pos_charge transaction to success
        tx.set(
          txRef,
          {
            status: 'success',
            token,
            balanceBefore: currentBalance,
            balanceAfter: next,
            processedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        // If there's a cashback grant (mixed payment), create the manual_credit transaction
        if (pointsToGrant > 0) {
          const creditTxRef = firestore.collection('transactions').doc();
          tx.set(creditTxRef, {
            type: 'manual_credit',
            status: 'completed',
            token: token,
            points: pointsToGrant,
            balanceBefore: next,
            balanceAfter: finalBalance,
            merchantId: merchantId,
            merchantName: txData.merchantName || '',
            branchName: txData.branchName || '',
            description: (txData.description || 'Consumo en POS') + ' (Cashback)',
            createdAt: FieldValue.serverTimestamp(),
            processedAt: FieldValue.serverTimestamp(),
            items: txData.items || [],
            totalUsd: txData.totalUsd || 0
          });
        }

      } else {
        currentBalance = Number(clientData.totalPoints ?? 0);
        if (!Number.isFinite(currentBalance)) throw new Error('Invalid balance');

        const next = currentBalance - points;
        if (next < 0) throw new Error('Insufficient balance');

        updateFields = { totalPoints: next, updatedAt: FieldValue.serverTimestamp() };

        tx.update(clientRef, updateFields);

        tx.set(
          txRef,
          {
            status: 'success',
            token,
            balanceBefore: currentBalance,
            balanceAfter: next,
            processedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      }

      // Process referral bonus if applicable
      if (referrerClientRef && referralBonusPoints > 0) {
        let rBalanceBefore = 0;
        let rBalanceAfter = 0;
        let rUpdates = {};

        if (isClosed && merchantId) {
          const rBalances = referrerClientData.merchantBalances || {};
          rBalanceBefore = Number(rBalances[merchantId] ?? 0);
          rBalanceAfter = rBalanceBefore + referralBonusPoints;
          rUpdates = {
            [`merchantBalances.${merchantId}`]: rBalanceAfter,
            updatedAt: FieldValue.serverTimestamp()
          };
        } else {
          rBalanceBefore = Number(referrerClientData.totalPoints ?? 0);
          rBalanceAfter = rBalanceBefore + referralBonusPoints;
          rUpdates = { totalPoints: rBalanceAfter, updatedAt: FieldValue.serverTimestamp() };
        }

        tx.update(referrerClientRef, rUpdates);

        // Record the referral bonus transaction
        const refTxRef = firestore.collection('transactions').doc();
        tx.set(refTxRef, {
          type: 'referral_bonus',
          status: 'completed',
          token: referrerToken,
          points: referralBonusPoints,
          balanceBefore: rBalanceBefore,
          balanceAfter: rBalanceAfter,
          merchantId: isClosed ? merchantId : '',
          merchantName: txData.merchantName || '',
          branchName: txData.branchName || '',
          description: `Bono por referido (${cardData.name || 'Usuario'})`,
          createdAt: FieldValue.serverTimestamp(),
          processedAt: FieldValue.serverTimestamp()
        });
      }

      return { 
        previous: isClosed ? currentBalance : currentBalance, 
        next: updateFields[`merchantBalances.${merchantId}`] ?? updateFields.totalPoints 
      };
    });


    sendJson(res, 200, {
      ok: true,
      token,
      points,
      description: desc,
      balance: result.next
    });
  } catch (err) {
    sendJson(res, 400, { error: err?.message ?? String(err) });
  }
}
