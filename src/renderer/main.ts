import "./platform";
import { getRoot, loadState, scheduleSave } from "./state";
import { resetView } from "./mapView";
import { initPanels } from "./panels";
import { $ } from "./dom";
import { applyStaticTranslations, getLang, setLang, setLangSilent, t } from "./i18n";

/** Заставку з іконкою знімаємо, щойно стан завантажено й інтерфейс готовий. */
function hideSplash(): void {
  const el = document.getElementById("splash");
  if (!el) return;
  el.classList.add("done");
  setTimeout(() => el.remove(), 400);
}

async function boot(): Promise<void> {
  await loadState();
  setLangSilent(getRoot().lang);
  document.documentElement.lang = getLang();
  applyStaticTranslations();
  resetView();
  initPanels();
  $("status").textContent = t("statusSaved");
  hideSplash();

  $<HTMLButtonElement>("langBtn").onclick = () => {
    const next = getLang() === "uk" ? "en" : "uk";
    setLang(next);
    getRoot().lang = next;
    scheduleSave();
    $("status").textContent = t("statusSaved");
  };
}

void boot().catch((e) => {
  hideSplash();
  throw e;
});
