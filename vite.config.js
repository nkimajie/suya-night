import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev:quest` serves over HTTPS on the LAN so a Quest can open it
// (WebXR needs a secure context). Plain `npm run dev` stays on http://localhost.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'quest' ? [basicSsl()] : [],
  server: { port: 5173 },
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
}));
