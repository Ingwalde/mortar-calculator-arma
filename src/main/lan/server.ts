/**
 * HTTP-сервер для перегляду планшета з телефона в локальній мережі. Без залежності від Electron —
 * усе, що потребує диска/мережі застосунку, приходить через LanDeps (тестується напряму).
 *
 * Захист: сервер за замовчуванням вимкнений; усі запити вимагають токен (?k=… у посиланні з
 * QR-коду → cookie HttpOnly+SameSite=Strict). Експортуються лише читання/запис стану, тайли й висоти —
 * жодного доступу до файлової системи чи імпорту карт.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, normalize, resolve, sep, extname } from "node:path";

export interface LanDeps {
  /** Каталог зібраного renderer (out/renderer); null — не віддавати статику. */
  staticDir: string | null;
  /** У dev-режимі — адреса Vite dev-сервера, на який проксіюються запити статики. */
  devProxyUrl: string | null;
  loadStore(): Promise<unknown>;
  /** true — після злиття клієнту треба перечитати стан. */
  saveStore(data: unknown, sourceId: string): Promise<boolean>;
  readHeights(terrainId: string): Promise<Uint8Array | null>;
  onlineTile(terrainId: string, lod: number, x: number, y: number): Promise<Buffer | null>;
  pyramidTile(terrainId: string, z: string, row: string, col: string): Promise<Buffer | null>;
}

export interface LanServer {
  listen(port: number): Promise<void>;
  close(): Promise<void>;
  /** Повідомити підключених клієнтів, що стан змінився (крім того, хто його записав). */
  notifyChanged(sourceId: string): void;
  readonly rev: number;
}

const COOKIE = "mk";
const MAX_BODY = 32 * 1024 * 1024;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".webmanifest": "application/manifest+json"
};

