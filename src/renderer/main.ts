import "./platform";
import { getRoot, loadState } from "./state";
import { resetView } from "./mapView";
import { initPanels } from "./panels";
import { $, toast } from "./dom";
import { isOwnShareUrl } from "@core/shareLink";
import { openIncomingShare } from "./exchange";
import { isNativeApp } from "./platform";
import { initWebUpdate } from "./webUpdate";
import { applyStaticTranslations, getLang, onLangChange, setLangSilent, t } from "./i18n";

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
  onLangChange(updateStatus);
  updateStatus();
  hideSplash();

  // Посилання обміну в адресі сторінки (#s=…): відкрити імпорт і прибрати фрагмент з адреси.
  const takeShareFromHash = (): void => {
    if (!location.hash.includes("s=")) return;
    void openIncomingShare(location.hash).then((handled) => {
      if (handled) history.replaceState(null, "", location.pathname + location.search);
    });
  };
  takeShareFromHash();
  window.addEventListener("hashchange", takeShareFromHash);
  if (__STANDALONE__ && isNativeApp) {
    // Android: посилання, відкрите через застосунок
    void import("@capacitor/app").then(({ App }) => {
      void App.addListener("appUrlOpen", (e) => {
        if (isOwnShareUrl(e.url)) void openIncomingShare(e.url);
      });
    });
  }
  initWebUpdate();

}

void boot().catch((e) => {
  hideSplash();
  throw e;
});
