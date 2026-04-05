import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      envPrefix: ['VITE_', 'GEMINI_'],
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: ['1f47cd9b.vyd3nmyr1a.olares.com'],
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
