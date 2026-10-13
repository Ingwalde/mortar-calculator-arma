import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLanServer, resolveStaticPath, tokenMatches, type LanDeps, type LanServer } from "./server";

describe("resolveStaticPath", () => {
  const root = join(tmpdir(), "lan-root");
  it("maps / to index.html", () => {
    expect(resolveStaticPath(root, "/")).toBe(join(root, "index.html"));
  });
  it("keeps normal asset paths inside root", () => {
    expect(resolveStaticPath(root, "/assets/a.js")).toBe(join(root, "assets", "a.js"));
  });
  it("rejects traversal, encoded traversal and NUL", () => {
    expect(resolveStaticPath(root, "/../secret")).toBe(join(root, "secret"));
    expect(resolveStaticPath(root, "/%2e%2e/%2e%2e/secret")).not.toMatch(/^\.\./);
    expect(resolveStaticPath(root, "/a%00b")).toBeNull();
    expect(resolveStaticPath(root, "/%E0%A4%A")).toBeNull();
  });
});

describe("tokenMatches", () => {
  it("compares exactly", () => {
    expect(tokenMatches("abc", "abc")).toBe(true);
    expect(tokenMatches("abd", "abc")).toBe(false);
    expect(tokenMatches("ab", "abc")).toBe(false);
    expect(tokenMatches(null, "abc")).toBe(false);
  });
});

describe("LAN server", () => {
  const TOKEN = "test-token-1234567890";
  let srv: LanServer;
  let base = "";
  let stored: unknown = null;
  const saves: Array<[unknown, string]> = [];

  beforeEach(async () => {
    const dir = mkdtempSync(join(tmpdir(), "lan-static-"));
    writeFileSync(join(dir, "index.html"), "<html>planshet</html>");
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "assets", "a.js"), "console.log(1)");
    stored = { v: 1 };
    saves.length = 0;
    const deps: LanDeps = {
      staticDir: dir,
      devProxyUrl: null,
      loadStore: async () => stored,
      saveStore: async (data, source) => {
        stored = data;
        saves.push([data, source]);
        srv.notifyChanged(source);
        return false;
      },
      readHeights: async (id) => (id === "everon" ? new Uint8Array([1, 2, 3]) : null),
      onlineTile: async (id, lod, x, y) => (id === "everon" && lod === 2 && x === 1 && y === 1 ? Buffer.from("jpg") : null),
      pyramidTile: async (id, z, row, col) =>
        id === "mog" ? { data: Buffer.from(`${z}/${row}/${col}`), type: "image/webp" } : null
    };
    srv = createLanServer(deps, TOKEN);
    const port = 39000 + Math.floor(Math.random() * 1000);
    await srv.listen(port);
    base = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await srv.close();
  });

  const cookie = { cookie: `mk=${TOKEN}` };

  it("rejects requests without the token", async () => {
    expect((await fetch(`${base}/api/store`)).status).toBe(401);
    expect((await fetch(`${base}/api/store`, { headers: { cookie: "mk=wrong" } })).status).toBe(401);
    expect((await fetch(`${base}/?k=wrong`, { redirect: "manual" })).status).toBe(401);
  });

  it("turns ?k= into an HttpOnly cookie and keeps serving at the same URL", async () => {
    const res = await fetch(`${base}/?k=${TOKEN}`, { redirect: "manual" });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("planshet");
    const sc = res.headers.get("set-cookie")!;
    expect(sc).toContain(`mk=${TOKEN}`);
    expect(sc).toContain("HttpOnly");
    expect(sc).toContain("SameSite=Strict");
  });

  it("serves a manifest whose start_url carries the key, and public icons", async () => {
    expect((await fetch(`${base}/manifest.webmanifest`)).status).toBe(401);
    const m = await fetch(`${base}/manifest.webmanifest`, { headers: cookie });
    const json = (await m.json()) as { start_url: string; display: string };
    expect(json.start_url).toBe(`/?k=${TOKEN}`);
    expect(json.display).toBe("standalone");
    // іконки без cookie: файл відсутній у тестовому каталозі, але це 404, а не 401
    expect((await fetch(`${base}/icons/icon-192.png`)).status).toBe(404);
  });

  it("serves static files and blocks path traversal", async () => {
    const idx = await fetch(`${base}/`, { headers: cookie });
    expect(idx.status).toBe(200);
    expect(await idx.text()).toContain("planshet");
    const js = await fetch(`${base}/assets/a.js`, { headers: cookie });
    expect(js.headers.get("content-type")).toContain("javascript");
    expect((await fetch(`${base}/assets/missing.js`, { headers: cookie })).status).toBe(404);
    const trav = await fetch(`${base}/..%2f..%2fetc/passwd`, { headers: cookie });
    expect([400, 404]).toContain(trav.status);
  });

  it("reads and writes the store, reporting a revision", async () => {
    const got = await fetch(`${base}/api/store`, { headers: cookie });
    expect(await got.json()).toEqual({ v: 1 });
    const put = await fetch(`${base}/api/store`, {
      method: "PUT",
      headers: { ...cookie, "x-client-id": "phone1", "content-type": "application/json" },
      body: JSON.stringify({ v: 2, marks: [1] })
    });
    expect(put.status).toBe(200);
    expect(Number(put.headers.get("x-rev"))).toBeGreaterThan(1);
    expect(saves).toEqual([[{ v: 2, marks: [1] }, "phone1"]]);
  });

  it("rejects bad PUT bodies and client ids", async () => {
    const headers = { ...cookie, "content-type": "application/json" };
    expect((await fetch(`${base}/api/store`, { method: "PUT", headers: { ...headers, "x-client-id": "ok" }, body: "{nope" })).status).toBe(400);
    expect((await fetch(`${base}/api/store`, { method: "PUT", headers, body: "{}" })).status).toBe(400);
    expect((await fetch(`${base}/api/store`, { method: "PUT", headers: { ...headers, "x-client-id": "bad id!" }, body: "{}" })).status).toBe(400);
  });

  it("serves heights and tiles, 404 otherwise", async () => {
    const h = await fetch(`${base}/api/heights/everon`, { headers: cookie });
    expect(new Uint8Array(await h.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect((await fetch(`${base}/api/heights/nope`, { headers: cookie })).status).toBe(404);
    expect((await fetch(`${base}/tile/everon/2/1/1`, { headers: cookie })).status).toBe(200);
    expect((await fetch(`${base}/tile/everon/9/9/9`, { headers: cookie })).status).toBe(404);
    const lt = await fetch(`${base}/localtile/mog/3/1/2`, { headers: cookie });
    expect(await lt.text()).toBe("3/1/2");
  });

  it("pushes SSE revisions to other clients but not to the saver", async () => {
    async function open(clientId: string) {
      const ac = new AbortController();
      const res = await fetch(`${base}/api/events?c=${clientId}`, { headers: cookie, signal: ac.signal });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      return {
        async next(): Promise<string> {
          const { value } = await reader.read();
          return dec.decode(value);
        },
        close: () => ac.abort()
      };
    }
    const a = await open("clientA");
    const b = await open("clientB");
    expect(await a.next()).toContain('"rev"');
    expect(await b.next()).toContain('"rev"');

    srv.notifyChanged("clientA");
    const msg = await b.next();
    expect(JSON.parse(msg.replace(/^data: /, "").trim()).rev).toBe(srv.rev);

    // A не отримує власний запис: наступним у A має прийти лише чужа зміна.
    srv.notifyChanged("clientB");
    const aMsg = await a.next();
    expect(JSON.parse(aMsg.replace(/^data: /, "").trim()).rev).toBe(srv.rev);
    a.close();
    b.close();
  });
});

