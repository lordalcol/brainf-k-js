import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths, so the build works from any sub-path (e.g. GitHub Pages).
  base: './',
  server: { port: 5173, strictPort: true },
  build: { target: 'es2022' },
});
