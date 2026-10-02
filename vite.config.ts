import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true, // expose on LAN so you can open it on your phone
    port: 5173,
  },
});
