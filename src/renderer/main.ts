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
import { reducedMotion } from "./motion";
import { initSelectSheets } from "./selectSheet";

/** Заставку з іконкою знімаємо, щойно стан завантажено й інтерфейс готовий. */
function hideSplash(): void {
  const el = document.getElementById("splash");
  if (!el) return;
  // дамо анімації емблеми дограти (≈1 с від старту), але не затримуємо запуск довше
  const wait = reducedMotion() ? 0 : Math.max(0, 1100 - performance.now());
  setTimeout(() => {
    el.classList.add("done");
    setTimeout(() => el.remove(), 400);
  }, wait);
}

function updateStatus(): void {
  $("status").textContent = t("statusSaved");
}
window.addEventListener("mortar:storage-error", () => toast(t("storageFailed")));

async function boot(): Promise<void> {
  await loadState();
  setLangSilent(getRoot().lang);
  document.documentElement.lang = getLang();
  applyStaticTranslations();
  resetView();
  initPanels();
  initSelectSheets();
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
