import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs/promises';
import { config } from 'dotenv';
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    index: false // We will handle index manually for PWA routing
}));

// PWA Routing (Vercel.json Rewrites)
// Serve index.html for main PWA routes
const pwaRoutes = [
    '/',
    '/admin',
    '/admin/qr',
    '/card/*',
    '/go/*'
];

pwaRoutes.forEach(route => {
    app.get(route, (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });
});

// Fallback all other non-API routes to index.html to support SPA behavior
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});