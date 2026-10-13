import { t } from "./i18n";

export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} не знайдено`);
  return el as T;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(text: string, ms = 2200): void {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("on"), ms);
}

export interface AskField {
  key: string;
  label: string;
  type?: string;
  value?: string;
}

/** Модальне діалогове вікно замість window.confirm/prompt. */
export function ask(title: string, text: string, yesLabel?: string, fields?: AskField[]): Promise<Record<string, string> | null> {
  return new Promise((resolve) => {
    const dlg = $<HTMLDialogElement>("ask");
    $("askTitle").textContent = title;
    const askText = $("askText");
    askText.textContent = text || "";
    askText.hidden = !text;
    $<HTMLButtonElement>("askYes").textContent = yesLabel || t("yes");

    const box = $("askFields");
    box.textContent = "";
    const inputs: Array<[string, HTMLInputElement]> = [];
    for (const f of fields || []) {
      const wrap = document.createElement("div");
      wrap.className = "field";
      wrap.style.marginBottom = "8px";
      const label = document.createElement("label");
      label.textContent = f.label;
      const input = document.createElement("input");
      input.id = "ask_" + f.key;
      label.htmlFor = input.id;
      if (f.type) input.type = f.type;
      input.value = f.value || "";
      wrap.append(label, input);
      box.appendChild(wrap);
      inputs.push([f.key, input]);
    }

    let done = false;
    const finish = (v: Record<string, string> | null) => {
      if (done) return;
      done = true;
      dlg.close();
      resolve(v);
    };
    $<HTMLButtonElement>("askNo").onclick = () => finish(null);
    dlg.oncancel = () => finish(null);
    $<HTMLFormElement>("askForm").onsubmit = (e) => {
      e.preventDefault();
      const out: Record<string, string> = {};
      for (const [k, i] of inputs) out[k] = i.value;
      finish(out);
    };
    dlg.showModal();
    inputs[0]?.[1].focus();
  });
}