describe("LAN server: HTTPS і довірчий сертифікат", () => {
  const TOKEN = "https-token-1234567890";
  it("віддає сторінку по HTTPS і профіль CA лише з токеном", async () => {
    const { mkdtemp, rm } = await import("node:fs/promises");
    const { request } = await import("node:https");
    const { ensureCa, issueServerCert } = await import("./tls");
    const dir = await mkdtemp(join(tmpdir(), "lan-https-"));
    const staticDir = mkdtempSync(join(tmpdir(), "lan-https-static-"));
    writeFileSync(join(staticDir, "index.html"), "<html>https</html>");
    const ca = await ensureCa(dir);
    const cert = issueServerCert(ca, ["127.0.0.1"]);
    const srv = createLanServer(
      {
        staticDir,
        devProxyUrl: null,
        loadStore: async () => null,
        saveStore: async () => false,
        readHeights: async () => null,
        onlineTile: async () => null,
        pyramidTile: async () => null,
        caCertDer: ca.certDer
      },
      TOKEN
    );
    const port = 40000 + Math.floor(Math.random() * 900);
    await srv.listenHttps(port, { key: cert.keyPem, cert: cert.certPem });
    const get = (path: string, headers: Record<string, string> = {}) =>
      new Promise<{ status: number; body: Buffer; headers: Record<string, string | string[] | undefined> }>((resolve, reject) => {
        const req = request({ host: "127.0.0.1", port, ca: ca.certPem, path, headers }, (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c as Buffer));
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks), headers: res.headers }));
        });
        req.on("error", reject);
        req.end();
      });
    try {
      const page = await get(`/?k=${TOKEN}`);
      expect(page.status).toBe(200);
      expect(page.body.toString()).toContain("https");
      expect(String(page.headers["set-cookie"])).toContain("Secure");
      expect((await get("/ca/mortar-tablet-ca.mobileconfig")).status).toBe(401);
      const prof = await get(`/ca/mortar-tablet-ca.mobileconfig?k=${TOKEN}`);
      expect(prof.status).toBe(200);
      expect(prof.body.toString()).toContain("com.apple.security.root");
      const crt = await get(`/ca/mortar-tablet-ca.crt?k=${TOKEN}`);
      expect(crt.status).toBe(200);
      expect(crt.body.equals(ca.certDer)).toBe(true);
    } finally {
      await srv.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("LAN server: оцінка розміру тайлів", () => {
  it("віддає середній розмір тайла піраміди", async () => {
    const staticDir = mkdtempSync(join(tmpdir(), "lan-stat-"));
    const srv = createLanServer(
      {
        staticDir,
        devProxyUrl: null,
        loadStore: async () => null,
        saveStore: async () => false,
        readHeights: async () => null,
        onlineTile: async () => null,
        pyramidTile: async () => null,
        pyramidAvgBytes: async (id) => (id === "mog" ? 5321 : null)
      },
      "stat-token-1234567890"
    );
    const port = 41000 + Math.floor(Math.random() * 900);
    await srv.listen(port);
    try {
      const h = { cookie: "mk=stat-token-1234567890" };
      const a = await fetch(`http://127.0.0.1:${port}/api/tilestat/mog`, { headers: h }).then((r) => r.json());
      const b = await fetch(`http://127.0.0.1:${port}/api/tilestat/none`, { headers: h }).then((r) => r.json());
      expect(a).toEqual({ avgBytes: 5321 });
      expect(b).toEqual({ avgBytes: null });
    } finally {
      await srv.close();
    }
  });
});

describe("LAN server: стиснення", () => {
  it("pickEncoding віддає brotli, інакше gzip, і поважає q=0", async () => {
    const { pickEncoding } = await import("./server");
    expect(pickEncoding("gzip, deflate, br")).toBe("br");
    expect(pickEncoding("gzip")).toBe("gzip");
    expect(pickEncoding("br;q=0, gzip;q=0.5")).toBe("gzip");
    expect(pickEncoding("identity")).toBeNull();
    expect(pickEncoding(undefined)).toBeNull();
  });

  it("стискає великий JS/CSS і не чіпає картинки та малі файли", async () => {
    const { gunzipSync, brotliDecompressSync } = await import("node:zlib");
    const staticDir = mkdtempSync(join(tmpdir(), "lan-gz-"));
    const big = "const x = 1;\n".repeat(2000);
    writeFileSync(join(staticDir, "index.html"), "<html>" + "a".repeat(3000) + "</html>");
    mkdirSync(join(staticDir, "assets"));
    writeFileSync(join(staticDir, "assets", "app.js"), big);
    writeFileSync(join(staticDir, "assets", "small.js"), "x=1");
    writeFileSync(join(staticDir, "assets", "pic.png"), Buffer.alloc(5000, 7));
    const srv = createLanServer(
      {
        staticDir,
        devProxyUrl: null,
        loadStore: async () => ({ v: 1, pad: "z".repeat(3000) }),
        saveStore: async () => false,
        readHeights: async () => null,
        onlineTile: async () => null,
        pyramidTile: async () => null
      },
      "gz-token-1234567890123"
    );
    const port = 42000 + Math.floor(Math.random() * 900);
    await srv.listen(port);
    const base = `http://127.0.0.1:${port}`;
    const h = { cookie: "mk=gz-token-1234567890123" };
    try {
      // fetch сам розпаковує, тому беремо сирі заголовки через node:http
      const { request } = await import("node:http");
      const raw = (path: string, enc: string) =>
        new Promise<{ headers: Record<string, string | string[] | undefined>; body: Buffer }>((resolve, reject) => {
          const req = request(base + path, { headers: { ...h, "accept-encoding": enc } }, (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (c) => chunks.push(c as Buffer));
            res.on("end", () => resolve({ headers: res.headers, body: Buffer.concat(chunks) }));
          });
          req.on("error", reject);
          req.end();
        });
      const js = await raw("/assets/app.js", "gzip");
      expect(js.headers["content-encoding"]).toBe("gzip");
      expect(js.body.length).toBeLessThan(big.length / 5);
      expect(gunzipSync(js.body).toString()).toBe(big);
      const br = await raw("/assets/app.js", "br, gzip");
      expect(br.headers["content-encoding"]).toBe("br");
      expect(brotliDecompressSync(br.body).toString()).toBe(big);
      expect(br.headers.vary).toMatch(/Accept-Encoding/i);
      expect((await raw("/assets/small.js", "gzip")).headers["content-encoding"]).toBeUndefined();
      expect((await raw("/assets/pic.png", "gzip")).headers["content-encoding"]).toBeUndefined();
      expect((await raw("/assets/app.js", "identity")).headers["content-encoding"]).toBeUndefined();
      const store = await raw("/api/store", "gzip");
      expect(store.headers["content-encoding"]).toBe("gzip");
      expect(JSON.parse(gunzipSync(store.body).toString()).v).toBe(1);
    } finally {
      await srv.close();
    }
  });
});
