import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    hmr: process.env.NODE_ENV === 'production' ? false : undefined,
  },
  build: {
    sourcemap: false,
  },
});
