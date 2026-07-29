import { getFirestoreDb } from './_lib/firestore.js';
import { sendJson, readJsonBody } from './_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  try {
    const body = await readJsonBody(req);
    const { cardNumber, clientName, amount, totalBs, originBank, originPhone, originId, reference, rate } = body || {};

    if (!cardNumber || !amount || !totalBs || !reference || !originBank || !originPhone || !originId) {
      console.error('buy-points validation error:', body);
      return sendJson(res, 400, { error: 'Missing required fields' });
    }

    const db = await getFirestoreDb();
    const purchaseRef = db.collection('pending_purchases').doc();

    const newPurchase = {
      cardNumber: String(cardNumber),
      clientName: clientName ? String(clientName) : 'Desconocido',
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

    // Notificación por correo al administrador
    const mailerSendApiKey = process.env.MAILERSEND_API_KEY;
    const mailerSendSender = process.env.MAILERSEND_SENDER_EMAIL || 'no-reply@vmaspuntos.com';
    const adminEmail = "frankelissuarez2.0@gmail.com";

    if (mailerSendApiKey) {
      const htmlContent = `
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px; padding: 20px;">
          <h2 style="color: #2563eb; text-align: center;">¡Nuevo Pago Móvil Reportado!</h2>
          <p style="font-size: 16px;">Tienes una nueva notificación de pago esperando por tu aprobación en el panel.</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 15px; line-height: 1.6;">
              <li><strong>Cliente:</strong> ${newPurchase.clientName}</li>
              <li><strong>Monto (Bs):</strong> ${newPurchase.totalBs}</li>
              <li><strong>Puntos a comprar:</strong> ${newPurchase.amount} Puntos</li>
              <li><strong>Referencia:</strong> ${newPurchase.reference}</li>
              <li><strong>Banco Origen:</strong> ${newPurchase.originBank}</li>
              <li><strong>Teléfono:</strong> ${newPurchase.originPhone}</li>
            </ul>
          </div>
          <p style="font-size: 14px; color: #666; text-align: center; margin-top: 30px;">
            Ingresa a tu panel de administración para aprobar o rechazar este pago.
          </p>
        </div>
      `;

      try {
        await fetch('https://api.mailersend.com/v1/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'Authorization': `Bearer ${mailerSendApiKey}`
          },
          body: JSON.stringify({
            from: { email: mailerSendSender, name: "V+ Puntos Sistema" },
            to: [{ email: adminEmail }],
            subject: "Pago Móvil Pendiente por Aprobación",
            html: htmlContent
          })
        });
      } catch (e) {
        console.error("Error enviando correo al administrador:", e);
      }
    }

    return sendJson(res, 200, { success: true, id: purchaseRef.id });

  } catch (err) {
    console.error('Error in buy-points handler:', err);
    return sendJson(res, 500, { error: 'Internal Server Error' });
  }
}
