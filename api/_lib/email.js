import nodemailer from 'nodemailer';
import { escapeHtml, linkToOrigin, normalizeEmail } from './utils.js';

function getSmtpFrom() {
  const fromRaw = String(process.env.SMTP_FROM ?? '').trim();
  if (fromRaw) return fromRaw;

  const fromEmail = String(process.env.SMTP_FROM_EMAIL ?? '').trim();
  if (!fromEmail) return '';

  const fromName = String(process.env.SMTP_FROM_NAME ?? '').trim();
  if (fromName) return { name: fromName, address: fromEmail };
  return fromEmail;
}

function hasSmtpConfig() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    getSmtpFrom()
  );
}

export async function sendActivationEmail({ to, name, link }) {
  if (!hasSmtpConfig()) {
    console.log('[activation-email] SMTP not configured; link:', link);
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const from = getSmtpFrom();
  if (!from) return { sent: false, reason: 'smtp_from_missing' };

  const smtpUser = String(process.env.SMTP_USER ?? '').trim();
  const fromString = typeof from === 'string' ? from : String(from.address ?? '');
  if (smtpUser && fromString && normalizeEmail(fromString) !== normalizeEmail(smtpUser)) {
    console.log('[activation-email] Warning: SMTP_FROM differs from SMTP_USER. Ensure your provider allows this and SPF/DKIM are configured.');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const subject = 'Tu tarjeta de puntos (instala la app)';
  const safeName = name ? String(name).trim() : '';
  const greetingText = safeName ? `Hola ${safeName},` : 'Hola,';

  const origin = linkToOrigin(link);
  const appName = String(process.env.EMAIL_BRAND_NAME ?? 'Tu tarjeta').trim() || 'Tu tarjeta';
  const brandLine = origin ? origin.replace(/^https?:\/\//, '') : 'web';

  const cardImageUrl = origin ? `${origin}/images/card-cliente.png` : '';

  const accent = String(process.env.EMAIL_ACCENT_COLOR ?? '#2563eb').trim() || '#2563eb';
  const dark = '#0b1220';

  const text = [
    greetingText,
    '',
    'Aquí está tu tarjeta:',
    link,
    '',
    'Tip: Puedes añadirla a tu pantalla de inicio para abrirla como app.'
  ].join('\n');

  const greetingHtml = escapeHtml(greetingText);
  const safeLinkText = escapeHtml(link);
  const safeLinkHref = escapeHtml(link);
  const safeAppName = escapeHtml(appName);
  const safeBrandLine = escapeHtml(brandLine);
  const safeCardImageUrl = escapeHtml(cardImageUrl);
  const safeAccent = escapeHtml(accent);

  const preheader = 'Tu tarjeta está lista. Toca la tarjeta para abrir.';
  const html = `
  <div style="margin:0;padding:0;background:#f3f4f6;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(preheader)}
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#f3f4f6;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%;max-width:560px;border-collapse:separate;">
            <tr>
              <td style="padding:0 0 12px 0;">
                <div style="background:${dark};border-radius:18px;padding:16px 18px;border:1px solid rgba(255,255,255,0.08);">
                  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.2;">
                    <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.72);">${safeBrandLine}</div>
                    <div style="font-size:20px;font-weight:800;color:#ffffff;margin-top:6px;">${safeAppName}</div>
                    <div style="margin-top:12px;height:4px;width:56px;background:${safeAccent};border-radius:999px;"></div>
                  </div>
                </div>
              </td>
            </tr>

            <tr>
              <td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;padding:22px;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.55;color:#111827;font-size:16px;">
                  <p style="margin:0 0 12px 0;font-size:18px;font-weight:800;">${greetingHtml}</p>
                  <p style="margin:0 0 16px 0;color:#374151;">Aquí tienes tu tarjeta. Tócala para abrirla.</p>

                  <div style="margin:0 0 16px 0;">
                    <a href="${safeLinkHref}" style="text-decoration:none;display:block;">
                      <div style="border-radius:20px;overflow:hidden;border:1px solid #e5e7eb;background:#111827;box-shadow:0 10px 30px rgba(0,0,0,0.12);">
                        ${cardImageUrl
                          ? `<img src=\"${safeCardImageUrl}\" width=\"520\" alt=\"Tu tarjeta\" style=\"display:block;width:100%;max-width:520px;height:auto;\"/>`
                          : `<div style=\"padding:22px;color:#ffffff;font-size:16px;font-weight:700;\">Abrir mi tarjeta</div>`
                        }
                      </div>
                    </a>
                  </div>

                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
                    <tr>
                      <td style="background:${safeAccent};border-radius:12px;">
                        <a href="${safeLinkHref}" style="display:inline-block;padding:12px 16px;font-weight:800;font-size:15px;color:#ffffff;text-decoration:none;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">Abrir tarjeta</a>
                      </td>
                      <td style="padding-left:12px;font-size:13px;color:#6b7280;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
                        Si no ves la imagen, abre el link:<br/>
                        <a href="${safeLinkHref}" style="color:#111827;text-decoration:underline;word-break:break-all;">${safeLinkText}</a>
                      </td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:12px 4px 0 4px;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.45;font-size:12px;color:#9ca3af;">
                  Si no solicitaste esta tarjeta, puedes ignorar este correo.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
  `;

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html
  });

  return { sent: true };
}
