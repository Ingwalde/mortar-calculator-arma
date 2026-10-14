import "./platform";
import { getRoot, loadState, scheduleSave } from "./state";
import { resetView } from "./mapView";
import { initPanels } from "./panels";
import { $, toast } from "./dom";
import { applyStaticTranslations, getLang, setLang, setLangSilent, t } from "./i18n";

/** Заставку з іконкою знімаємо, щойно стан завантажено й інтерфейс готовий. */
function hideSplash(): void {
  const el = document.getElementById("splash");
  if (!el) return;
  el.classList.add("done");
  setTimeout(() => el.remove(), 400);
}

let offline = false;
let pending = 0;
function updateStatus(): void {
  $("status").textContent = offline
    ? pending > 0
      ? t("statusOfflinePending", { n: pending })
      : t("statusOffline")
    : t("statusSaved");
}
window.addEventListener("mortar:pending", (e) => {
  pending = (e as CustomEvent<{ count: number }>).detail.count;
  updateStatus();
});
window.addEventListener("mortar:storage-error", () => toast(t("storageFailed")));
window.addEventListener("mortar:connectivity", (e) => {
  offline = !(e as CustomEvent<{ online: boolean }>).detail.online;
  updateStatus();
});

async function boot(): Promise<void> {
  await loadState();
  setLangSilent(getRoot().lang);
  document.documentElement.lang = getLang();
  applyStaticTranslations();
  resetView();
  initPanels();
  updateStatus();
  hideSplash();

  $<HTMLButtonElement>("langBtn").onclick = () => {
    const next = getLang() === "uk" ? "en" : "uk";
    setLang(next);
    getRoot().lang = next;
    scheduleSave();
    updateStatus();
  };
}

void boot().catch((e) => {
  hideSplash();
  throw e;
});
