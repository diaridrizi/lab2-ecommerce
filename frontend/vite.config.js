import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Any request to /api is forwarded to the Express backend,
    // so the frontend can call fetch('/api/...') without CORS issues.
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
