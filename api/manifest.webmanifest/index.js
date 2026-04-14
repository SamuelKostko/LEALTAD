import { send } from '../_lib/http.js';

function getTokenFromReq(req) {
  try {
    const url = new URL(req.url, 'https://vmaspuntos.com/');
    const token = String(url.searchParams.get('token') ?? '').trim();
    return token;
  } catch {
    return '';
  }
}

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }, 'Method Not Allowed');
    return;
  }

  const token = getTokenFromReq(req);

  const name = String(process.env.PWA_NAME ?? 'Wallet V+ Puntos').trim() || 'Wallet V+ Puntos';
  const shortName = String(process.env.PWA_SHORT_NAME ?? 'V+ Puntos').trim() || 'V+ Puntos';
  const description = String(process.env.PWA_DESCRIPTION ?? 'TARJETA DE FIDELIDAD V+ Puntos.').trim() || '';

  const startPath = token ? `/card/${encodeURIComponent(token)}` : '/';

  const manifest = {
    name: token ? `${name}` : name,
    short_name: shortName,
    description,
    id: startPath,
    start_url: startPath,
    scope: '/',
    display: 'standalone',
    display_override: ['fullscreen', 'standalone'],
    orientation: 'portrait-primary',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: '/icons/icon-v2.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any'
      },
      {
        src: '/icons/maskable-icon-v2.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable'
      }
    ]
  };

  send(
    res,
    200,
    {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    JSON.stringify(manifest)
  );
}
