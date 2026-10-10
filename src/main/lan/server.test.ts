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
      },
      readHeights: async (id) => (id === "everon" ? new Uint8Array([1, 2, 3]) : null),
      onlineTile: async (id, lod, x, y) => (id === "everon" && lod === 2 && x === 1 && y === 1 ? Buffer.from("jpg") : null),
      pyramidTile: async (id, z, row, col) => (id === "mog" ? Buffer.from(`${z}/${row}/${col}`) : null)
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

  it("turns ?k= into an HttpOnly cookie and redirects to a clean URL", async () => {
    const res = await fetch(`${base}/?k=${TOKEN}`, { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
    const sc = res.headers.get("set-cookie")!;
    expect(sc).toContain(`mk=${TOKEN}`);
    expect(sc).toContain("HttpOnly");
    expect(sc).toContain("SameSite=Strict");
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
