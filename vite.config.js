import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// ==== REVISI PERFORMA (Sept 2026) ====
// 1) manualChunks: library besar dipecah jadi file terpisah per paket.
//    - Portal Pasien hanya mengunduh bagian Firebase yang benar-benar
//      dipakainya (tidak ikut menarik grafik/recharts milik staff).
//    - File library jarang berubah → tetap tersimpan di cache HP walau
//      aplikasi di-update, jadi buka ulang setelah update jauh lebih cepat.
function chunkFor(id) {
  if (!id.includes("node_modules")) return undefined;
  const p = id.split("node_modules/").pop();

  // Grafik (hanya dipakai halaman staff)
  if (/^(recharts|recharts-scale|react-smooth|victory-vendor|d3-|internmap|decimal\.js-light|eventemitter3|lodash|fast-equals)/.test(p)) return "charts";

  // React inti + router (dipakai Portal & staff)
  if (/^(react|react-dom|scheduler|react-router|react-router-dom|@remix-run)\//.test(p)) return "react";

  // Firebase dipecah per bagian
  if (/^(@firebase\/(firestore|webchannel-wrapper)|firebase\/firestore)/.test(p)) return "fb-firestore";
  if (/^(@firebase\/(messaging|installations)|firebase\/messaging)/.test(p)) return "fb-messaging";
  if (/^(@firebase\/auth|firebase\/auth)/.test(p)) return "fb-auth";
  if (/^(@firebase|firebase|idb|tslib)\//.test(p)) return "fb-core";

  return undefined;
}

// 2) Font Portal Pasien dimuat lewat <link> di <head> (dengan preconnect),
//    BUKAN lewat @import di dalam CSS. @import membuat HP menunggu
//    berantai: HTML → CSS → CSS font → file font, baru teks muncul.
function portalFontPlugin() {
  const FONT_URL =
    "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
  return {
    name: "portal-font-preload",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const file = (ctx && (ctx.filename || ctx.path)) || "";
        if (!file.endsWith("portal.html")) return html;
        if (html.includes("Plus+Jakarta+Sans")) return html; // sudah ada, jangan dobel
        return [
          { tag: "link", attrs: { rel: "preconnect", href: "https://fonts.googleapis.com" }, injectTo: "head-prepend" },
          { tag: "link", attrs: { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }, injectTo: "head-prepend" },
          { tag: "link", attrs: { rel: "stylesheet", href: FONT_URL }, injectTo: "head" },
        ];
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), portalFontPlugin()],
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
      output: {
        manualChunks: chunkFor,
      },
    },
  },
});
