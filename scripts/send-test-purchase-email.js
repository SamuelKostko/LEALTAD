import { config } from 'dotenv';
config();

import { sendEmail } from '../api/_lib/mailer.js';

function formatPoints(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return '0';
  return String(Math.round(num * 100) / 100);
}

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
    <title>Notificación de Puntos - V+ Puntos</title>
  </head>
  <body style="margin: 0; padding: 20px 10px; background-color: #f8fafc; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; -webkit-font-smoothing: antialiased;">
    <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; color: #1e293b; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);">
      
      <!-- Header con fondo blanco y Logo V+ -->
      <div style="background-color: #ffffff; padding: 28px 24px 20px; text-align: center; border-bottom: 2px solid #f1f5f9;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 900; letter-spacing: 1px; color: #0f172a;">
          V<span style="color: #f97316;">+</span> PUNTOS
        </h1>
        <p style="margin: 6px 0 0; font-size: 13px; color: #64748b; font-weight: 500;">Resumen de acreditación de puntos</p>
      </div>

      <div style="padding: 28px 24px;">
        <p style="font-size: 16px; margin-top: 0; color: #0f172a;">Hola <strong>${nameDisplay}</strong>,</p>
        <p style="color: #475569; font-size: 14.5px; line-height: 1.6; margin-bottom: 24px;">
          Gracias por tu compra en <strong>${branchDisplay}</strong>. Hemos sumado los puntos correspondientes a tu cuenta:
        </p>

        <!-- Tarjeta de Puntos Acreditados -->
        <div style="background-color: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 26px;">
          <span style="font-size: 12px; font-weight: 800; color: #15803d; letter-spacing: 1px; text-transform: uppercase;">Puntos Acreditados</span>
          <h2 style="margin: 8px 0 0; font-size: 38px; color: #16a34a; font-weight: 900;">+${ptsDisplay} Pts</h2>
        </div>

        <!-- SECCIÓN ENCUESTA Y CALIFICACIÓN -->
        <div style="background-color: #fffaf5; border: 2px dashed #fdba74; border-radius: 14px; padding: 24px 20px; text-align: center;">
          <div style="display: inline-block; background-color: #ffedd5; color: #c2410c; padding: 4px 14px; border-radius: 99px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">
            ⭐ Calificación de Servicio
          </div>
          <h3 style="margin: 0 0 10px; color: #0f172a; font-size: 18px; font-weight: 800;">¿Cómo fue tu atención hoy?</h3>
          <p style="margin: 0 0 18px; font-size: 14px; color: #475569; line-height: 1.5;">
            Queremos brindarte siempre el mejor servicio. Completa una breve valoración de 1 minuto y recibe una bonificación en tu cuenta.
          </p>
          
          <!-- Botón Naranja V+ -->
          <div style="margin-bottom: 14px;">
            <a href="${surveyUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; font-weight: 800; font-size: 15px; padding: 14px 30px; border-radius: 10px; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35);">
              📝 Valorar Atención en Tienda
            </a>
          </div>

          <!-- Aviso de vigencia de 24 horas y un solo uso -->
          <p style="margin: 0; font-size: 12px; color: #ea580c; font-weight: 600;">
            ⏳ Enlace disponible por 24 horas para registrar tu opinión (un solo uso).
          </p>
        </div>

      </div>

      <!-- Footer -->
      <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9;">
        ${branchDisplay} • Notificación automática de <strong style="color: #64748b;">V+ Puntos</strong>
      </div>

    </div>
  </body>
  </html>
  `;
}

async function run() {
  const targetEmail = 'kostkosamuel43@gmail.com';
  console.log(`Enviando correo de prueba a ${targetEmail}...`);

  const html = buildPhysicalPurchaseEmail({
    customerName: 'Samuel Kostko',
    points: 25.50,
    branchName: 'Sede Principal',
    cedula: '28123456',
    surveyToken: 'demo_test_token_24h'
  });

  const textContent = `Hola ${'Samuel Kostko'},\n\nGracias por tu compra en Sede Principal. Hemos acreditado +25.50 Pts a tu cuenta de V+ Puntos.\n\nQueremos conocer tu experiencia: responde nuestra breve encuesta de 1 minuto aquí: https://encuestas.vmaspuntos.com/?token=demo_test_token_24h&sede=Sede+Principal&cedula=28123456\n\nSaludos,\nEquipo V+ Puntos`;

  const res = await sendEmail({
    to: targetEmail,
    subject: 'Notificacion V+ Puntos',
    html,
    text: textContent,
    fromName: 'V+ Puntos'
  });

  console.log('Resultado del envío:', res);
}

run().catch(err => {
  console.error('Error enviando prueba:', err);
  process.exit(1);
});
