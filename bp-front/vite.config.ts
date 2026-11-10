import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dev proxy. The app expects a same-origin API, which is true in production;
// locally we forward /api and /ask to the backend so cookies stay first-party.
// Set VITE_DEV_API to point at a remote instance if you have no local backend.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_DEV_API || 'http://localhost:8000';
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5174,
      proxy: {
        '/api': { target, changeOrigin: false },
        '/ask': { target, changeOrigin: false },
      },
    },
    build: { target: 'es2022' },
  };
});
