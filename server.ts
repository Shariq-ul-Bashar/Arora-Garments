import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { db, initDatabase } from './server/db.ts';
import { seedDatabase } from './server/seed.ts';
import { attachAuthContext } from './server/auth.ts';
import authRoutes from './server/routes/authRoutes.ts';
import storeRoutes from './server/routes/storeRoutes.ts';
import adminRoutes from './server/routes/adminRoutes.ts';

function resolveOrigin(req: express.Request): string {
  const envOrigin = process.env.APP_URL;
  const raw =
    envOrigin && !envOrigin.includes('MY_APP_URL')
      ? envOrigin
      : `${req.protocol}://${req.get('host')}`;
  return raw.replace(/\/+$/, '');
}

async function startServer() {
  initDatabase();
  seedDatabase();

  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(attachAuthContext);

  // Serve uploaded product/banner images cleanly
  app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));

  // Liveness & database health check for hosting & uptime monitors
  app.get('/api/health', (_req, res) => {
    try {
      db.prepare('SELECT 1').get();
      return res.json({
        ok: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
      });
    } catch {
      return res.status(503).json({
        ok: false,
        status: 'unhealthy',
      });
    }
  });

  // Dynamic XML Sitemap & Robots.txt for SEO
  app.get('/robots.txt', (req, res) => {
    const origin = resolveOrigin(req);
    res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${origin}/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', (req, res) => {
    const origin = resolveOrigin(req);
    const staticPaths = [
      '/', '/products', '/mens-wear', '/womens-wear', '/kids-wear', '/footwear',
      '/new-arrivals', '/trending', '/best-sellers', '/seasonal', '/track-order',
      '/about', '/how-to-order', '/contact', '/store-location', '/faq',
      '/shipping-policy', '/return-policy', '/privacy-policy', '/terms',
    ];
    const products = db.prepare('SELECT slug, updated_at FROM products WHERE is_published = 1 AND is_archived = 0').all() as Array<{ slug: string; updated_at: string }>;
    const categories = db.prepare('SELECT slug FROM categories WHERE is_active = 1').all() as Array<{ slug: string }>;

    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const urls = [
      ...staticPaths.map((p) => `<url><loc>${esc(origin + p)}</loc><changefreq>weekly</changefreq></url>`),
      ...categories.map((c) => `<url><loc>${esc(`${origin}/category/${c.slug}`)}</loc><changefreq>weekly</changefreq></url>`),
      ...products.map((p) => `<url><loc>${esc(`${origin}/product/${p.slug}`)}</loc><lastmod>${(p.updated_at || '').slice(0, 10)}</lastmod></url>`),
    ];

    res
      .type('application/xml')
      .send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`);
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api', storeRoutes);
  app.use('/api/admin', adminRoutes);

  // Unknown /api/* routes return JSON 404 instead of SPA index.html
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // Global API error handler
  app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON request payload' });
    }
    console.error('API Error:', err);
    const status = typeof err?.status === 'number' && err.status >= 400 ? err.status : 500;
    const message = status < 500 || process.env.NODE_ENV !== 'production' ? (err?.message || 'Internal server error') : 'Internal server error';
    return res.status(status).json({ error: message });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    const indexHtml = path.join(distPath, 'index.html');
    app.use(
      express.static(distPath, {
        maxAge: '7d',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      if (!fs.existsSync(indexHtml)) {
        return res.status(503).send('Application build not found. Run npm run build first.');
      }
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(indexHtml);
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`ARORA GARMENTS running at http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`);
  });

  const shutdown = () => {
    server.close(() => {
      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
        db.close();
      } catch {
        // Ignore close errors during exit
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
