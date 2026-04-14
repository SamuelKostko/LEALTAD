import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs/promises';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Trust proxy headers from Railway / Render / any reverse proxy (needed so
// x-forwarded-proto is recognized and HTTPS cookies are set correctly).
app.set('trust proxy', 1);

// ── CORS ──────────────────────────────────────────────────────────────────
// Build an allowlist: the deployed origin + any local network (dev).
const ALLOWED_ORIGINS = new Set([
  // Production URL on Railway (set APP_URL env var on Railway, e.g. https://myapp.up.railway.app)
  ...(process.env.APP_URL ? [process.env.APP_URL.replace(/\/$/, '')] : []),
  // Local development variants
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    // Allow requests with no origin (e.g. mobile apps, Postman, same-origin)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.has(origin)) return callback(null, origin);
    // Also allow any local-network IP (192.168.x.x or 10.x.x.x) for mobile dev
    if (/^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin)) {
      return callback(null, origin);
    }
    // In production allow same-host requests that lack an Origin header
    callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
};

app.use(cors(corsOptions));

// Respond to ALL OPTIONS preflight requests immediately (before any limiter)
// Note: Express 5 / path-to-regexp v8 requires a regex – '*' is no longer valid.
app.options(/(.*)/, cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
   res.status(200).json({ ok: true });
});

// Configure Rate Limiter for sensitive endpoints
const authLimiter = rateLimit({
   windowMs: 15 * 60 * 1000, // 15 minutes
   max: 10, // Limit each IP to 10 requests per windowMs
   message: { error: 'Demasiados intentos, por favor intenta más tarde.' },
   standardHeaders: true,
   legacyHeaders: false,
});

// Apply limiter to auth endpoints
app.use('/api/admin/login', authLimiter);
app.use('/api/admin/forgot-password', authLimiter);

// Simulador de rutas estilo Vercel (/api/*)
async function registerApiRoutes(dirPath, basePath = '/api') {
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);

      if (file.isDirectory()) {
         // Avoid _lib folder as it's for helpers, not routes
         if (file.name !== '_lib') {
            await registerApiRoutes(fullPath, `${basePath}/${file.name}`);
         }
      } else if (file.isFile() && file.name.endsWith('.js')) {
         let routePath = basePath;
         
         // If not index.js, append the file name without extension
         if (file.name !== 'index.js') {
            let nameWithoutExt = file.name.replace('.js', '');
            
            // Convert Vercel [param] style to Express :param style
            if(nameWithoutExt.startsWith('[') && nameWithoutExt.endsWith(']')) {
               const paramName = nameWithoutExt.slice(1, -1);
               nameWithoutExt = `:${paramName}`;
            }
            
            routePath = `${basePath}/${nameWithoutExt}`;
         }

         try {
            // Import ES module dynamically
            const moduleUrl = pathToFileURL(fullPath).href;
            const module = await import(moduleUrl);
            const handler = module.default;
            
            if (typeof handler === 'function') {
               app.all(routePath, async (req, res) => {
                  try {
                     await handler(req, res);
                  } catch (err) {
                     console.error(`Error in route ${routePath}:`, err);
                     if (!res.headersSent) {
                        res.status(500).json({ error: 'Internal Server Error' });
                     }
                  }
               });
               console.log(`[API] Registered route: ${routePath}`);
            }
         } catch (importErr) {
            console.error(`Failed to load route module ${fullPath}:`, importErr);
         }
      }
    }
  } catch (err) {
     console.error('Error reading API directory:', err);
  }
}

// Inicializar funciones de api/
const apiDir = path.join(__dirname, 'api');
await registerApiRoutes(apiDir);

// Static files (CSS, JS, Images, etc)
app.use(express.static(__dirname, {
    index: false,
    setHeaders: (res, path) => {
        // Force no-cache for manifest and service worker so browser always checks for updates
        if (path.endsWith('manifest.webmanifest') || path.endsWith('service-worker.js')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// Dedicated page for QR admin flow (matches vercel.json rewrite).
app.get('/admin/qr', (_req, res) => {
   res.sendFile(path.join(__dirname, 'admin-qr.html'));
});

// PWA Routing (Vercel.json Rewrites)
// Serve index.html for main PWA routes
const pwaRoutes = [
    '/',
    '/admin',
    '/card/:id',
    '/go/:token'
];

pwaRoutes.forEach(route => {
    app.get(route, (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });
});

// Fallback all other non-API routes to index.html to support SPA behavior
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

const server = app.listen(PORT, HOST, () => {
   console.log(`Server running on http://${HOST}:${PORT}`);
});

function gracefulShutdown(signal) {
   console.log(`Received ${signal}. Closing server...`);
   server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
   });

   // Force close if something hangs.
   setTimeout(() => {
      console.error('Forced shutdown after timeout.');
      process.exit(1);
   }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));