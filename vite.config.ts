import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  server: {
    host: true, // expose on LAN so you can open it on your phone
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'), // P01 Pixi greybox (Foss Hill)
        row: resolve(__dirname, 'row.html'), // Three.js College Row vibe test
      },
    },
  },
});
