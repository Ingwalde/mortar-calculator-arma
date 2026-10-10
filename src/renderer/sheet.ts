/**
 * Нижня панель на вузьких екранах (телефон): бровка зверху панелі тягнеться вгору/вниз,
 * тап ховає панель до самої бровки й повертає назад. Висота запам'ятовується між запусками.
 * На широких екранах панель збоку, бровка прихована CSS-ом, тож тут нічого не відбувається.
 */
import { $ } from "./dom";
import { t } from "./i18n";

const STORAGE_KEY = "mortar.sheet";
/** Висота панелі, коли видно лише бровку. */
const HANDLE_H = 30;
/** Нижче цієї висоти після перетягування панель "прилипає" до бровки. */
const SNAP_COLLAPSE = 96;
const MAX_FRACTION = 0.86;

interface SheetPref {
  height: number;
  collapsed: boolean;
}

function loadPref(): SheetPref | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<SheetPref> | null;
    if (raw && Number.isFinite(raw.height)) return { height: Number(raw.height), collapsed: raw.collapsed === true };
  } catch {
    // сховище недоступне — працюємо з типовими значеннями
  }
  return null;
}

function savePref(p: SheetPref): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // не критично
  }
}

export function initSheet(): void {
  const app = document.querySelector<HTMLElement>(".app")!;
  const handle = $<HTMLButtonElement>("sheetHandle");

  const maxHeight = () => Math.round(window.innerHeight * MAX_FRACTION);
  const defaultHeight = () => Math.min(Math.round(window.innerHeight * 0.48), 440);
  const clamp = (h: number) => Math.min(maxHeight(), Math.max(HANDLE_H, h));

  const pref: SheetPref = loadPref() ?? { height: defaultHeight(), collapsed: false };
  pref.height = clamp(Math.max(pref.height, SNAP_COLLAPSE));

  function apply(height: number, collapsed: boolean): void {
    app.classList.toggle("sheet-collapsed", collapsed);
    app.style.setProperty("--sheet-h", (collapsed ? HANDLE_H : height) + "px");
    handle.setAttribute("aria-expanded", String(!collapsed));
  }
  apply(pref.height, pref.collapsed);

  let startY = 0;
  let startH = 0;
  /** Висота до початку тяги — до неї повертаємось, якщо панель стягнули до бровки. */
  let heightBeforeDrag = pref.height;
  let dragging = false;
  let moved = false;

  /** Висота, яку чекає наступний кадр: оновлюємо стиль не частіше за один раз на кадр. */
  let pendingH: number | null = null;
  const mapWrap = document.getElementById("mapWrap")!;

  handle.addEventListener("pointerdown", (e) => {
    dragging = true;
    moved = false;
    // Карта не змінює розмір, поки бровку тягнуть: інакше полотно перевиділялось би на кожен рух пальця.
    app.style.setProperty("--map-bottom", getComputedStyle(mapWrap).bottom);
    startY = e.clientY;
    startH = pref.collapsed ? HANDLE_H : pref.height;
    heightBeforeDrag = pref.height;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dy = startY - e.clientY;
    if (!moved && Math.abs(dy) < 5) return;
    moved = true;
    const h = clamp(startH + dy);
    app.classList.add("dragging");
    // Під час тяги показуємо реальну висоту; нижче порогу відпустка прилипне до бровки.
    app.classList.remove("sheet-collapsed");
    pref.collapsed = h < SNAP_COLLAPSE;
    if (!pref.collapsed) pref.height = h;
    if (pendingH === null) {
      requestAnimationFrame(() => {
        if (pendingH !== null) app.style.setProperty("--sheet-h", pendingH + "px");
        pendingH = null;
      });
    }
    pendingH = h;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    pendingH = null;
    app.classList.remove("dragging");
    app.style.removeProperty("--map-bottom");
    if (moved) {
      if (pref.collapsed) pref.height = heightBeforeDrag;
      apply(pref.height, pref.collapsed);
      savePref(pref);
    }
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);

  // Тап/Enter/Space: сховати до бровки чи розгорнути. Click після перетягування ігноруємо.
  handle.addEventListener("click", () => {
    if (moved) {
      moved = false;
      return;
    }
    pref.collapsed = !pref.collapsed;
    apply(pref.height, pref.collapsed);
    savePref(pref);
  });

  // Відкрили вкладку — панель має бути видимою.
  document.querySelector(".tabs")!.addEventListener("click", () => {
    if (!pref.collapsed) return;
    pref.collapsed = false;
    apply(pref.height, false);
    savePref(pref);
  });

  window.addEventListener("resize", () => {
    pref.height = clamp(pref.height);
    apply(pref.height, pref.collapsed);
  });
}

/**
 * Режим «карта на весь екран»: ховає шапку, панель і кнопку мітки — лишаються карта, приціл,
 * координати під ним і кнопки масштабу. Вихід — та сама кнопка або Esc.
 */
export function initImmersive(): void {
  const app = document.querySelector<HTMLElement>(".app")!;
  const btn = $<HTMLButtonElement>("immersiveBtn");

  function set(on: boolean): void {
    app.classList.toggle("immersive", on);
    btn.setAttribute("aria-pressed", String(on));
    const key = on ? "immersiveExitAria" : "immersiveAria";
    btn.dataset.i18nAriaLabel = key;
    btn.setAttribute("aria-label", t(key));
  }

  btn.onclick = () => set(!app.classList.contains("immersive"));
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !app.classList.contains("immersive")) return;
    if (document.querySelector("dialog[open]")) return;
    set(false);
  });
}
