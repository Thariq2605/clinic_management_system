import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = fileURLToPath(new URL('.', import.meta.url));
const pharmacistRoot = resolve(projectDir, '../pharmacist');
export default defineConfig({
  root: pharmacistRoot,
  publicDir: resolve(projectDir, '../assets'),
  server: {
    host: '127.0.0.1',
    port: 5503,
    strictPort: true,
    fs: { allow: [resolve(projectDir, '..')] },
  },
  build: {
    outDir: resolve(projectDir, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: [
        resolve(pharmacistRoot, 'index.html'),
        resolve(pharmacistRoot, 'auth-handoff.html'),
      ],
    },
  },
});
