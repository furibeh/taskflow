/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Política de seguridad de contenido de la página (plan D5, FR-010, FR-028d). En desarrollo,
// Vite necesita 'unsafe-inline' para el preámbulo de React Refresh y los estilos que inyecta
// con HMR; la versión compilada (preview/producción) usa la política estricta.
const csp = (dev: boolean) =>
  [
    "default-src 'self'",
    `script-src 'self'${dev ? " 'unsafe-inline'" : ''}`,
    `style-src 'self'${dev ? " 'unsafe-inline'" : ''}`,
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

const securityHeaders = (dev: boolean) => ({
  'Content-Security-Policy': csp(dev),
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
});

export default defineConfig({
  plugins: [react()],
  preview: { headers: securityHeaders(false) },
  server: {
    headers: securityHeaders(true),
    host: process.env.VITE_HOST ?? 'localhost',
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
  },
});
