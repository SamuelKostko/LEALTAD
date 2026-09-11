import crypto from 'node:crypto';
import { getFirestoreDb } from './firestore.js';
import { sendEmail } from './mailer.js';

let isListening = false;
const processedTxIds = new Set();

/**
 * Formats points: rounds to at most 2 decimals without trailing zeros.
 */
function formatPoints(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return '0';
  return String(Math.round(num * 100) / 100);
}

/**
 * Builds the responsive, clean white-background HTML email for physical store purchases.
 */
function buildPhysicalPurchaseEmail({ customerName, points, branchName, cedula, surveyToken }) {
  const nameDisplay = customerName ? customerName.trim() : 'Cliente';
  const ptsDisplay = formatPoints(points);
  const branchDisplay = branchName ? branchName.trim() : 'nuestra tienda';

  const surveyUrl = `https://encuestas.vmaspuntos.com/?token=${encodeURIComponent(surveyToken)}&sede=${encodeURIComponent(branchName || 'Principal')}&cedula=${encodeURIComponent(cedula || '')}`;

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>¡Puntos Acreditados! - V+ Puntos</title>
  </head>
  <body style="margin: 0; padding: 20px 10px; background-color: #f8fafc; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; -webkit-font-smoothing: antialiased;">
    <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; color: #1e293b; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);">
      
      <!-- Header con fondo blanco y Logo V+ -->
      <div style="background-color: #ffffff; padding: 28px 24px 20px; text-align: center; border-bottom: 2px solid #f1f5f9;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 900; letter-spacing: 1px; color: #0f172a;">
          V<span style="color: #f97316;">+</span> PUNTOS
        </h1>
        <p style="margin: 6px 0 0; font-size: 13px; color: #64748b; font-weight: 500;">¡Puntos acreditados por tu compra!</p>
      </div>

      <div style="padding: 28px 24px;">
        <p style="font-size: 16px; margin-top: 0; color: #0f172a;">Hola <strong>${nameDisplay}</strong>,</p>
        <p style="color: #475569; font-size: 14.5px; line-height: 1.6; margin-bottom: 24px;">
          Gracias por tu compra en <strong>${branchDisplay}</strong>. Hemos sumado los puntos correspondientes a tu cuenta:
        </p>

        <!-- Tarjeta de Puntos Ganados -->
        <div style="background-color: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 26px;">
          <span style="font-size: 12px; font-weight: 800; color: #15803d; letter-spacing: 1px; text-transform: uppercase;">Puntos Ganados en esta Compra</span>
          <h2 style="margin: 8px 0 0; font-size: 38px; color: #16a34a; font-weight: 900;">+${ptsDisplay} Pts</h2>
        </div>

        <!-- SECCIÓN ENCUESTA CON RECOMPENSA (Colores Logo V+) -->
        <div style="background-color: #fffaf5; border: 2px dashed #fdba74; border-radius: 14px; padding: 24px 20px; text-align: center;">
          <div style="display: inline-block; background-color: #ffedd5; color: #c2410c; padding: 4px 14px; border-radius: 99px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">
            🎁 ¡Gana Puntos Extra!
          </div>
          <h3 style="margin: 0 0 10px; color: #0f172a; font-size: 18px; font-weight: 800;">¿Cómo fue tu experiencia hoy?</h3>
          <p style="margin: 0 0 18px; font-size: 14px; color: #475569; line-height: 1.5;">
            Queremos brindarte siempre la mejor atención. Responde nuestra breve encuesta de 1 minuto y <strong>gana puntos adicionales</strong> en tu cuenta.
          </p>
          
          <!-- Botón Naranja V+ -->
          <div style="margin-bottom: 14px;">
            <a href="${surveyUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; font-weight: 800; font-size: 15px; padding: 14px 30px; border-radius: 10px; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35);">
              📝 Responder Encuesta y Ganar Puntos
            </a>
          </div>

          <!-- Aviso de vigencia de 24 horas y un solo uso -->
          <p style="margin: 0; font-size: 12px; color: #ea580c; font-weight: 600;">
            ⏳ Tienes 24 horas para responder la encuesta y reclamar tus puntos (enlace de un solo uso).
          </p>
        </div>

      </div>

      <!-- Footer -->
      <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9;">
        ${branchDisplay} • Mensaje automático de <strong style="color: #64748b;">V+ Puntos</strong>
      </div>

    </div>
  </body>
  </html>
  `;
}

/**
 * Initializes the real-time listener on the transactions collection for physical store credits.
 */
export function initPurchaseListener() {
  if (isListening) return;

  // Option to disable listener in develop/testing branches via environment variable
  if (process.env.DISABLE_PURCHASE_LISTENER === 'true') {
    console.log('[PurchaseListener] Listener desactivado por configuración (DISABLE_PURCHASE_LISTENER=true).');
    return;
  }

  isListening = true;

  try {
    const firestore = getFirestoreDb();
    
    // Listen to credit transactions created from now onwards (with 1 minute grace buffer)
    const listenStartTime = new Date(Date.now() - 60000);

    console.log('[PurchaseListener] Iniciando listener en tiempo real de transacciones físicas...');

    const unsubscribe = firestore
      .collection('transactions')
      .where('type', '==', 'credit')
      .where('createdAt', '>=', listenStartTime)
      .onSnapshot(async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          // Process only newly added documents
          if (change.type !== 'added') continue;

          const doc = change.doc;
          const txId = doc.id;
          const data = doc.data();

          if (processedTxIds.has(txId)) continue;
          if (data.surveyEmailSent === true || data.emailClaimed === true) {
            processedTxIds.add(txId);
            continue;
          }

          const points = Number(data.points || 0);
          if (points <= 0) continue;

          // 🛡️ BLOQUEO ATÓMICO: Evita duplicados entre entornos de Railway (develop y main)
          let claimed = false;
          try {
            claimed = await firestore.runTransaction(async (transaction) => {
              const txDoc = await transaction.get(doc.ref);
              if (!txDoc.exists) return false;
              const currentData = txDoc.data() || {};
              if (currentData.surveyEmailSent === true || currentData.emailClaimed === true) {
                return false;
              }
              transaction.update(doc.ref, {
                emailClaimed: true,
                emailClaimedAt: new Date().toISOString()
              });
              return true;
            });
          } catch (txErr) {
            console.warn(`[PurchaseListener] Error intentando bloqueo atómico para tx ${txId}:`, txErr?.message || txErr);
            claimed = false;
          }

          if (!claimed) {
            processedTxIds.add(txId);
            console.log(`[PurchaseListener] Transacción ${txId} ya fue procesada o tomada por otra instancia de Railway.`);
            continue;
          }

          processedTxIds.add(txId);

          let customerEmail = String(data.customerEmail || data.email || '').trim();
          let cedula = String(data.cedula || '').trim();
          let token = String(data.token || '').trim();
          let branchName = String(data.branchName || data.sede || '').trim();
          let customerName = '';

          // Look up client name and email if missing
          try {
            let clientDoc = null;
            if (cedula) {
              const snap = await firestore.collection('clientes').where('idNumber', '==', cedula).limit(1).get();
              if (!snap.empty) clientDoc = snap.docs[0];
            }

            if (!clientDoc && token) {
              const docRef = firestore.collection('clientes').doc(token);
              const snap = await docRef.get();
              if (snap.exists) clientDoc = snap;
            }

            if (!clientDoc && customerEmail) {
              const docRef = firestore.collection('clientes').doc(customerEmail);
              const snap = await docRef.get();
              if (snap.exists) clientDoc = snap;
            }

            if (clientDoc) {
              const cData = clientDoc.data() || {};
              customerName = String(cData.nombre || cData.name || cData.customerName || '').trim();
              if (!customerEmail) {
                customerEmail = String(cData.email || cData.customerEmail || cData.correo || '').trim();
              }
              if (!cedula) {
                cedula = String(cData.idNumber || cData.cedula || '').trim();
              }
              if (!token) {
                token = String(cData.token || '').trim();
              }
            }
          } catch (lookupErr) {
            console.warn(`[PurchaseListener] Error buscando datos del cliente para tx ${txId}:`, lookupErr);
          }

          if (!customerEmail || !customerEmail.includes('@')) {
            console.log(`[PurchaseListener] Transacción ${txId} omitida (cliente sin correo electrónico válido).`);
            continue;
          }

          // Generate single-use secure survey token (valid 24 hours)
          const surveyToken = crypto.randomBytes(16).toString('hex');
          const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 Hours

          try {
            await firestore.collection('survey_invites').doc(surveyToken).set({
              token: surveyToken,
              cedula: cedula || '',
              sede: branchName || '',
              txId: txId || '',
              customerEmail: customerEmail || '',
              customerName: customerName || '',
              used: false,
              createdAt: new Date().toISOString(),
              expiresAt: expiresAt
            });
          } catch (tokenErr) {
            console.error(`[PurchaseListener] Error creando survey_invite para tx ${txId}:`, tokenErr);
          }

          // Build email HTML & Subject
          const formattedPts = formatPoints(points);
          const emailHtml = buildPhysicalPurchaseEmail({
            customerName,
            points,
            branchName,
            cedula,
            surveyToken
          });

          console.log(`[PurchaseListener] Enviando correo de compra física (+${formattedPts} pts) a ${customerEmail}...`);

          try {
            await sendEmail({
              to: customerEmail,
              subject: `¡Ganaste ${formattedPts} puntos en tu compra! 🎉 + Gana más con tu opinión`,
              html: emailHtml,
              fromName: 'V+ Puntos'
            });

            // Mark document in Firestore so we never re-send for this transaction
            await doc.ref.update({
              surveyEmailSent: true,
              surveyEmailSentAt: new Date().toISOString(),
              surveyToken: surveyToken
            }).catch(() => null);

            console.log(`[PurchaseListener] Correo enviado y registrado exitosamente para tx ${txId}.`);
          } catch (mailErr) {
            console.error(`[PurchaseListener] Error enviando correo para tx ${txId}:`, mailErr);
          }
        }
      }, (err) => {
        console.error('[PurchaseListener] Error en el stream de Firestore snapshot:', err);
        isListening = false;
        // Reconnect after 10 seconds if disconnected
        setTimeout(() => initPurchaseListener(), 10000);
      });

    return unsubscribe;
  } catch (err) {
    console.error('[PurchaseListener] Error iniciando purchase listener:', err);
    isListening = false;
  }
}

