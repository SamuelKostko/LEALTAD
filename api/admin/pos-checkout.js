import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreDb } from '../_lib/firestore.js';
import { readJsonBody, sendJson } from '../_lib/http.js';
import { verifySession } from '../_lib/adminAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  // 1. Verify session
  const cookies = (req.headers.cookie || '').split(';').reduce((acc, c) => {
    const pair = c.split('=');
    if (pair.length === 2) acc[pair[0].trim()] = decodeURIComponent(pair[1].trim());
    return acc;
  }, {});
  
  const auth = await verifySession(cookies['admin_session']);
  if (!auth.ok) {
    sendJson(res, 401, { error: 'No autorizado.' });
    return;
  }

  const role = String(auth.data?.role ?? '').trim().toLowerCase();
  if (role !== 'merchant') {
    sendJson(res, 403, { error: 'No autorizado. Solo comercios pueden procesar la caja.' });
    return;
  }

  const merchantId = String(auth.adminId ?? '').trim();
  const merchantName = String(auth.data?.name ?? '').trim();
  const merchantBranch = String(auth.data?.branchName ?? '').trim();
  if (!merchantId) {
    sendJson(res, 500, { error: 'ID de comercio no encontrado.' });
    return;
  }

  const firestore = getFirestoreDb();

  try {
    const body = await readJsonBody(req);
    const token = String(body?.token || '').trim();
    const items = body?.items || [];
    const totalUsd = Number(body?.totalUsd || 0);
    const paymentMethod = String(body?.paymentMethod || 'money').trim(); // money, points, mixed
    const usdPaidWithPoints = Number(body?.usdPaidWithPoints || 0);
    const usdPaidWithMoney = Number(body?.usdPaidWithMoney || 0);
    
    if (!token) {
      sendJson(res, 400, { error: 'Token del cliente es requerido.' });
      return;
    }
    if (totalUsd <= 0) {
      sendJson(res, 400, { error: 'El total de la venta debe ser mayor a 0.' });
      return;
    }

    // Get merchant settings to calculate conversions
    const merchantDoc = await firestore.collection('merchants').doc(merchantId).get();
    if (!merchantDoc.exists) {
      sendJson(res, 404, { error: 'Comercio no encontrado.' });
      return;
    }
    const merchantData = merchantDoc.data() || {};
    const settings = merchantData.settings || {};
    const pointsPerDollar = Number(settings.pointsPerDollar ?? 100);
    const cashbackPercent = Number(settings.cashbackPercent ?? 5);

    // Calculate required deductions and grants
    let pointsToDeduct = 0;
    let pointsToGrant = 0;

    if (paymentMethod === 'money') {
      pointsToGrant = Math.round(totalUsd * cashbackPercent);
      if (pointsToGrant <= 0) {
        // Fallback for very small amounts or 0% cashback
        pointsToGrant = 0;
      }
    } else if (paymentMethod === 'points') {
      pointsToDeduct = Math.round(totalUsd * pointsPerDollar);
      if (pointsToDeduct <= 0) {
        sendJson(res, 400, { error: 'Error al calcular los puntos a descontar.' });
        return;
      }
    } else if (paymentMethod === 'mixed') {
      if (usdPaidWithPoints <= 0 || usdPaidWithMoney <= 0) {
        sendJson(res, 400, { error: 'El pago mixto requiere montos válidos para dinero y puntos.' });
        return;
      }
      pointsToDeduct = Math.round(usdPaidWithPoints * pointsPerDollar);
      pointsToGrant = Math.round(usdPaidWithMoney * cashbackPercent);
    } else {
      sendJson(res, 400, { error: 'Método de pago inválido.' });
      return;
    }

    let description = '';
    if (items && Array.isArray(items) && items.length > 0) {
      const parts = items.map(it => `${it.quantity}x ${it.name}`);
      description = 'POS: ' + parts.join(', ');
      if (description.length > 50) {
        description = description.slice(0, 47) + '...';
      }
    } else {
      description = 'Consumo en POS';
    }

    if (pointsToDeduct > 0) {
      // Create pending transaction for QR scan
      const crypto = await import('node:crypto');
      const QRCode = (await import('qrcode')).default;
      const { getPublicOrigin } = await import('../_lib/http.js');

      const secret = String(process.env.QR_SECRET ?? '').trim();
      if (!secret) {
        sendJson(res, 500, { error: 'QR_SECRET not set on server' });
        return;
      }

      function sign(payload, s) {
        return crypto.createHmac('sha256', s).update(payload).digest('base64url');
      }

      const ts = Date.now();
      const desc = description.slice(0, 50);

      const branchName = `${merchantName} - ${merchantBranch}`.slice(0, 120);

      const isClosed = settings.isClosed !== false;
      const merchantTxData = { merchantId, merchantName, merchantBranch, isClosed, settings };

      let nonce = '';
      let sig = '';
      for (let attempt = 0; attempt < 3; attempt += 1) {
        nonce = crypto.randomBytes(12).toString('base64url');
        const payload = `${pointsToDeduct}|${ts}|${nonce}|${desc}`;
        sig = sign(payload, secret);

        const txRef = firestore.collection('transactions').doc(nonce);
        try {
          await txRef.create({
            type: 'pos_charge',
            status: 'pending',
            points: pointsToDeduct,
            pointsToGrant: pointsToGrant, // Extra field for mixed payments
            paymentMethod: paymentMethod,
            ref: '',
            description: desc,
            branchName,
            mintedById: merchantId,
            mintedByRole: role,
            ...merchantTxData,
            ts,
            nonce,
            sig,
            items: items,
            totalUsd: totalUsd,
            usdPaidWithMoney: usdPaidWithMoney,
            usdPaidWithPoints: usdPaidWithPoints,
            createdAt: FieldValue.serverTimestamp()
          });
          break;
        } catch (err) {
          if (attempt === 2) {
            sendJson(res, 500, { error: 'Failed to create transaction' });
            return;
          }
        }
      }

      const urlPath = `/api/pos/redeem?points=${encodeURIComponent(pointsToDeduct)}&ts=${encodeURIComponent(ts)}&nonce=${encodeURIComponent(nonce)}&desc=${encodeURIComponent(desc)}&sig=${encodeURIComponent(sig)}`;
      const origin = getPublicOrigin(req);
      const fullUrl = `${origin}${urlPath}`;

      let qrPngDataUrl = '';
      try {
        qrPngDataUrl = await QRCode.toDataURL(fullUrl, {
          width: 220,
          margin: 1,
          errorCorrectionLevel: 'M',
          type: 'image/png'
        });
      } catch {
        qrPngDataUrl = '';
      }

      sendJson(res, 200, { 
        ok: true, 
        message: 'QR generado.',
        url: urlPath,
        transactionId: nonce,
        qrPngDataUrl: qrPngDataUrl
      });
      return;
    }

    // Direct processing for MONEY only
    const result = await firestore.runTransaction(async (tx) => {
      const clientRef = firestore.collection('clientes').doc(token);
      let clientDoc = await tx.get(clientRef);
      
      let finalClientRef = clientRef;
      if (!clientDoc.exists) {
        const clientSnap = await tx.get(firestore.collection('clientes').where('token', '==', token).limit(1));
        if (clientSnap.empty) {
          throw new Error('Cliente no encontrado.');
        }
        clientDoc = clientSnap.docs[0];
        finalClientRef = clientDoc.ref;
      }

      const clientData = clientDoc.data() || {};
      const balances = clientData.merchantBalances || {};
      const currentBalance = Number(balances[merchantId] ?? 0);

      const finalBalance = currentBalance + pointsToGrant;

      const updateData = {
        [`merchantBalances.${merchantId}`]: finalBalance,
        updatedAt: FieldValue.serverTimestamp()
      };

      tx.update(finalClientRef, updateData);

      if (pointsToGrant > 0) {
        const creditTxRef = firestore.collection('transactions').doc();
        tx.set(creditTxRef, {
          type: 'manual_credit',
          status: 'completed',
          token: token,
          points: pointsToGrant,
          balanceBefore: currentBalance,
          balanceAfter: finalBalance,
          merchantId: merchantId,
          merchantName: merchantName,
          branchName: `${merchantName} - ${merchantBranch}`.slice(0, 120),
          description: description + ' (Cashback Venta)',
          createdAt: FieldValue.serverTimestamp(),
          processedAt: FieldValue.serverTimestamp(),
          items: items,
          totalUsd: totalUsd
        });
      }

      return {
        pointsDeducted: 0,
        pointsGranted: pointsToGrant,
        finalBalance: finalBalance
      };
    });

    sendJson(res, 200, { 
      ok: true, 
      message: 'Cobro procesado exitosamente.',
      details: result
    });
  } catch (err) {
    console.error('Error in pos-checkout:', err);
    sendJson(res, 500, { ok: false, error: err?.message || String(err) });
  }
}
