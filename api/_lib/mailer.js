import nodemailer from 'nodemailer';

/**
 * Creates and returns the Nodemailer transporter for AWS SES.
 */
function getTransporter() {
  const host = process.env.AWS_SES_SMTP_HOST;
  const port = parseInt(process.env.AWS_SES_SMTP_PORT || '587', 10);
  const user = process.env.AWS_SES_SMTP_USER;
  const pass = process.env.AWS_SES_SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('Faltan credenciales de AWS SES en las variables de entorno.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user,
      pass
    }
  });
}

/**
 * Sends an email using Amazon SES via SMTP.
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content of the email
 * @param {string} [options.text] - Plain text fallback
 */
export async function sendEmailSES({ to, subject, html, text }) {
  const sender = process.env.AWS_SES_SENDER_EMAIL;

  if (!sender) {
    throw new Error('Falta la variable AWS_SES_SENDER_EMAIL en el entorno.');
  }

  const transporter = getTransporter();

  const mailOptions = {
    from: sender,
    to,
    subject,
    html,
    text
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
}
