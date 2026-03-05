import 'dotenv/config';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

const DB_PATH = path.join(__dirname, 'data', 'cards.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function getDbProvider() {
  const value = String(process.env.DB_PROVIDER ?? '').trim().toLowerCase();
  return value === 'firebase' ? 'firebase' : 'local';
}

let _firestore;
function getFirestoreDb() {
  if (_firestore) return _firestore;

  const projectId = String(process.env.FIREBASE_PROJECT_ID ?? '').trim() || undefined;
  const serviceAccountJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '').trim();
  const serviceAccountPath = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? '').trim();

  let credential;
  if (serviceAccountJson) {
    const parsed = JSON.parse(serviceAccountJson);
    if (typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    credential = cert(parsed);
  } else if (serviceAccountPath) {
    const absolutePath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.join(__dirname, serviceAccountPath);
    const raw = fs.readFileSync(absolutePath, 'utf8');
    const parsed = JSON.parse(raw);
    credential = cert(parsed);
  } else {
    credential = applicationDefault();
  }

  if (!getApps().length) {
    initializeApp({ credential, projectId });
  }

  _firestore = getFirestore();
  return _firestore;
}

async function dbGetCard(token) {
  if (getDbProvider() === 'firebase') {
    const snap = await getFirestoreDb().collection('cards').doc(token).get();
    return snap.exists ? snap.data() : null;
  }

  const db = readDb();
  return db.cards?.[token] ?? null;
}

async function dbUpsertCard(token, data) {
  if (getDbProvider() === 'firebase') {
    await getFirestoreDb().collection('cards').doc(token).set(data, { merge: true });
    return;
  }

  const db = readDb();
  db.cards[token] = data;
  writeDb(db);
}

async function dbCreateCard({ name, cedula, balance }) {
  const token = makeToken();
  const now = new Date().toISOString();
  await dbUpsertCard(token, { name, cedula, balance, updatedAt: now });
  return token;
}

async function dbProcessPurchase({ email, name, cedula, balance }) {
  const now = new Date().toISOString();

  if (getDbProvider() === 'firebase') {
    const firestore = getFirestoreDb();
    const customerRef = firestore.collection('customers').doc(email);

    let token = '';
    let firstActivation = false;

    await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(customerRef);
      const data = snap.exists ? snap.data() : null;
      const existingToken = data && typeof data.token === 'string' ? data.token : '';

      if (!existingToken) {
        token = makeToken();
        firstActivation = true;
        tx.set(
          customerRef,
          {
            token,
            purchases: 1,
            activatedAt: now,
            updatedAt: now
          },
          { merge: true }
        );
      } else {
        token = existingToken;
        tx.set(
          customerRef,
          {
            purchases: FieldValue.increment(1),
            updatedAt: now
          },
          { merge: true }
        );
      }

      const cardRef = firestore.collection('cards').doc(token);
      tx.set(
        cardRef,
        {
          name,
          cedula,
          balance,
          updatedAt: now
        },
        { merge: true }
      );
    });

    return { token, firstActivation };
  }

  const db = readDb();
  const existingCustomer = db.customers[email];

  let token;
  let firstActivation = false;
  if (!existingCustomer || !existingCustomer.token) {
    token = makeToken();
    firstActivation = true;
    db.customers[email] = {
      token,
      purchases: 1,
      activatedAt: now
    };
  } else {
    token = existingCustomer.token;
    db.customers[email] = {
      ...existingCustomer,
      purchases: Number(existingCustomer.purchases ?? 0) + 1
    };
  }

  db.cards[token] = {
    name,
    cedula,
    balance,
    updatedAt: now
  };

  writeDb(db);
  return { token, firstActivation };
}

function send(res, statusCode, headers, body) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

function sendJson(res, statusCode, data) {
  send(
    res,
    statusCode,
    {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    JSON.stringify(data)
  );
}

function sendRedirect(res, statusCode, location) {
  send(res, statusCode, {
    Location: location,
    'Cache-Control': 'no-store'
  }, '');
}

function getPublicOrigin(url) {
  const configured = String(process.env.PUBLIC_ORIGIN ?? '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  return `${url.protocol}//${url.host}`;
}

function readDb() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { cards: {} };
    if (!parsed.cards || typeof parsed.cards !== 'object') parsed.cards = {};
    if (!parsed.customers || typeof parsed.customers !== 'object') parsed.customers = {};
    return parsed;
  } catch {
    return { cards: {}, customers: {} };
  }
}

