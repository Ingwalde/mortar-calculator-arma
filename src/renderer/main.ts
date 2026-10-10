import "./platform";
import { getRoot, loadState, scheduleSave } from "./state";
import { resetView } from "./mapView";
import { initPanels } from "./panels";
import { $ } from "./dom";
import { applyStaticTranslations, getLang, setLang, setLangSilent, t } from "./i18n";

async function boot(): Promise<void> {
  await loadState();
  setLangSilent(getRoot().lang);
  document.documentElement.lang = getLang();
  applyStaticTranslations();
  resetView();
  initPanels();
  $("status").textContent = t("statusSaved");

  $<HTMLButtonElement>("langBtn").onclick = () => {
    const next = getLang() === "uk" ? "en" : "uk";
    setLang(next);
    getRoot().lang = next;
    scheduleSave();
    $("status").textContent = t("statusSaved");
  };
}

void boot();
