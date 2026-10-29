import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // The bundle is mostly game texts (handbook, events), so it is larger than usual.
  // es2022: the language dictionary is loaded with a top-level await.
  build: { chunkSizeWarningLimit: 900, target: 'es2022' },
});
