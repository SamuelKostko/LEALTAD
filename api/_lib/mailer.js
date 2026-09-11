import nodemailer from 'nodemailer';

let sesTransporter = null;

function getSESTransporter() {
  if (sesTransporter) return sesTransporter;

  const host = process.env.AWS_SES_SMTP_HOST;
  const port = parseInt(process.env.AWS_SES_SMTP_PORT || '465', 10);
  const user = process.env.AWS_SES_SMTP_USER;
  const pass = process.env.AWS_SES_SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  sesTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });

  return sesTransporter;
}

/**
 * Send email using Amazon SES via SMTP.
 */
export async function sendEmailSES({ to, subject, html, text, fromName = 'V+ Puntos' }) {
  const senderEmail = process.env.AWS_SES_SENDER_EMAIL;
  if (!senderEmail) {
    throw new Error('Variable AWS_SES_SENDER_EMAIL no configurada.');
  }

  const transporter = getSESTransporter();
  if (!transporter) {
    throw new Error('Credenciales de AWS SES no configuradas.');
  }

  const recipients = Array.isArray(to) ? to.join(', ') : to;

  const info = await transporter.sendMail({
    from: `"${fromName}" <${senderEmail}>`,
    to: recipients,
    subject,
    html,
    text
  });

  return info;
}

/**
 * Send email using MailerSend REST API as fallback.
 */
export async function sendEmailMailerSend({ to, subject, html, fromName = 'V+ Puntos' }) {
  const apiKey = process.env.MAILERSEND_API_KEY;
  const senderEmail = process.env.MAILERSEND_SENDER_EMAIL || 'no-reply@vmaspuntos.com';

  if (!apiKey) {
    throw new Error('MAILERSEND_API_KEY no configurado.');
  }

  const rawRecipients = Array.isArray(to) ? to : [to];
  const formattedTo = rawRecipients.map(item => {
    if (typeof item === 'string') return { email: item.trim() };
    return item;
  });

  const response = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      from: { email: senderEmail, name: fromName },
      to: formattedTo,
      subject,
      html
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`MailerSend Error (${response.status}): ${errText}`);
  }

  return { ok: true, provider: 'mailersend' };
}

/**
 * Main email sender for new flows: Tries Amazon SES first, falls back to MailerSend.
 */
export async function sendEmail({ to, subject, html, text, fromName = 'V+ Puntos' }) {
  // 1. Try Amazon SES
  try {
    const sesResult = await sendEmailSES({ to, subject, html, text, fromName });
    console.log(`[Email] Enviado exitosamente vía Amazon SES a ${Array.isArray(to) ? to.join(', ') : to}`);
    return { ok: true, provider: 'amazon-ses', details: sesResult };
  } catch (sesErr) {
    console.warn(`[Email] Amazon SES falló o no está listo (${sesErr.message}). Intentando MailerSend fallback...`);
  }

  // 2. Fallback to MailerSend
  try {
    const msResult = await sendEmailMailerSend({ to, subject, html, fromName });
    console.log(`[Email] Enviado exitosamente vía MailerSend a ${Array.isArray(to) ? to.join(', ') : to}`);
    return { ok: true, provider: 'mailersend', details: msResult };
  } catch (msErr) {
    console.error(`[Email] MailerSend también falló: ${msErr.message}`);
    throw new Error(`Fallo en envío de correo (SES y MailerSend): ${msErr.message}`);
  }
}
