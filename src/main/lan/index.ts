import { app } from "electron";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { join } from "node:path";
import QRCode from "qrcode";
import { getOnlineTile, getPyramidTile } from "../protocols";
import { loadStore, saveStore, storeEvents } from "../store";
import { readHeights } from "../tiles/heights";
import { createLanServer, type LanServer } from "./server";

export interface LanInfo {
  enabled: boolean;
  port: number;
  /** Повні посилання з токеном — за ними телефон заходить у планшет. */
  urls: string[];
  error: string | null;
}

interface LanSettings {
  enabled: boolean;
  port: number;
  token: string;
}

const DEFAULT_PORT = 8765;
const SETTINGS_FILE = "lan.json";

// Віртуальні адаптери (Docker/WSL/VPN/VirtualBox…) не досяжні з телефона — ховаємо їх у списку.
const VIRTUAL_IFACE = /vethernet|virtualbox|vmware|vmnet|docker|wsl|hyper-v|loopback|tailscale|zerotier|tap|tun/i;

let settings: LanSettings | null = null;
let server: LanServer | null = null;
let lastError: string | null = null;

function settingsPath(): string {
  return join(app.getPath("userData"), SETTINGS_FILE);
}

function newToken(): string {
  return randomBytes(18).toString("base64url");
}

async function loadSettings(): Promise<LanSettings> {
  if (settings) return settings;
  let s: LanSettings = { enabled: false, port: DEFAULT_PORT, token: newToken() };
  try {
    const raw = JSON.parse(await readFile(settingsPath(), "utf8")) as Partial<LanSettings>;
    s = {
      enabled: raw.enabled === true,
      port: Number.isInteger(raw.port) && raw.port! > 1023 && raw.port! < 65536 ? raw.port! : DEFAULT_PORT,
      token: typeof raw.token === "string" && raw.token.length >= 16 ? raw.token : s.token
    };
  } catch {
    // нема файлу — використовуємо типові значення зі свіжим токеном
  }
  settings = s;
  return s;
}

async function persist(): Promise<void> {
  if (!settings) return;
  await mkdir(app.getPath("userData"), { recursive: true });
  const tmp = `${settingsPath()}.tmp`;
  await writeFile(tmp, JSON.stringify(settings), "utf8");
  await rename(tmp, settingsPath());
}

function addressScore(ip: string): number {
  if (ip.startsWith("192.168.")) return 0;
  if (ip.startsWith("10.")) return 1;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2;
  return 3;
}

export function lanAddresses(): string[] {
  const found: string[] = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    if (VIRTUAL_IFACE.test(name)) continue;
    for (const a of list ?? []) {
      if (a.family !== "IPv4" || a.internal || a.address.startsWith("169.254.")) continue;
      found.push(a.address);
    }
  }
  return found.sort((a, b) => addressScore(a) - addressScore(b));
}

async function startServer(s: LanSettings): Promise<void> {
  const isDev = !app.isPackaged;
  const srv = createLanServer(
    {
      staticDir: join(app.getAppPath(), "out/renderer"),
      devProxyUrl: isDev ? (process.env.ELECTRON_RENDERER_URL ?? null) : null,
      loadStore,
      saveStore,
      readHeights: (id) => readHeights(id),
      onlineTile: getOnlineTile,
      pyramidTile: getPyramidTile
    },
    s.token
  );
  try {
    await srv.listen(s.port);
    server = srv;
    lastError = null;
  } catch (err) {
    server = null;
    const code = (err as NodeJS.ErrnoException).code;
    lastError = code === "EADDRINUSE" ? `Порт ${s.port} зайнятий іншою програмою.` : String((err as Error).message ?? err);
  }
}

async function stopServer(): Promise<void> {
  const srv = server;
  server = null;
  if (srv) await srv.close();
}

export async function getLanInfo(): Promise<LanInfo> {
  const s = await loadSettings();
  const running = server !== null;
  return {
    enabled: s.enabled && running,
    port: s.port,
    urls: running ? lanAddresses().map((ip) => `http://${ip}:${s.port}/?k=${s.token}`) : [],
    error: lastError
  };
}

export async function setLanEnabled(enabled: boolean): Promise<LanInfo> {
  const s = await loadSettings();
  s.enabled = enabled;
  await persist();
  await stopServer();
  lastError = null;
  if (enabled) await startServer(s);
  return getLanInfo();
}

/** Новий токен — старі посилання/QR перестають працювати, підключені клієнти відвалюються. */
export async function regenerateLanToken(): Promise<LanInfo> {
  const s = await loadSettings();
  s.token = newToken();
  await persist();
  if (s.enabled) {
    await stopServer();
    await startServer(s);
  }
  return getLanInfo();
}

export async function lanQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
}

/** Викликати після app.whenReady(): піднімає сервер, якщо користувач вмикав його раніше. */
export async function initLan(): Promise<void> {
  const s = await loadSettings();
  storeEvents.on("saved", (source: string) => server?.notifyChanged(source));
  if (s.enabled) await startServer(s);
}

export async function shutdownLan(): Promise<void> {
  await stopServer();
}
