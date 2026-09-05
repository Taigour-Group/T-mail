import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, proxy API + auth to the tmail server so the browser stays same-origin
// (no CORS, cookies "just work"). In production, put both behind one origin and
// route /api, /auth, /health to the server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5273,
    proxy: {
      '/api': { target: 'http://localhost:4100', changeOrigin: true },
      '/auth': { target: 'http://localhost:4100', changeOrigin: true },
      '/health': { target: 'http://localhost:4100', changeOrigin: true },
    },
  },
});
