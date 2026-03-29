import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React vendors
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Data fetching
          'vendor-query': ['@tanstack/react-query'],
          // UI utilities
          'vendor-ui': ['react-hot-toast', 'lucide-react', 'react-helmet-async'],
        },
      },
    },
  },
});
