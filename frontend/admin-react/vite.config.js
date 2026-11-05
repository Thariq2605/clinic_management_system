import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharedFiles = new Map([
  ['/login.html', path.join(frontendRoot, 'login.html')],
  ['/js/api.js', path.join(frontendRoot, 'js/api.js')],
  ['/js/common.js', path.join(frontendRoot, 'js/common.js')],
  ['/js/auth.js', path.join(frontendRoot, 'js/auth.js')],
  ['/css/style.css', path.join(frontendRoot, 'css/style.css')],
  ['/css/login.css', path.join(frontendRoot, 'css/login.css')],
  ['/assets/favicon.svg', path.join(frontendRoot, 'assets/favicon.svg')],
]);

function existingSharedLogin() {
  return {
    name: 'serve-existing-shared-login',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url || '/', 'http://localhost').pathname;
        const file = sharedFiles.get(pathname);
        if (!file || req.method !== 'GET') return next();
        try {
          const content = await readFile(file);
          const ext = path.extname(file);
          res.statusCode = 200;
          res.setHeader('Content-Type', ext === '.html' ? 'text/html; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : ext === '.svg' ? 'image/svg+xml' : 'text/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(content);
        } catch (error) { next(error); }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), existingSharedLogin()],
  server: { host: '127.0.0.1', port: 5502, strictPort: true },
});
