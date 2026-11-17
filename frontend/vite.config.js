import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: process.env.WAVE_PUBLIC_HOST ? [process.env.WAVE_PUBLIC_HOST] : [],
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: process.env.BACKEND_TARGET || 'http://backend:3001', changeOrigin: true },
      '/socket.io': { target: process.env.BACKEND_TARGET || 'http://backend:3001', ws: true, changeOrigin: true },
    },
  },
});
