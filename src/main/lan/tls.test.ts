import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, request } from "node:https";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import forge from "node-forge";
import { ensureCa, issueServerCert, mobileconfig } from "./tls";

// генерація RSA-ключів у чистому JS: на завантаженій машині її мало 5 с за замовчуванням
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let dir = "";
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "mortar-tls-"));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("tls", () => {
  it("створює CA один раз і читає той самий надалі", async () => {
    const a = await ensureCa(dir);
    const b = await ensureCa(dir);
    expect(b.certPem).toBe(a.certPem);
    expect(a.certDer.length).toBeGreaterThan(300);
    const cert = forge.pki.certificateFromPem(a.certPem);
    expect(cert.getExtension("basicConstraints")).toMatchObject({ cA: true });
  });

  it("видає серверний сертифікат із SAN і підписом CA", async () => {
    const ca = await ensureCa(dir);
    const s = issueServerCert(ca, ["192.168.1.7", "pc.local"]);
    const cert = forge.pki.certificateFromPem(s.certPem);
    const san = cert.getExtension("subjectAltName") as { altNames: { type: number; ip?: string; value?: string }[] };
    expect(san.altNames.some((a) => a.type === 7 && a.ip === "192.168.1.7")).toBe(true);
    expect(san.altNames.some((a) => a.type === 2 && a.value === "pc.local")).toBe(true);
    const caCert = forge.pki.certificateFromPem(ca.certPem);
    expect(caCert.verify(cert)).toBe(true);
    const days = (cert.validity.notAfter.getTime() - cert.validity.notBefore.getTime()) / 86400000;
    expect(days).toBeLessThan(400);
  });

  it("HTTPS-клієнт, що довіряє лише нашому CA, з'єднується із сервером", async () => {
    const ca = await ensureCa(dir);
    const s = issueServerCert(ca, ["127.0.0.1"]);
    const srv = createServer({ key: s.keyPem, cert: s.certPem }, (_req, res) => res.end("ok"));
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    const port = (srv.address() as { port: number }).port;
    const body = await new Promise<string>((resolve, reject) => {
      const req = request({ host: "127.0.0.1", port, ca: ca.certPem, path: "/" }, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(d));
      });
      req.on("error", reject);
      req.end();
    });
    srv.close();
    expect(body).toBe("ok");
  });

  it("профіль iOS містить сертифікат і тип com.apple.security.root", async () => {
    const ca = await ensureCa(dir);
    const p = mobileconfig(ca.certDer);
    expect(p).toContain("com.apple.security.root");
    expect(p.replace(/\s+/g, "")).toContain(ca.certDer.toString("base64").slice(0, 40));
  });
});

describe("ensureServerCert (кеш на диску)", () => {
  it("повторно віддає той самий сертифікат і перевидає при зміні адрес", async () => {
    const { ensureServerCert } = await import("./tls");
    const ca = await ensureCa(dir);
    const a = await ensureServerCert(dir, ca, ["192.168.1.7", "pc.local"]);
    const b = await ensureServerCert(dir, ca, ["192.168.1.7", "pc.local"]);
    expect(b.certPem).toBe(a.certPem);
    expect(b.keyPem).toBe(a.keyPem);
    // підмножина адрес — кеш лишається чинним
    const c = await ensureServerCert(dir, ca, ["192.168.1.7"]);
    expect(c.certPem).toBe(a.certPem);
    // з'явилась нова адреса — перевидаємо
    const d = await ensureServerCert(dir, ca, ["192.168.1.7", "10.0.0.5"]);
    expect(d.certPem).not.toBe(a.certPem);
    expect(d.names).toContain("10.0.0.5");
  });
});

describe("обмеження імен CA", () => {
  it("новий CA має NameConstraints, серверний сертифікат — ні", async () => {
    const { caIsConstrained } = await import("./tls");
    const ca = await ensureCa(dir);
    expect(caIsConstrained(ca.certPem)).toBe(true);
    const leaf = issueServerCert(ca, ["192.168.1.7"]);
    expect(caIsConstrained(leaf.certPem)).toBe(false);
  });

  it("відкидає в сертифікаті публічні адреси й голе ім'я комп'ютера", async () => {
    const ca = await ensureCa(dir);
    const s = issueServerCert(ca, ["192.168.1.7", "8.8.8.8", "26.227.175.91", "DESKTOP-ABC", "pc.local", "example.com"]);
    expect(s.names).toEqual(expect.arrayContaining(["192.168.1.7", "pc.local", "localhost", "127.0.0.1"]));
    expect(s.names).not.toContain("8.8.8.8");
    expect(s.names).not.toContain("26.227.175.91");
    expect(s.names).not.toContain("DESKTOP-ABC");
    expect(s.names).not.toContain("example.com");
  });

  it("OpenSSL відхиляє сертифікат із публічною адресою, підписаний цим CA", async () => {
    const ca = await ensureCa(dir);
    // навмисно без фільтра: у SAN є 8.8.8.8, поза обмеженнями CA
    const bad = issueServerCert(ca, ["127.0.0.1", "8.8.8.8"], { filter: false });
    const srv = createServer({ key: bad.keyPem, cert: bad.certPem }, (_req, res) => res.end("ok"));
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    const port = (srv.address() as { port: number }).port;
    const err = await new Promise<string>((resolve) => {
      const req = request({ host: "127.0.0.1", port, ca: ca.certPem, path: "/" }, (res) => {
        res.resume();
        resolve("connected");
      });
      req.on("error", (e) => resolve(String(e)));
      req.end();
    });
    srv.close();
    expect(err).not.toBe("connected");
  });

  it("regenerateCa видає інший CA й чистить кеш серверного сертифіката", async () => {
    const { regenerateCa, ensureServerCert } = await import("./tls");
    const before = await ensureCa(dir);
    await ensureServerCert(dir, before, ["192.168.1.7"]);
    const after = await regenerateCa(dir);
    expect(after.certPem).not.toBe(before.certPem);
    const leaf = await ensureServerCert(dir, after, ["192.168.1.7"]);
    expect(leaf.certPem).toBeTruthy();
  });
});
