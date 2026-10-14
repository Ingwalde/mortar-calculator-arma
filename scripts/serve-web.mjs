// Статичний сервер out/web на підшляху, як GitHub Pages: http://localhost:4173/mortar-calculator-arma/
//   npm run build:web && node scripts/serve-web.mjs
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("../out/web", import.meta.url));
const SUB = "/mortar-calculator-arma/";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".gz": "application/gzip" };
createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (!url.pathname.startsWith(SUB)) { res.writeHead(404); return res.end("not found"); }
  let rel = decodeURIComponent(url.pathname.slice(SUB.length)) || "index.html";
  if (rel.endsWith("/")) rel += "index.html";
  const file = normalize(join(ROOT, rel));
  if (!file.startsWith(normalize(ROOT))) { res.writeHead(403); return res.end(); }
  try {
    if (!(await stat(file)).isFile()) throw new Error();
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end("not found"); }
}).listen(4173, "127.0.0.1", () => console.log("http://localhost:4173" + SUB));
