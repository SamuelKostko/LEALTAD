import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

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

function send(res, statusCode, headers, body) {
  res.writeHead(statusCode, headers);
  res.end(body);
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
