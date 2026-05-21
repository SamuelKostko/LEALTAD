import { getFirestoreDb } from '../_lib/firestore.js';
import { sendJson, readJsonBody } from '../_lib/http.js';
import { requireAdmin } from '../_lib/adminAuth.js';
import { getReportRange, aggregateReportData } from './reports.js';

export async function sendReportEmail({ dateParam, periodParam, emailsList }) {
  // Fetch and aggregate report data
  const { start, end, dateStr } = getReportRange(dateParam, periodParam);
  const reportData = await aggregateReportData(start, end);

  // Period label formatting in Spanish
  let periodLabel = 'DIARIO';
  let dateRangeText = dateStr;
  if (periodParam === 'week') {
    periodLabel = 'SEMANAL';
    const startFmt = start.toLocaleDateString('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit' });
    const endFmt = end.toLocaleDateString('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric' });
    dateRangeText = `Semana del ${startFmt} al ${endFmt}`;
  } else if (periodParam === 'month') {
    periodLabel = 'MENSUAL';
    const monthName = start.toLocaleDateString('es-VE', { timeZone: 'America/Caracas', month: 'long', year: 'numeric' });
    dateRangeText = monthName.toUpperCase();
  } else if (periodParam === 'year') {
    periodLabel = 'ANUAL';
    dateRangeText = `Año ${start.getFullYear()}`;
  }

  // 3. Construct modern email template
  const title = `Reporte ${periodLabel} - V+ Puntos`;
  const headerColor = '#06b6d4'; // Cyan primary accent
  const successColor = '#10b981'; // Green accent
  const errorColor = '#f43f5e'; // Coral/Red accent

  // Generate table rows for Sedes
  const tableRows = reportData.branches.map(b => {
    const balanceStyle = b.balance >= 0 ? `color: ${successColor};` : `color: ${errorColor};`;
    const balanceSign = b.balance > 0 ? `+${b.balance}` : b.balance;
    return `
      <tr style="border-bottom: 1px solid #2d3748;">
        <td style="padding: 12px 10px; font-weight: bold; color: #f7fafc; text-align: left;">${b.branchName}</td>
        <td style="padding: 12px 10px; color: #e2e8f0; text-align: center;">${b.newClients}</td>
        <td style="padding: 12px 10px; color: ${successColor}; text-align: right; font-weight: 500;">+${b.pointsCredited} pts</td>
        <td style="padding: 12px 10px; color: ${errorColor}; text-align: right; font-weight: 500;">-${b.pointsRedeemed} pts</td>
        <td style="padding: 12px 10px; ${balanceStyle} text-align: right; font-weight: bold;">${balanceSign} pts</td>
      </tr>
    `;
  }).join('');

  const globalBalanceSign = reportData.totalBalance > 0 ? `+${reportData.totalBalance}` : reportData.totalBalance;
  const globalBalanceStyle = reportData.totalBalance >= 0 ? `color: ${successColor};` : `color: ${errorColor};`;

  const htmlContent = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <title>${title}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #0d0f12; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; -webkit-font-smoothing: antialiased;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0d0f12; padding: 30px 10px;">
      <tr>
        <td align="center">
          <!-- Container Table -->
          <table width="100%" max-width="600" style="max-width: 600px; width: 100%; background-color: #161920; border-radius: 16px; border: 1px solid #2d3748; border-top: 5px solid ${headerColor}; border-collapse: separate; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            
            <!-- Header -->
            <tr>
              <td style="padding: 30px 25px; text-align: center; background-color: #1a202c; border-bottom: 1px solid #2d3748;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: 1px;">
                  <span style="color: ${headerColor};">V+</span> PUNTOS
                </h1>
                <p style="margin: 5px 0 0 0; font-size: 13px; font-weight: 600; color: #a0aec0; letter-spacing: 2px;">
                  CENTRO DE REPORTES
                </p>
              </td>
            </tr>

            <!-- Report Info -->
            <tr>
              <td style="padding: 25px 25px 15px 25px; text-align: center;">
                <div style="background-color: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.2); border-radius: 99px; padding: 6px 16px; display: inline-block; margin-bottom: 12px;">
                  <span style="font-size: 11px; font-weight: bold; color: ${headerColor}; letter-spacing: 1.5px;">REPORTE ${periodLabel}</span>
                </div>
                <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">${dateRangeText}</h2>
                <p style="margin: 5px 0 0 0; font-size: 13px; color: #718096;">Generado el ${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })} (Hora de Venezuela)</p>
              </td>
            </tr>

            <!-- Metrics Grid -->
            <tr>
              <td style="padding: 10px 25px 20px 25px;">
                <table width="100%" border="0" cellspacing="10" cellpadding="0">
                  <tr>
                    <!-- New Clients -->
                    <td width="33%" style="background-color: #1a202c; border-radius: 12px; border: 1px solid #2d3748; padding: 15px; text-align: center;">
                      <span style="font-size: 11px; font-weight: 600; color: #a0aec0; display: block; text-transform: uppercase;">Nuevos Clientes</span>
                      <span style="font-size: 22px; font-weight: 800; color: #ffffff; display: block; margin-top: 5px;">${reportData.totalNewClients}</span>
                    </td>
                    <!-- Points Credited -->
                    <td width="33%" style="background-color: #1a202c; border-radius: 12px; border: 1px solid #2d3748; padding: 15px; text-align: center;">
                      <span style="font-size: 11px; font-weight: 600; color: #a0aec0; display: block; text-transform: uppercase;">Acreditados</span>
                      <span style="font-size: 20px; font-weight: 800; color: ${successColor}; display: block; margin-top: 5px;">+${reportData.totalPointsCredited}</span>
                    </td>
                    <!-- Points Redeemed -->
                    <td width="33%" style="background-color: #1a202c; border-radius: 12px; border: 1px solid #2d3748; padding: 15px; text-align: center;">
                      <span style="font-size: 11px; font-weight: 600; color: #a0aec0; display: block; text-transform: uppercase;">Canjeados</span>
                      <span style="font-size: 20px; font-weight: 800; color: ${errorColor}; display: block; margin-top: 5px;">-${reportData.totalPointsRedeemed}</span>
                    </td>
                  </tr>
                  <tr>
                    <!-- Total Balance -->
                    <td width="50%" style="background-color: #1a202c; border-radius: 12px; border: 1px solid #2d3748; padding: 15px; text-align: center;">
                      <span style="font-size: 11px; font-weight: 600; color: #a0aec0; display: block; text-transform: uppercase;">Balance del Período</span>
                      <span style="font-size: 20px; font-weight: 800; ${globalBalanceStyle} display: block; margin-top: 5px;">${globalBalanceSign} pts</span>
                    </td>
                    <!-- Total Registered overall -->
                    <td width="50%" style="background-color: #1a202c; border-radius: 12px; border: 1px solid #2d3748; padding: 15px; text-align: center;">
                      <span style="font-size: 11px; font-weight: 600; color: #a0aec0; display: block; text-transform: uppercase;">Clientes Registrados Totales</span>
                      <span style="font-size: 20px; font-weight: 800; color: #06b6d4; display: block; margin-top: 5px;">${reportData.totalClients}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Breakdown Table -->
            <tr>
              <td style="padding: 10px 25px 30px 25px;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: bold; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px; border-left: 3px solid ${headerColor}; padding-left: 8px;">Desglose por Sede</h3>
                <div style="background-color: #1a202c; border-radius: 12px; border: 1px solid #2d3748; overflow: hidden;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                    <thead>
                      <tr style="background-color: #2d3748; border-bottom: 2px solid #4a5568;">
                        <th style="padding: 10px; text-align: left; font-size: 11px; font-weight: 700; color: #a0aec0; text-transform: uppercase;">Sede</th>
                        <th style="padding: 10px; text-align: center; font-size: 11px; font-weight: 700; color: #a0aec0; text-transform: uppercase;">Clientes</th>
                        <th style="padding: 10px; text-align: right; font-size: 11px; font-weight: 700; color: #a0aec0; text-transform: uppercase;">Acreditado</th>
                        <th style="padding: 10px; text-align: right; font-size: 11px; font-weight: 700; color: #a0aec0; text-transform: uppercase;">Canjeado</th>
                        <th style="padding: 10px; text-align: right; font-size: 11px; font-weight: 700; color: #a0aec0; text-transform: uppercase;">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${tableRows || `<tr><td colspan="5" style="padding: 20px; text-align: center; color: #718096;">No hay actividad en ninguna sede durante este período.</td></tr>`}
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding: 20px 25px; background-color: #1a202c; border-top: 1px solid #2d3748; text-align: center;">
                <p style="margin: 0; font-size: 11px; color: #718096;">
                  Este es un reporte automático enviado a las direcciones autorizadas en la plataforma.
                </p>
                <p style="margin: 5px 0 0 0; font-size: 11px; color: #718096; font-weight: 600;">
                  V+ PUNTOS &copy; 2026. Todos los derechos reservados.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  // 4. Send email using MailerSend
  const mailerSendApiKey = process.env.MAILERSEND_API_KEY;
  const mailerSendSender = process.env.MAILERSEND_SENDER_EMAIL;

  const formattedRecipients = emailsList.map(email => ({ email }));

  const subjectStr = `V+ Puntos - Reporte ${periodLabel} (${dateRangeText})`;

  if (mailerSendApiKey && mailerSendSender) {
    const response = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mailerSendApiKey}`
      },
      body: JSON.stringify({
        from: {
          email: mailerSendSender,
          name: 'Centro de Reportes V+ Puntos'
        },
        to: formattedRecipients,
        subject: subjectStr,
        html: htmlContent
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('MailerSend Report Dispatch Error:', response.status, errorData);
      throw new Error(`Error al despachar correo vía MailerSend (status ${response.status}).`);
    }

    return { ok: true, sentTo: emailsList };
  } else {
    const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
    if (isProduction) {
      throw new Error('Servicio de correos (MailerSend) no configurado en producción.');
    }

    console.log('--- SIMULADOR DE ENVÍO DE REPORTES EN DESARROLLO ---');
    console.log(`Asunto: ${subjectStr}`);
    console.log(`Destinatarios: ${emailsList.join(', ')}`);
    console.log('Cuerpo HTML del Reporte Generado Exitosamente.');
    console.log('----------------------------------------------------');

    return { ok: true, devMode: true, sentTo: emailsList };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  if (!(await requireAdmin(req, res))) return;

  try {
    const body = await readJsonBody(req);
    const dateParam = body.date;
    const periodParam = String(body.period ?? 'day').trim().toLowerCase();

    // 1. Get targets from config
    const firestore = getFirestoreDb();
    const configDoc = await firestore.collection('config').doc('reports_settings').get();
    
    if (!configDoc.exists) {
      sendJson(res, 400, {
        error: 'No se han configurado destinatarios de correo para reportes.'
      });
      return;
    }

    const configData = configDoc.data() || {};
    const emailsList = configData.emailsList || [];
    
    if (!emailsList || emailsList.length === 0) {
      sendJson(res, 400, {
        error: 'No se han configurado destinatarios de correo para reportes.'
      });
      return;
    }

    const result = await sendReportEmail({ dateParam, periodParam, emailsList });
    sendJson(res, 200, result);
  } catch (err) {
    console.error('Send report error:', err);
    sendJson(res, 500, { ok: false, error: err.message || 'Internal Server Error' });
  }
}
