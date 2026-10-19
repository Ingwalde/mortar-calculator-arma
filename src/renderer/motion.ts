/**
 * Дрібні анімації інтерфейсу: плавна зміна чисел, поява й зникання рядків списків, ефект натискання на великих кнопках.
 * Усе вимикається системним «зменшити рухи» (prefers-reduced-motion).
 */
export function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const running = new Map<string, number>();

/**
 * Плавно змінює число в текстовому вузлі від `from` до `to`. Новий виклик із тим самим `key` скасовує попередній.
 * wrap360 — кут: ідемо найкоротшим шляхом через 0°/360°.
 */
export function tweenNumber(key: string, node: Text, from: number | undefined, to: number, fmt: (n: number) => string, opts: { ms?: number; wrap360?: boolean } = {}): void {
  const old = running.get(key);
  if (old !== undefined) cancelAnimationFrame(old);
  running.delete(key);
  node.data = fmt(to);
  if (from === undefined || from === to || reducedMotion()) return;
  let start = from;
  if (opts.wrap360) {
    if (to - start > 180) start += 360;
    else if (to - start < -180) start -= 360;
  }
  const ms = opts.ms ?? 380;
  const t0 = performance.now();
  const step = (now: number): void => {
    const u = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - u, 3);
    let v = start + (to - start) * e;
    if (opts.wrap360) v = ((v % 360) + 360) % 360;
    node.data = fmt(u >= 1 ? to : v);
    if (u < 1) running.set(key, requestAnimationFrame(step));
    else running.delete(key);
  };
  running.set(key, requestAnimationFrame(step));
}

/**
 * Список перемальовується повністю, тож тут порівнюємо старі й нові рядки (за data-id): нові з'являються плавно,
 * видалені на мить лишаються привидом, що згортається. Виклик ДО очищення списку; повернена функція — ПІСЛЯ наповнення.
 */
export function beginListRender(ul: HTMLElement): () => void {
  if (reducedMotion()) return () => undefined;
  const prev = new Map<string, { el: HTMLElement; h: number; i: number }>();
  Array.from(ul.children).forEach((c, i) => {
    const el = c as HTMLElement;
    const id = el.dataset.id;
    if (id) prev.set(id, { el, h: el.offsetHeight, i });
  });
  return () => {
    // перший показ без анімації
    if (!prev.size) return;
    const now = new Set<string>();
    for (const c of Array.from(ul.children)) {
      const el = c as HTMLElement;
      const id = el.dataset.id;
      if (!id) continue;
      now.add(id);
      if (!prev.has(id)) el.classList.add("anim-in");
    }
    const removed = [...prev.entries()].filter(([id]) => !now.has(id)).sort((a, b) => a[1].i - b[1].i);
    if (!removed.length || removed.length > 6) return;
    for (const [, { el, h, i }] of removed) {
      el.classList.remove("sel", "anim-in");
      el.classList.add("anim-out");
      el.style.setProperty("--h", `${h}px`);
      ul.insertBefore(el, ul.children[i] ?? null);
      setTimeout(() => el.remove(), 360);
    }
  };
}

/** Ефект натискання (хвиля від точки дотику) на великих кнопках. */
export function initRipple(): void {
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (reducedMotion() || e.button > 0) return;
      const btn = (e.target as Element | null)?.closest<HTMLElement>(".btn.primary, .btn.fire-shot");
      if (!btn || (btn as HTMLButtonElement).disabled) return;
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const d = Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y)) * 2;
      const rip = document.createElement("span");
      rip.className = "rip";
      rip.style.cssText = `width:${d}px;height:${d}px;left:${x - d / 2}px;top:${y - d / 2}px`;
      btn.appendChild(rip);
      setTimeout(() => rip.remove(), 700);
    },
    { passive: true }
  );
}
