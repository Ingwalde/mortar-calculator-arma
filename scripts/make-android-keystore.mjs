// Створює ключ підпису Android-застосунку (PKCS12) і кладе його в секрети репозиторію GitHub.
// Ключ потрібен ОДИН раз і назавжди: оновлення APK встановлюються лише поверх застосунку, підписаного тим самим ключем.
//   node scripts/make-android-keystore.mjs <папка для ключа поза репозиторієм>
// Файл release.p12 і пароль лягають у вказану папку (збережіть копію!), у GitHub — секрети
// ANDROID_KEYSTORE_B64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import forge from "node-forge";

const dir = process.argv[2];
if (!dir) {
  console.error("Вкажіть папку для ключа (поза репозиторієм).");
  process.exit(2);
}
const file = join(dir, "release.p12");
if (existsSync(file)) {
  console.error(`Ключ уже є: ${file} — не перезаписую (це зламало б оновлення встановлених застосунків).`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });

const alias = "mortar-tablet";
const password = randomBytes(18).toString("base64url");
const keys = forge.pki.rsa.generateKeyPair(2048);
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = "01" + randomBytes(8).toString("hex");
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date(Date.now() + 30 * 365 * 86400000);
const attrs = [{ name: "commonName", value: "Mortar Tablet" }];
cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.sign(keys.privateKey, forge.md.sha256.create());
const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { algorithm: "3des", friendlyName: alias });
const der = Buffer.from(forge.asn1.toDer(p12).getBytes(), "binary");
writeFileSync(file, der);
writeFileSync(join(dir, "release.password.txt"), password);

const set = (name, value) => execFileSync("gh", ["secret", "set", name], { input: value, stdio: ["pipe", "inherit", "inherit"] });
set("ANDROID_KEYSTORE_B64", der.toString("base64"));
set("ANDROID_KEYSTORE_PASSWORD", password);
set("ANDROID_KEY_ALIAS", alias);
console.log(`Ключ: ${file} (збережіть копію, пароль у release.password.txt). Секрети GitHub встановлено.`);
