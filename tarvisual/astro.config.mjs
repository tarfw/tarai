import { defineConfig } from 'astro/config';

export default defineConfig({
  outDir: './dist',
  server: {
    host: true,
    port: 4322
  }
});
