export function send(res, statusCode, headers, body) {
  res.statusCode = statusCode;
  for (const [key, value] of Object.entries(headers || {})) {
    res.setHeader(key, value);
  }
  res.end(body);
}

export function sendJson(res, statusCode, data) {
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

export function sendRedirect(res, statusCode, location) {
  send(
    res,
    statusCode,
    {
      Location: location,
      'Cache-Control': 'no-store'
    },
    ''
  );
}

export function readJsonBody(req) {
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

export function getPublicOrigin(req) {
  const configured = String(process.env.PUBLIC_ORIGIN ?? '').trim();
  if (configured) return configured.replace(/\/+$/, '');

  const proto = String(req.headers['x-forwarded-proto'] ?? 'http');
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost');
  return `${proto}://${host}`;
}
