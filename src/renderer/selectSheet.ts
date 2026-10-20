/**
 * Телефон: замість системного списку (на iPhone він сірий і не в кольорах теми) показуємо нижню панель вибору,
 * а список мови — перемикачем у рядок. Справжній <select> лишається в DOM: з нього читає решта коду, і саме на ньому
 * спрацьовує подія change, тож логіка застосунку не змінюється. На ПК нічого не робимо (там власний стиль списку в CSS).
 */
import { slideIndicator } from "./slider";
import { reducedMotion } from "./motion";
import { vibrate } from "./haptics";
import { getRoot } from "./state";

const touchOnly = (): boolean => typeof matchMedia === "function" && matchMedia("(hover: none) and (pointer: coarse)").matches;

let sheet: HTMLDialogElement | null = null;
let closing = false;

function labelOf(sel: HTMLSelectElement): string {
  const byFor = sel.id ? document.querySelector<HTMLLabelElement>(`label[for="${sel.id}"]`) : null;
  const wrapped = sel.closest("label")?.querySelector("span")?.textContent;
  return (byFor?.textContent || wrapped || sel.getAttribute("aria-label") || "").trim();
}

function fireChange(sel: HTMLSelectElement): void {
  sel.dispatchEvent(new Event("input", { bubbles: true }));
  sel.dispatchEvent(new Event("change", { bubbles: true }));
}

function closeSheet(fromPx = 0): void {
  if (!sheet || !sheet.open || closing) return;
  const d = sheet;
  if (reducedMotion()) {
    d.close();
    return;
  }
  const panel = d.querySelector<HTMLElement>(".selsheet-panel");
  if (!panel || typeof panel.animate !== "function") {
    d.close();
    return;
  }
  closing = true;
  d.classList.remove("in");
  const done = (): void => {
    closing = false;
    if (d.open) d.close();
  };
  const a = panel.animate([{ transform: fromPx ? `translateY(${fromPx}px)` : "none" }, { transform: "translateY(100%)" }], { duration: 200, easing: "ease-in", fill: "forwards" });
  a.onfinish = done;
  a.oncancel = done;
  setTimeout(done, 400);
}

function ensureSheet(): HTMLDialogElement {
  if (sheet) return sheet;
  const d = document.createElement("dialog");
  d.className = "selsheet";
  d.addEventListener("click", (e) => {
    if (e.target === d) closeSheet();
  });
  d.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeSheet();
  });
  document.body.appendChild(d);
  sheet = d;
  return d;
}

function openSheet(sel: HTMLSelectElement): void {
  if (sel.disabled) return;
  const d = ensureSheet();
  d.textContent = "";
  const panel = document.createElement("div");
  panel.className = "selsheet-panel";
  const grab = document.createElement("div");
  grab.className = "selsheet-grab";
  const head = document.createElement("div");
  head.className = "selsheet-head";
  const title = document.createElement("span");
  title.textContent = labelOf(sel);
  const x = document.createElement("button");
  x.type = "button";
  x.className = "selsheet-x";
  x.setAttribute("aria-label", "×");
  x.textContent = "×";
  x.onclick = () => closeSheet();
  head.append(title, x);
  const list = document.createElement("div");
  list.className = "selsheet-list";
  list.setAttribute("role", "listbox");
  let selectedBtn: HTMLElement | null = null;
  const addOption = (o: HTMLOptionElement, into: HTMLElement): void => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "selsheet-opt";
    b.setAttribute("role", "option");
    const txt = document.createElement("span");
    txt.textContent = o.textContent ?? "";
    const tick = document.createElement("span");
    tick.className = "selsheet-tick";
    tick.textContent = "✓";
    b.append(txt, tick);
    b.disabled = o.disabled;
    const on = o.value === sel.value;
    b.setAttribute("aria-selected", on ? "true" : "false");
    if (on) selectedBtn = b;
    b.onclick = () => {
      const changed = sel.value !== o.value;
      sel.value = o.value;
      if (getRoot().vibration) vibrate(10);
      closeSheet();
      if (changed) fireChange(sel);
    };
    into.appendChild(b);
  };
  for (const child of Array.from(sel.children)) {
    if (child instanceof HTMLOptGroupElement) {
      const gh = document.createElement("div");
      gh.className = "selsheet-group";
      gh.textContent = child.label;
      list.appendChild(gh);
      for (const o of Array.from(child.children)) if (o instanceof HTMLOptionElement) addOption(o, list);
    } else if (child instanceof HTMLOptionElement) {
      addOption(child, list);
    }
  }
  panel.append(grab, head, list);
  // свайп вниз за верхню частину (смужку й заголовок) закриває панель
  let startY = 0;
  let dy = 0;
  let dragging = false;
  const top = [grab, head];
  for (const zone of top) {
    zone.style.touchAction = "none";
    zone.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).closest(".selsheet-x")) return;
      dragging = true;
      startY = e.clientY;
      dy = 0;
      try {
        zone.setPointerCapture(e.pointerId);
      } catch {
        // без захоплення вказівника свайп усе одно працює, поки палець над зоною
      }
    });
    zone.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      dy = Math.max(0, e.clientY - startY);
      panel.style.transform = `translateY(${dy}px)`;
    });
    const end = (): void => {
      if (!dragging) return;
      dragging = false;
      if (dy > 80) closeSheet(dy);
      else {
        panel.style.transform = "";
        if (dy > 0 && typeof panel.animate === "function") panel.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 180, easing: "ease-out" });
      }
    };
    zone.addEventListener("pointerup", end);
    zone.addEventListener("pointercancel", end);
  }
  d.appendChild(panel);
  if (!d.open) d.showModal();
  void d.offsetHeight;
  d.classList.add("in");
  // виїзд знизу: через Web Animations, щоб він працював і там, де CSS-перехід одразу після showModal() пропускається (Safari)
  if (!reducedMotion() && typeof panel.animate === "function") {
    panel.animate([{ transform: "translateY(100%)" }, { transform: "none" }], { duration: 280, easing: "cubic-bezier(.2,.8,.2,1)" });
  }
  requestAnimationFrame(() => (selectedBtn as HTMLElement | null)?.scrollIntoView({ block: "center" }));
}

