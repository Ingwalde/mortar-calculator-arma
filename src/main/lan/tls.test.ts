import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, request } from "node:https";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import forge from "node-forge";
import { ensureCa, issueServerCert, mobileconfig } from "./tls";

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
