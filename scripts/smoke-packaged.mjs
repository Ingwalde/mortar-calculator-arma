// «Димовий» тест зібраного застосунку: запускає exe з тимчасовою папкою даних на вільних портах і перевіряє,
// що піднялись HTTP/HTTPS-сервер, сторінка, service worker, сертифікат і службові маршрути.
// Ловить клас помилок «збірка не стартує» (як було з імпортом electron-updater) ще до релізу.
//   node scripts/smoke-packaged.mjs [шлях до exe]      (типово dist/win-unpacked/Планшет мінометника.exe)
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request as httpsRequest } from "node:https";

const exe = process.argv[2] ?? "dist/win-unpacked/Планшет мінометника.exe";
if (!existsSync(exe)) {
  console.error(`✗ нема файлу: ${exe} (спершу npm run dist:win)`);
  process.exit(2);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const token = "SmokeTokenSmokeToken1234";
const port = await freePort();
const httpsPort = await freePort();
const dir = mkdtempSync(join(tmpdir(), "mortar-smoke-"));
writeFileSync(join(dir, "lan.json"), JSON.stringify({ enabled: true, port, httpsPort, token }));

const child = spawn(exe, [`--user-data-dir=${dir}`], { stdio: "ignore", windowsHide: true });
let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failed++;
};

function killTree() {
  try {
    if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGKILL");
  } catch {
    // уже завершився
  }
}

try {
  // 1. чекаємо HTTP
  const base = `http://127.0.0.1:${port}`;
  let up = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 40000) {
    if (child.exitCode !== null) break;
    try {
      const r = await fetch(`${base}/`);
      if (r.status > 0) {
        up = true;
        break;
      }
    } catch {
      await sleep(250);
    }
  }
  check(up, `HTTP-сервер піднявся${up ? ` за ${((Date.now() - t0) / 1000).toFixed(1)} с` : " (не піднявся: застосунок не стартує)"}`);
  if (!up) throw new Error("не стартував");

  const get = async (path, headers = {}) => {
    const r = await fetch(base + path, { headers });
    return { status: r.status, type: r.headers.get("content-type") ?? "", text: await r.text() };
  };
  const cookie = { cookie: `mk=${token}` };

  const unauth = await get("/");
  check(unauth.status === 401, "без токена — 401");
  const page = await get(`/?k=${token}`);
  check(page.status === 200 && page.text.includes('id="cv"'), "сторінка планшета віддається");
  const sw = await get("/sw.js", cookie);
  check(sw.status === 200 && /javascript/.test(sw.type), "service worker (sw.js) віддається");
  const manifest = await get("/manifest.webmanifest", cookie);
  check(manifest.status === 200 && manifest.text.includes("standalone"), "manifest.webmanifest");
  const store = await get("/api/store", cookie);
  check(store.status === 404 || store.status === 200, "стан (/api/store) відповідає");
  const stat = await get("/api/tilestat/everon", cookie);
  check(stat.status === 200 && stat.text.includes("avgBytes"), "оцінка тайлів (/api/tilestat)");
  const hRes = await fetch(`${base}/api/heights/bystrany`, { headers: cookie });
  const hBuf = hRes.ok ? Buffer.from(await hRes.arrayBuffer()) : null;
  check(!!hBuf && hBuf.length > 1_000_000 && hBuf.readInt32LE(0) > 100, "вбудовані висоти (стиснені) розпаковуються");
  const prof = await get(`/ca/mortar-tablet-ca.mobileconfig?k=${token}`);
  check(prof.status === 200 && prof.text.includes("com.apple.security.root"), "профіль довіри (.mobileconfig)");

  // 2. HTTPS із довірою лише до створеного CA
  const caFile = join(dir, "lan-ca.json");
  let caPem = null;
  for (let i = 0; i < 20 && !caPem; i++) {
    if (existsSync(caFile)) caPem = JSON.parse(readFileSync(caFile, "utf8")).certPem;
    else await sleep(250);
  }
  check(!!caPem, "локальний CA створено (lan-ca.json)");
  if (caPem) {
    const status = await new Promise((resolve) => {
      const req = httpsRequest({ host: "127.0.0.1", port: httpsPort, path: `/?k=${token}`, ca: caPem }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on("error", () => resolve(0));
      req.end();
    });
    check(status === 200, "HTTPS віддає сторінку з довірою до власного CA");
  }
} catch (e) {
  if (e.message !== "не стартував") {
    console.log(`✗ помилка: ${e.message}`);
    failed++;
  }
} finally {
  killTree();
  await sleep(500);
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // файли ще зайняті — тимчасова папка, не страшно
  }
}
console.log(failed ? `\nПровалено перевірок: ${failed}` : "\nУсі перевірки пройдено");
process.exit(failed ? 1 : 0);