function wrapTrigger(sel: HTMLSelectElement): void {
  const wrap = document.createElement("span");
  wrap.className = "selbox";
  const cs = getComputedStyle(sel);
  if (cs.display === "block" || sel.closest(".field")) wrap.classList.add("block");
  // обгортка бере на себе розміщення списку у батьківському рядку (flex, max-width), інакше шапка «з'їжджає»
  if (parseFloat(cs.flexGrow) > 0) {
    wrap.classList.add("grow");
    wrap.style.flex = cs.flex;
  }
  if (cs.maxWidth !== "none") wrap.style.maxWidth = cs.maxWidth;
  sel.parentNode?.insertBefore(wrap, sel);
  wrap.appendChild(sel);
  sel.classList.add("sel-touch");
  const hit = document.createElement("button");
  hit.type = "button";
  hit.className = "selbox-hit";
  hit.setAttribute("aria-label", labelOf(sel) || "select");
  hit.onclick = () => openSheet(sel);
  wrap.appendChild(hit);
  sel.tabIndex = -1;
}

function segmentedLanguage(sel: HTMLSelectElement): void {
  const seg = document.createElement("div");
  seg.className = "seg selseg";
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", labelOf(sel));
  const btns = new Map<string, HTMLButtonElement>();
  for (const o of Array.from(sel.options)) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = o.textContent ?? "";
    b.onclick = () => {
      if (sel.value === o.value) return;
      sel.value = o.value;
      fireChange(sel);
    };
    btns.set(o.value, b);
    seg.appendChild(b);
  }
  const refresh = (): void => {
    for (const [v, b] of btns) b.setAttribute("aria-pressed", v === sel.value ? "true" : "false");
  };
  // значення мови виставляє код (sel.value = …) — підхоплюємо, щоб перемикач не відставав
  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  if (desc?.get && desc.set) {
    const { get, set } = desc;
    Object.defineProperty(sel, "value", {
      configurable: true,
      get() {
        return get.call(sel) as string;
      },
      set(v: string) {
        set.call(sel, v);
        refresh();
      }
    });
  }
  sel.classList.add("sel-hidden");
  sel.after(seg);
  refresh();
  slideIndicator(seg, { active: 'button[aria-pressed="true"]' });
}

export function initSelectSheets(): void {
  if (!touchOnly()) return;
  for (const sel of Array.from(document.querySelectorAll<HTMLSelectElement>("select"))) {
    if (sel.id === "langSel") segmentedLanguage(sel);
    else wrapTrigger(sel);
  }
}
