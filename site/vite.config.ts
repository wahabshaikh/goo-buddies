import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The playground runs on the library's source, so edits in ../src hot-reload here.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      'goo-buddies': fileURLToPath(new URL('../src/index.ts', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    dedupe: ['react', 'react-dom'],
  },
});
