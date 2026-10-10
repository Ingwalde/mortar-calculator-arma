import { $, ask, toast } from "./dom";
import { t } from "./i18n";
import { isRemote } from "./platform";
import type { LanInfo } from "../preload/index";

/** Секція «Перегляд з телефона» у вкладці «Карта» — вмикає LAN-сервер і показує посилання та QR. */
let info: LanInfo | null = null;
let qrToken = 0;

function selectedUrl(): string {
  return $<HTMLSelectElement>("lanUrlSel").value;
}

async function drawQr(): Promise<void> {
  const url = selectedUrl();
  const my = ++qrToken;
  const box = $("lanQr");
  if (!url) {
    box.textContent = "";
    return;
  }
  const svg = await window.api.lan.qr(url);
  if (my === qrToken) box.innerHTML = svg;
}

function render(next: LanInfo): void {
  info = next;
  $<HTMLInputElement>("lanToggle").checked = next.enabled;
  const details = $("lanDetails");
  details.hidden = !next.enabled || next.urls.length === 0;

  const warn = $("lanWarn");
  if (next.error) {
    warn.hidden = false;
    warn.textContent = t("lanError", { msg: next.error });
  } else if (next.enabled && next.urls.length === 0) {
    warn.hidden = false;
    warn.textContent = t("lanNoNetwork");
  } else {
    warn.hidden = true;
  }

  const sel = $<HTMLSelectElement>("lanUrlSel");
  const previous = sel.value;
  sel.textContent = "";
  for (const url of next.urls) {
    // Токен у видимому підписі не показуємо — лише адреса й порт; повне посилання лежить у value.
    sel.appendChild(new Option(url.replace(/\?k=.*$/, "").replace(/^http:\/\//, ""), url));
  }
  if (next.urls.includes(previous)) sel.value = previous;
  sel.hidden = next.urls.length < 2;
  void drawQr();
}

export async function refreshLanPanel(): Promise<void> {
  if (isRemote) return;
  render(await window.api.lan.info());
}

export function initLanPanel(): void {
  if (isRemote) {
    $("lanBox").hidden = true;
    return;
  }

  $<HTMLInputElement>("lanToggle").onchange = async (e) => {
    const on = (e.target as HTMLInputElement).checked;
    render(await window.api.lan.setEnabled(on));
  };
  $<HTMLSelectElement>("lanUrlSel").onchange = () => void drawQr();

  $<HTMLButtonElement>("lanCopy").onclick = async () => {
    const url = selectedUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast(t("lanCopied"));
    } catch {
      // clipboard недоступний — користувач може відсканувати QR
    }
  };

  $<HTMLButtonElement>("lanRegen").onclick = async () => {
    const ok = await ask(t("lanRegenTitle"), t("lanRegenText"), t("lanRegenBtn"));
    if (!ok) return;
    render(await window.api.lan.regenerate());
    toast(t("lanRegenDone"));
  };

  void refreshLanPanel();
}

/** Перемальовує підписи після зміни мови (стан не міняємо). */
export function relocalizeLanPanel(): void {
  if (info) render(info);
}
