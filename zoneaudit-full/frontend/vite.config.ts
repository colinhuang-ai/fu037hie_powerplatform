import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev the SPA runs on :5173 and proxies /api to the backend, so cookies stay same-origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: false } },
  },
});
