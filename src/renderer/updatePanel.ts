import { toast } from "./dom";
import { t } from "./i18n";
import { isRemote } from "./platform";

type Status = { state: string; version?: string; percent?: number; message?: string; url?: string };

let last: Status = { state: "idle" };
let box: HTMLElement | null = null;

function text(s: Status): string {
  switch (s.state) {
    case "checking":
      return t("updChecking");
    case "available":
      return t("updAvailable", { v: s.version ?? "" });
    case "downloading":
      return t("updProgress", { p: s.percent ?? 0 });
    case "ready":
      return t("updReady", { v: s.version ?? "" });
    case "manual":
      return t("updManual", { v: s.version ?? "" });
    case "none":
      return t("updNone");
    case "error":
      return t("updError");
    case "unsupported":
      return t("updUnsupported");
    default:
      return "";
  }
}

function paint(): void {
  if (!box) return;
  box.textContent = "";
  const line = document.createElement("p");
  line.className = "hint";
  line.textContent = `${t("updCurrent", { v: __APP_VERSION__ })}${text(last) ? " · " + text(last) : ""}`;
  box.appendChild(line);
  if (last.state === "ready") {
    const b = document.createElement("button");
    b.className = "btn primary";
    b.textContent = t("updInstallBtn");
    b.onclick = () => void window.api.updater.install();
    box.appendChild(b);
  } else if (last.state === "manual" && last.url) {
    const url = last.url;
    const b = document.createElement("button");
    b.className = "btn primary";
    b.textContent = t("updOpenPage");
    b.onclick = () => window.open(url, "_blank", "noopener");
    box.appendChild(b);
  } else if (last.state !== "unsupported") {
    const b = document.createElement("button");
    b.className = "btn small";
    b.textContent = t("updCheckBtn");
    b.disabled = last.state === "checking" || last.state === "downloading";
    b.onclick = () => void window.api.updater.check();
    box.appendChild(b);
  }
}

/** Рядок «Версія … · стан оновлення» з кнопками — у діалозі «Про програму» (лише на ПК). */
export function mountUpdateBox(container: Element): void {
  if (isRemote) return;
  box = document.createElement("div");
  box.className = "update-box";
  container.prepend(box);
  paint();
  void window.api.updater.status().then((s) => {
    last = s;
    paint();
  });
}

export function initUpdater(): void {
  if (isRemote) return;
  window.api.updater.onStatus((s) => {
    const was = last.state;
    last = s;
    paint();
    if (s.state === "ready" && was !== "ready") toast(t("updReady", { v: s.version ?? "" }));
  });
}
