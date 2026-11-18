import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root: here,
  plugins: [react()],
  resolve: { alias: { '@shared': path.resolve(here, '../shared') } },
  css: { postcss: path.join(here, 'postcss.config.cjs') },
  build: { outDir: path.join(here, 'dist'), emptyOutDir: true, chunkSizeWarningLimit: 1200 },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3077' } },
});