function writeDb(db) {
  const dir = path.dirname(DB_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpPath, DB_PATH);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function makeToken() {
  // URL-safe token for emailed links
  return crypto.randomBytes(16).toString('base64url');
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function hasSmtpConfig() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_FROM
  );
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function linkToOrigin(link) {
  try {
    const url = new URL(String(link));
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
}

async function sendActivationEmail({ to, name, link }) {
  if (!hasSmtpConfig()) {
    console.log('[activation-email] SMTP not configured; link:', link);
    return { sent: false, reason: 'smtp_not_configured' };
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
    'Tip: Puedes añadirla a tu pantalla de inicio para abrirla como app.',
  ].join('\n');

  const greetingHtml = escapeHtml(greetingText);
  const safeLinkText = escapeHtml(link);
  const safeLinkHref = escapeHtml(link);
  const safeAppName = escapeHtml(appName);
  const safeBrandLine = escapeHtml(brandLine);
  const safeCardImageUrl = escapeHtml(cardImageUrl);
  const safeAccent = escapeHtml(accent);

  // Email clients are inconsistent; keep HTML simple and styles inline.
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
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
    html
  });

  return { sent: true };
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 500, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Internal Server Error');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

    // Development-friendly cache: always revalidate HTML/CSS/JS so UI changes show immediately.
    const cacheControl = (ext === '.html' || ext === '.css' || ext === '.js')
      ? 'no-cache'
      : 'public, max-age=3600';

    send(res, 200, {
      'Content-Type': contentType,
      'Cache-Control': cacheControl
    }, data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  let pathname = decodeURIComponent(url.pathname);

  // --- API (admin): send activation email (optionally create card) ---
  // POST /api/admin/send-activation
  // Headers: x-admin-key
  // Body:
  //   - Existing card: { to, token, name? }
  //   - Create + send: { to, name, cedula, balance }
  if (pathname === '/api/admin/send-activation') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method Not Allowed' });
      return;
    }

    const adminKey = process.env.ADMIN_KEY;
    if (!adminKey) {
      sendJson(res, 403, { error: 'ADMIN_KEY not set on server' });
      return;
    }

    const providedKey = String(req.headers['x-admin-key'] ?? '');
    if (providedKey !== adminKey) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    readJsonBody(req)
      .then(async (body) => {
        const to = normalizeEmail(body?.to);
        const tokenFromBody = String(body?.token ?? '').trim();
        const nameFromBody = String(body?.name ?? '').trim();
        const cedula = String(body?.cedula ?? body?.id ?? '').trim();
        const balance = Number(body?.balance ?? body?.points ?? 0);

        if (!to || !to.includes('@')) {
          sendJson(res, 400, { error: 'Invalid body. Expected: { to }' });
          return;
        }

        let token = tokenFromBody;
        let created = false;

        if (!token) {
          if (!nameFromBody || !cedula || !Number.isFinite(balance)) {
            sendJson(res, 400, { error: 'Missing token. Expected: { to, token } OR { to, name, cedula, balance }' });
            return;
          }
          token = await dbCreateCard({ name: nameFromBody, cedula, balance });
          created = true;
        }

        let resolvedName = nameFromBody;
        if (!resolvedName) {
          try {
            const card = await dbGetCard(token);
            if (card && typeof card.name === 'string') resolvedName = card.name;
          } catch {
            // Ignore; email can be sent without name.
          }
        }

        const origin = getPublicOrigin(url);
        const linkPath = `/card/${token}`;
        const link = origin + linkPath;

        try {
          const emailResult = await sendActivationEmail({ to, name: resolvedName, link });
          sendJson(res, 200, { ok: true, created, token, linkPath, link, email: emailResult });
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
        }
      })
      .catch(() => {
        sendJson(res, 400, { error: 'Invalid JSON body' });
      });

    return;
  }

  // --- API: redirect helper for shared links ---
  // GET /api/go/<token>  -> 302 to /card/<token>
  // GET /api/go?token=... -> same
  if (pathname === '/api/go' || pathname.startsWith('/api/go/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { error: 'Method Not Allowed' });
      return;
    }

    const tokenFromPath = pathname.startsWith('/api/go/') ? pathname.slice('/api/go/'.length) : '';
    const token = (url.searchParams.get('token') || tokenFromPath || '').trim();
    if (!token) {
      sendJson(res, 400, { error: 'Missing token' });
      return;
    }

    const location = `/card/${encodeURIComponent(token)}`;
    sendRedirect(res, 302, location);
    return;
  }

  // --- API (admin): send a test activation email ---
  if (pathname === '/api/admin/test-email') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method Not Allowed' });
      return;
    }

    const adminKey = process.env.ADMIN_KEY;
    if (!adminKey) {
      sendJson(res, 403, { error: 'ADMIN_KEY not set on server' });
      return;
    }

    const providedKey = String(req.headers['x-admin-key'] ?? '');
    if (providedKey !== adminKey) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    readJsonBody(req)
      .then(async (body) => {
        const to = normalizeEmail(body?.to);
        const name = String(body?.name ?? 'Cliente').trim();

        if (!to || !to.includes('@')) {
          sendJson(res, 400, { error: 'Invalid body. Expected: { to }' });
          return;
        }

        const origin = getPublicOrigin(url);
        const link = `${origin}/card/test-token`;

        try {
          const result = await sendActivationEmail({ to, name, link });
          sendJson(res, 200, { ok: true, ...result });
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
        }
      })
      .catch(() => {
        sendJson(res, 400, { error: 'Invalid JSON body' });
      });

    return;
  }

  // --- Webhook: first purchase activation ---
  // Body expected: { email, name, cedula, balance }
  if (pathname === '/api/webhook/purchase') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method Not Allowed' });
      return;
    }

    const secret = process.env.WEBHOOK_SECRET;
    if (secret) {
      const provided = String(req.headers['x-webhook-secret'] ?? '');
      if (provided !== secret) {
        sendJson(res, 403, { error: 'Forbidden' });
        return;
      }
    }

    readJsonBody(req)
      .then(async (body) => {
        const email = normalizeEmail(body?.email);
        const name = String(body?.name ?? '').trim();
        const cedula = String(body?.cedula ?? body?.id ?? '').trim();
        const balance = Number(body?.balance ?? body?.points ?? 0);

        if (!email || !email.includes('@') || !name || !cedula || !Number.isFinite(balance)) {
          sendJson(res, 400, { error: 'Invalid body. Expected: { email, name, cedula, balance }' });
          return;
        }

        const origin = getPublicOrigin(url);
        const { token, firstActivation } = await dbProcessPurchase({ email, name, cedula, balance });

        const linkPath = `/card/${token}`;
        const link = origin + linkPath;

        let emailResult = { sent: false };
        if (firstActivation) {
          try {
            emailResult = await sendActivationEmail({ to: email, name, link });
          } catch (err) {
            console.log('[activation-email] failed:', err?.message ?? err);
            emailResult = { sent: false, reason: 'send_failed' };
          }
        }

        const wantsRedirect = url.searchParams.get('redirect') === '1';
        if (wantsRedirect) {
          sendRedirect(res, 303, linkPath);
          return;
        }

        sendJson(res, 200, {
          token,
          linkPath,
          link,
          firstActivation,
          email: emailResult
        });
      })
      .catch(() => {
        sendJson(res, 400, { error: 'Invalid JSON body' });
      });

    return;
  }

  // --- API: per-card data ---
  if (pathname === '/api/card' || pathname.startsWith('/api/card/')) {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Method Not Allowed' });
      return;
    }

    const tokenFromPath = pathname.startsWith('/api/card/') ? pathname.slice('/api/card/'.length) : '';
    const token = (url.searchParams.get('token') || tokenFromPath || '').trim();
    if (!token) {
      sendJson(res, 400, { error: 'Missing token' });
      return;
    }

    dbGetCard(token)
      .then((card) => {
        if (!card) {
          sendJson(res, 404, { error: 'Not Found' });
          return;
        }
        sendJson(res, 200, { token, ...card });
      })
      .catch((err) => {
        sendJson(res, 500, { error: err?.message ?? String(err) });
      });

    return;
  }

  // --- API (admin): create a card + link ---
  if (pathname === '/api/admin/cards') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method Not Allowed' });
      return;
    }

    const adminKey = process.env.ADMIN_KEY;
    if (!adminKey) {
      sendJson(res, 403, { error: 'ADMIN_KEY not set on server' });
      return;
    }

    const providedKey = String(req.headers['x-admin-key'] ?? '');
    if (providedKey !== adminKey) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    readJsonBody(req)
      .then((body) => {
        const name = String(body?.name ?? '').trim();
        const cedula = String(body?.cedula ?? body?.id ?? '').trim();
        const balance = Number(body?.balance ?? body?.points ?? 0);

        if (!name || !cedula || !Number.isFinite(balance)) {
          sendJson(res, 400, { error: 'Invalid body. Expected: { name, cedula, balance }' });
          return;
        }

        dbCreateCard({ name, cedula, balance })
          .then((token) => {
            const origin = getPublicOrigin(url);
            const linkPath = `/card/${token}`;

            const wantsRedirect = url.searchParams.get('redirect') === '1';
            if (wantsRedirect) {
              sendRedirect(res, 303, linkPath);
              return;
            }

            sendJson(res, 201, { token, linkPath, link: origin + linkPath });
          })
          .catch((err) => {
            sendJson(res, 500, { error: err?.message ?? String(err) });
          });
      })
      .catch(() => {
        sendJson(res, 400, { error: 'Invalid JSON body' });
      });

    return;
  }

  if (pathname === '/') pathname = '/index.html';

  // Prevent path traversal
  const safePath = path.normalize(pathname).replace(/^([/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      serveFile(res, filePath);
      return;
    }

    // SPA fallback: serve index for unknown routes (optional but harmless)
    const indexPath = path.join(__dirname, 'index.html');
    fs.stat(indexPath, (indexErr, indexStat) => {
      if (!indexErr && indexStat.isFile()) {
        serveFile(res, indexPath);
      } else {
        send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not Found');
      }
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log('Open from your phone using: http://<YOUR-PC-IP>:' + PORT);
});
