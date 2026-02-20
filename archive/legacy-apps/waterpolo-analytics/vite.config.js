import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/waterpolo/analytics/',
  server: { port: 5174 }
});
