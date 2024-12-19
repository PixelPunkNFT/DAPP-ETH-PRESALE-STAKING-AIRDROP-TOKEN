import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  assetsInclude: ['**/*.json'],
  build: {
    commonjsOptions: {
      include: [/artifacts/, /node_modules/],
    },
  },
  optimizeDeps: {
    include: ['ethers'],
  },
});
