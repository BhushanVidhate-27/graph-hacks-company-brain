import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Allow quick tunnels (cloudflared) so the dev build can be previewed remotely.
    allowedHosts: ['.trycloudflare.com'],
  },
});
