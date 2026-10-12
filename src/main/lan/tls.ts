/**
 * Локальний центр сертифікації (CA) і серверний сертифікат для HTTPS у локальній мережі.
 *
 * Навіщо: service worker (офлайн-режим телефона) працює лише в «безпечному контексті», а iPhone не вважає
 * http://192.168.x.x безпечним. Тому застосунок сам створює кореневий сертифікат, який користувач один раз
 * встановлює на телефон (профіль), і видає ним сертифікат для IP-адрес ПК. Закритий ключ CA лишається
 * лише на ПК (userData/lan-ca.json).
 *
 * Без залежності від Electron: каталог передається аргументом (тестується напряму).
 */
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import forge from "node-forge";

export interface CaMaterial {
  /** PEM кореневого сертифіката. */
  certPem: string;
  /** DER того самого сертифіката (для профілю iOS і .crt). */
  certDer: Buffer;
  /** PEM закритого ключа CA. */
  keyPem: string;
}

export interface ServerCert {
  keyPem: string;
  certPem: string;
  /** IP-адреси й імена, що ввійшли до сертифіката (SAN). */
  names: string[];
}

const CA_FILE = "lan-ca.json";
const CA_YEARS = 10;
const LEAF_DAYS = 397; // iOS відхиляє серверні сертифікати довші за 398 днів
const DAY = 24 * 3600 * 1000;

function serial(): string {
  // додатне число без старшого біта
  const hex = randomBytes(16).toString("hex");
  return "0" + hex.slice(1);
}

function newRsaKey(): { keyPem: string; privateKey: forge.pki.rsa.PrivateKey; publicKey: forge.pki.rsa.PublicKey } {
  const { privateKey: pem } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs1", format: "pem" }
  });
  const privateKey = forge.pki.privateKeyFromPem(pem);
  const publicKey = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e);
  return { keyPem: pem, privateKey, publicKey };
}

function derOf(cert: forge.pki.Certificate): Buffer {
  return Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), "binary");
}

function createCa(): CaMaterial {
  const { keyPem, privateKey, publicKey } = newRsaKey();
  const cert = forge.pki.createCertificate();
  cert.publicKey = publicKey;
  cert.serialNumber = serial();
  cert.validity.notBefore = new Date(Date.now() - DAY);
  cert.validity.notAfter = new Date(Date.now() + CA_YEARS * 365 * DAY);
  const subject = [
    { name: "commonName", value: "Mortar Tablet Local CA" },
    { name: "organizationName", value: "Mortar Tablet" }
  ];
  cert.setSubject(subject);
  cert.setIssuer(subject);
  cert.setExtensions([
    { name: "basicConstraints", cA: true, critical: true },
    { name: "keyUsage", keyCertSign: true, cRLSign: true, critical: true },
    { name: "subjectKeyIdentifier" }
  ]);
  cert.sign(privateKey, forge.md.sha256.create());
  return { certPem: forge.pki.certificateToPem(cert), certDer: derOf(cert), keyPem };
}

/** Читає CA з диска або створює новий (один раз; далі той самий, щоб телефон лишався довірливим). */
export async function ensureCa(dir: string): Promise<CaMaterial> {
  const path = join(dir, CA_FILE);
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as { certPem?: string; keyPem?: string };
    if (typeof raw.certPem === "string" && typeof raw.keyPem === "string") {
      const cert = forge.pki.certificateFromPem(raw.certPem);
      if (cert.validity.notAfter.getTime() > Date.now() + 30 * DAY) {
        return { certPem: raw.certPem, certDer: derOf(cert), keyPem: raw.keyPem };
      }
    }
  } catch {
    // нема файлу або пошкоджений — створюємо новий
  }
  const ca = createCa();
  await mkdir(dir, { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify({ certPem: ca.certPem, keyPem: ca.keyPem }), "utf8");
  await rename(tmp, path);
  return ca;
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Видає серверний сертифікат на вказані IP-адреси/імена, підписаний нашим CA. */
export function issueServerCert(ca: CaMaterial, names: string[]): ServerCert {
  const uniq = [...new Set(names.filter((n) => n.length > 0))];
  if (!uniq.includes("localhost")) uniq.push("localhost");
  if (!uniq.includes("127.0.0.1")) uniq.push("127.0.0.1");
  const { keyPem, publicKey } = newRsaKey();
  const caCert = forge.pki.certificateFromPem(ca.certPem);
  const caKey = forge.pki.privateKeyFromPem(ca.keyPem);

  const cert = forge.pki.createCertificate();
  cert.publicKey = publicKey;
  cert.serialNumber = serial();
  cert.validity.notBefore = new Date(Date.now() - DAY);
  cert.validity.notAfter = new Date(Date.now() + LEAF_DAYS * DAY);
  cert.setSubject([{ name: "commonName", value: "Mortar Tablet LAN server" }]);
  cert.setIssuer(caCert.subject.attributes);
  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, keyEncipherment: true, critical: true },
    { name: "extKeyUsage", serverAuth: true },
    {
      name: "subjectAltName",
      altNames: uniq.map((n) => (IPV4.test(n) ? { type: 7, ip: n } : { type: 2, value: n }))
    }
  ]);
  cert.sign(caKey, forge.md.sha256.create());
  return { keyPem, certPem: forge.pki.certificateToPem(cert), names: uniq };
}

/**
 * Профіль конфігурації iOS (.mobileconfig) із кореневим сертифікатом: після встановлення й ввімкнення
 * довіри (Налаштування → Загальні → Про пристрій → Довіра сертифікатам) телефон довіряє серверу.
 */
export function mobileconfig(certDer: Buffer): string {
  const b64 = certDer.toString("base64").replace(/(.{64})/g, "$1\n");
  const uuid = (): string => {
    const h = randomBytes(16).toString("hex");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`.toUpperCase();
  };
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadCertificateFileName</key><string>mortar-tablet-ca.cer</string>
      <key>PayloadContent</key>
      <data>
${b64}
      </data>
      <key>PayloadDescription</key><string>Кореневий сертифікат локального сервера «Планшет мінометника»</string>
      <key>PayloadDisplayName</key><string>Планшет мінометника — локальний CA</string>
      <key>PayloadIdentifier</key><string>com.mortartablet.ca.cert</string>
      <key>PayloadType</key><string>com.apple.security.root</string>
      <key>PayloadUUID</key><string>${uuid()}</string>
      <key>PayloadVersion</key><integer>1</integer>
    </dict>
  </array>
  <key>PayloadDisplayName</key><string>Планшет мінометника</string>
  <key>PayloadIdentifier</key><string>com.mortartablet.ca</string>
  <key>PayloadRemovalDisallowed</key><false/>
  <key>PayloadType</key><string>Configuration</string>
  <key>PayloadUUID</key><string>${uuid()}</string>
  <key>PayloadVersion</key><integer>1</integer>
</dict>
</plist>
`;
}
