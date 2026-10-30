import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultDirectory = fileURLToPath(new URL('../../dist/', import.meta.url));
const reservedPath = pathname => /^\/(?:api|uploads)(?:\/|$)/.test(pathname);

export function serveFrontend(app, directory = defaultDirectory) {
  const root = path.resolve(directory);
  const index = path.join(root, 'index.html');
  if (!existsSync(index)) throw new Error('Frontend build missing. Run npm run build before starting with SERVE_FRONTEND=true.');

  const files = express.static(root, {
    index: false,
    dotfiles: 'deny',
    setHeaders(res, filename) {
      if (filename.startsWith(path.join(root, 'assets') + path.sep)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  });
  app.use((req, res, next) => reservedPath(req.path) ? next() : files(req, res, next));
  app.use((req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) || reservedPath(req.path)
      || path.extname(req.path) || !req.accepts('html')) return next();
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile('index.html', { root });
  });
}
