import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8")) as { version: string };

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "src/main/index.ts") }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "src/preload/index.ts") },
        // sandbox: true вимагає CommonJS-preload
        output: { format: "cjs", entryFileNames: "[name].cjs" }
      }
    }
  },
  renderer: {
    root: "src/renderer",
    plugins: [
      {
        // Політика вмісту лише для зібраної версії (у dev Vite потребує inline-скриптів для HMR).
        name: "mortar-csp",
        apply: "build",
        transformIndexHtml(html: string) {
          const csp = [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: tile: localtile:",
            "font-src 'self'",
            "connect-src 'self' tile: localtile: https://mortar-tablet-relay.gdimas0603.workers.dev wss://mortar-tablet-relay.gdimas0603.workers.dev",
            "media-src 'self' blob: data:",
            "worker-src 'self'",
            "manifest-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'none'"
          ].join("; ");
          return html.replace("<head>", `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}">`);
        }
      }
    ],
    define: { __APP_VERSION__: JSON.stringify(pkg.version), __STANDALONE__: "false" },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "src/renderer/index.html") }
      }
    },
    resolve: {
      alias: {
        "@core": resolve(__dirname, "src/core")
      }
    }
  }
});
