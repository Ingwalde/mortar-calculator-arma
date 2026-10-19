/**
 * Ковзний індикатор активного пункту: підсвітка плавно переїжджає між вкладками, замість того щоб миттєво стрибати.
 * Індикатор — окремий елемент усередині контейнера; позиція береться з offsetLeft/offsetTop активної кнопки
 * (тож працює й у контейнері, що прокручується), а зміни стежать за атрибутами aria-selected/aria-pressed.
 */
export interface SlideOptions {
  /** Селектор активного пункту всередині контейнера. */
  active: string;
  /** Індикатор-кільце (без заливки) замість суцільної підсвітки. */
  ring?: boolean;
}

export function slideIndicator(container: HTMLElement | null, opts: SlideOptions): void {
  if (!container || container.classList.contains("has-slide")) return;
  const ind = document.createElement("span");
  ind.className = "slide-ind" + (opts.ring ? " ring" : "");
  ind.setAttribute("aria-hidden", "true");
  container.classList.add("has-slide");
  container.prepend(ind);

  let placed = false;
  const place = (animate: boolean): void => {
    const el = container.querySelector<HTMLElement>(opts.active);
    if (!el || el.offsetWidth === 0) {
      ind.style.opacity = "0";
      placed = false;
      return;
    }
    // перше розміщення (або після появи контейнера) — без їзди з кута, далі — з анімацією
    const jump = !animate || !placed;
    if (jump) ind.style.transition = "none";
    ind.style.opacity = "1";
    ind.style.width = `${el.offsetWidth}px`;
    ind.style.height = `${el.offsetHeight}px`;
    ind.style.transform = `translate(${el.offsetLeft}px, ${el.offsetTop}px)`;
    if (jump) {
      void ind.offsetWidth;
      ind.style.transition = "";
    }
    placed = true;
  };

  new MutationObserver(() => place(true)).observe(container, { attributes: true, subtree: true, attributeFilter: ["aria-selected", "aria-pressed", "hidden", "class"] });
  const ro = new ResizeObserver(() => place(false));
  ro.observe(container);
  for (const child of Array.from(container.children)) if (child !== ind) ro.observe(child);
  place(false);
}
