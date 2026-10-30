import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.API_PROXY_TARGET || 'http://127.0.0.1:5000';
  return {
    plugins: [react(), tailwindcss()],
    // The unified deployment must not inherit an old cross-origin API build setting.
    define: env.SERVE_FRONTEND === 'true' ? { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('') } : {},
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': { target, changeOrigin: true },
        '/uploads': { target, changeOrigin: true },
      },
    },
  };
});
