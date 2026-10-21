// Автономна веб-збірка (PWA на GitHub Pages, пізніше — вміст APK): той самий renderer, але без Electron і без ПК.
//   npm run build:web  ->  out/web
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8")) as { version: string };

const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  // глибші рівні онлайн-карти вантажаться напряму з reforger.recoil.org
  "img-src 'self' data: blob: https://reforger.recoil.org",
  "font-src 'self'",
  // перевірка нової версії Android-застосунку (останній реліз на GitHub)
  "connect-src 'self' https://api.github.com https://mortar-tablet-relay.gdimas0603.workers.dev wss://mortar-tablet-relay.gdimas0603.workers.dev",
  "media-src 'self' blob: data:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'"
].join("; ");

const webShell: Plugin = {
  name: "mortar-web-shell",
  transformIndexHtml(html) {
    return html.replace("<head>", `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}">`);
  },
  generateBundle() {
    // відносні шляхи: сайт лежить на підшляху (https://<user>.github.io/<repo>/)
    const manifest = {
      name: "Планшет мінометника",
      short_name: "Мінометник",
      start_url: "./",
      scope: "./",
      display: "standalone",
      background_color: "#161c18",
      theme_color: "#161c18",
      icons: [
        { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
      ]
    };
    this.emitFile({ type: "asset", fileName: "manifest.webmanifest", source: JSON.stringify(manifest) });
    // сторінка завантаження (посилання на ПК-інсталятор, portable й Android APK з останнього релізу)
    for (const f of ["download.html", "download.js"]) {
      this.emitFile({ type: "asset", fileName: f, source: readFileSync(resolve(__dirname, "src/web", f)) });
    }
    for (const f of readdirSync(resolve(__dirname, "src/web/img"))) {
      this.emitFile({ type: "asset", fileName: `img/${f}`, source: readFileSync(resolve(__dirname, "src/web/img", f)) });
    }
  }
};

export default defineConfig({
  root: "src/renderer",
  base: "./",
  plugins: [webShell],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __STANDALONE__: "true"
  },
  resolve: { alias: { "@core": resolve(__dirname, "src/core") } },
  build: {
    outDir: resolve(__dirname, "out/web"),
    emptyOutDir: true,
    rollupOptions: { input: { index: resolve(__dirname, "src/renderer/index.html") } }
  }
});