export function tokenMatches(given: string | null | undefined, token: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

/** Безпечно зіставляє шлях запиту з файлом усередині root; null — вихід за межі каталогу. */
export function resolveStaticPath(root: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const rootAbs = resolve(root);
  const full = resolve(join(rootAbs, normalize(decoded === "/" ? "/index.html" : decoded)));
  if (full !== rootAbs && !full.startsWith(rootAbs + sep)) return null;
  return full;
}

function send(res: ServerResponse, status: number, body: string | Buffer | Uint8Array, headers: Record<string, string> = {}): void {
  res.writeHead(status, { "cache-control": "no-store", ...headers });
  res.end(body);
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error("body too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export function createLanServer(deps: LanDeps, token: string): LanServer {
  let rev = 1;
  const sse = new Map<string, Set<ServerResponse>>();
  let server: Server | null = null;
  let keepAlive: ReturnType<typeof setInterval> | undefined;

  function authorized(req: IncomingMessage, url: URL): { ok: boolean; viaQuery: boolean } {
    const q = url.searchParams.get("k");
    if (q !== null) return { ok: tokenMatches(q, token), viaQuery: true };
    return { ok: tokenMatches(parseCookies(req.headers.cookie)[COOKIE], token), viaQuery: false };
  }

  async function serveStatic(req: IncomingMessage, url: URL, res: ServerResponse): Promise<void> {
    if (deps.devProxyUrl) {
      // Vite віддає файли диска через /@fs/ (у dev так підтягується src/core і vite client) —
      // з LAN дозволяємо лише їх, решту диска не показуємо.
      if (url.pathname.startsWith("/@fs/") && !/\/(src\/core|node_modules\/vite|node_modules\/\.vite\/deps)\//.test(url.pathname)) {
        return send(res, 403, "Forbidden");
      }
      try {
        // Vite вирішує, віддати CSS як стилі чи як JS-модуль, за цими заголовками.
        const fwd: Record<string, string> = {};
        for (const h of ["accept", "sec-fetch-dest", "sec-fetch-mode"]) {
          const v = req.headers[h];
          if (typeof v === "string") fwd[h] = v;
        }
        const r = await fetch(new URL(url.pathname + url.search, deps.devProxyUrl), { headers: fwd });
        const buf = Buffer.from(await r.arrayBuffer());
        send(res, r.status, buf, { "content-type": r.headers.get("content-type") ?? "application/octet-stream" });
      } catch {
        send(res, 502, "dev server unavailable");
      }
      return;
    }
    if (!deps.staticDir) return send(res, 404, "Not found");
    const file = resolveStaticPath(deps.staticDir, url.pathname);
    if (!file) return send(res, 400, "Bad path");
    try {
      const buf = await readFile(file);
      send(res, 200, buf, { "content-type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream" });
    } catch {
      send(res, 404, "Not found");
    }
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://lan.local");

    // Іконки не секретні, а ОС тягне їх при додаванні на головний екран без наших cookie.
    if (url.pathname.startsWith("/icons/") && (req.method ?? "GET") === "GET") return serveStatic(req, url, res);

    const auth = authorized(req, url);
    if (!auth.ok) {
      return send(res, 401, "Потрібне посилання з QR-коду застосунку «Планшет мінометника».", {
        "content-type": "text/plain; charset=utf-8"
      });
    }
    if (auth.viaQuery) {
      // Токен з посилання → cookie. Адресу з ?k= лишаємо як є: саме її iOS запам’ятовує для іконки
      // на головному екрані (там cookie Safari недоступні), тож запуск з іконки знову поставить cookie.
      res.setHeader("set-cookie", `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000`);
    }

    if (url.pathname === "/manifest.webmanifest") {
      const manifest = {
        name: "Планшет мінометника",
        short_name: "Мінометник",
        start_url: `/?k=${token}`,
        scope: "/",
        display: "standalone",
        background_color: "#161c18",
        theme_color: "#161c18",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      };
      return send(res, 200, JSON.stringify(manifest), { "content-type": "application/manifest+json; charset=utf-8" });
    }

    const path = url.pathname;
    const method = req.method ?? "GET";

    if (path === "/api/store") {
      if (method === "GET") {
        const data = await deps.loadStore();
        if (data === null) return send(res, 404, "null", { "content-type": "application/json", "x-rev": String(rev) });
        return send(res, 200, JSON.stringify(data), { "content-type": "application/json", "x-rev": String(rev) });
      }
      if (method === "PUT") {
        const clientId = String(req.headers["x-client-id"] ?? "");
        if (!ID_RE.test(clientId)) return send(res, 400, "bad client id");
        let data: unknown;
        try {
          data = JSON.parse((await readBody(req)).toString("utf8"));
        } catch {
          return send(res, 400, "bad json");
        }
        const merged = await deps.saveStore(data, clientId);
        return send(res, 200, "ok", { "x-rev": String(rev), "x-merged": merged ? "1" : "0" });
      }
      return send(res, 405, "method not allowed");
    }

    if (path === "/api/events" && method === "GET") {
      const clientId = url.searchParams.get("c") ?? "";
      if (!ID_RE.test(clientId)) return send(res, 400, "bad client id");
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
        connection: "keep-alive"
      });
      res.write(`data: ${JSON.stringify({ rev })}\n\n`);
      let set = sse.get(clientId);
      if (!set) sse.set(clientId, (set = new Set()));
      set.add(res);
      req.on("close", () => {
        set!.delete(res);
        if (set!.size === 0) sse.delete(clientId);
      });
      return;
    }

    let m = /^\/api\/heights\/([A-Za-z0-9_-]+)$/.exec(path);
    if (m && method === "GET") {
      const buf = await deps.readHeights(m[1]);
      if (!buf) return send(res, 404, "Not found");
      return send(res, 200, buf, { "content-type": "application/octet-stream" });
    }

    m = /^\/tile\/([A-Za-z0-9_-]+)\/(\d+)\/(\d+)\/(\d+)$/.exec(path);
    if (m && method === "GET") {
      const buf = await deps.onlineTile(m[1], Number(m[2]), Number(m[3]), Number(m[4]));
      if (!buf) return send(res, 404, "Not found");
      return send(res, 200, buf, { "content-type": "image/jpeg", "cache-control": "private, max-age=300" });
    }

    m = /^\/localtile\/([A-Za-z0-9_-]+)\/(\d+)\/(\d+)\/(\d+)$/.exec(path);
    if (m && method === "GET") {
      const buf = await deps.pyramidTile(m[1], m[2], m[3], m[4]);
      if (!buf) return send(res, 404, "Not found");
      return send(res, 200, buf, { "content-type": "image/jpeg", "cache-control": "private, max-age=300" });
    }

    if (path.startsWith("/api/")) return send(res, 404, "Not found");
    if (method !== "GET") return send(res, 405, "method not allowed");
    return serveStatic(req, url, res);
  }

  return {
    get rev() {
      return rev;
    },
    notifyChanged(sourceId) {
      rev++;
      const line = `data: ${JSON.stringify({ rev })}\n\n`;
      for (const [clientId, set] of sse) {
        if (clientId === sourceId) continue;
        for (const res of set) res.write(line);
      }
    },
    listen(port) {
      return new Promise((resolveListen, rejectListen) => {
        const s = createServer((req, res) => {
          handle(req, res).catch(() => {
            if (!res.headersSent) send(res, 500, "Internal error");
            else res.end();
          });
        });
        s.once("error", rejectListen);
        s.listen(port, "0.0.0.0", () => {
          s.off("error", rejectListen);
          server = s;
          keepAlive = setInterval(() => {
            for (const set of sse.values()) for (const res of set) res.write(": ping\n\n");
          }, 20000);
          resolveListen();
        });
      });
    },
    close() {
      return new Promise((resolveClose) => {
        if (keepAlive) clearInterval(keepAlive);
        for (const set of sse.values()) for (const res of set) res.end();
        sse.clear();
        if (!server) return resolveClose();
        const s = server;
        server = null;
        s.close(() => resolveClose());
        s.closeAllConnections?.();
      });
    }
  };
}
