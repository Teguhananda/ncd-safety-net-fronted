import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      // Multi-page build: index.html (staff app) + portal.html (Portal
      // Pasien, HTML terpisah fisik) supaya manifest PWA-nya benar-benar
      // tertanam statis sejak awal — trik ganti <link rel="manifest">
      // lewat JavaScript ternyata TIDAK dibaca Safari saat "Add to Home
      // Screen", jadi diganti pendekatan yang lebih andal ini.
      input: {
        main: resolve(__dirname, "index.html"),
        portal: resolve(__dirname, "portal.html"),
      },
    },
  },
});
